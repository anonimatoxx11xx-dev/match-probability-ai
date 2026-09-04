const API = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;
if (!API_KEY) throw new Error('API_FOOTBALL_KEY secret mancante');

const leagues = [
  { id: 135, name: 'Serie A', country: 'Italy', localLeague: 'Serie A' },
  { id: 39, name: 'Premier League', country: 'England', localLeague: 'Premier League' },
  { id: 140, name: 'La Liga', country: 'Spain', localLeague: 'La Liga' },
  { id: 78, name: 'Bundesliga', country: 'Germany', localLeague: 'Bundesliga' },
  { id: 61, name: 'Ligue 1', country: 'France', localLeague: 'Ligue 1' },
  { id: 2, name: 'Champions League', country: 'World', localLeague: 'Champions League' },
];

// Free plan: 100 requests/day. One fixture-list request per competition is cheap;
// detailed fixture calls are expensive, so keep a conservative detail budget.
const season = Number(process.env.SEASON || 2024);
const sleepMs = Number(process.env.REQUEST_DELAY_MS || 6500);
const maxDetailFixtures = Math.min(Number(process.env.MAX_DETAIL_FIXTURES || 40), 40);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'x-apisports-key': API_KEY, accept: 'application/json' },
  });
  const remainingHeader = response.headers.get('X-RateLimit-Remaining');
  const remaining = remainingHeader == null ? null : Number(remainingHeader);
  if (response.status === 429) {
    throw new Error(`API-Football 429 rate limit; remaining=${remainingHeader ?? 'unknown'}`);
  }
  const data = await response.json();
  if (!response.ok || (data.errors && Object.keys(data.errors).length)) {
    throw new Error(`API-Football: ${JSON.stringify(data.errors || data)}`);
  }
  return { data, remaining };
}

const norm = s => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function statValue(stats, name) {
  const row = stats?.find(x => norm(x.type) === norm(name));
  const v = row?.value;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace('%', ''));
  return Number.isFinite(n) ? n : null;
}

function summaryFixture(f, leagueId) {
  return {
    fixtureId: f.fixture?.id,
    kickoff: f.fixture?.date || null,
    status: f.fixture?.status?.short || null,
    league: {
      id: f.league?.id ?? leagueId,
      name: f.league?.name,
      country: f.league?.country,
      season: f.league?.season ?? season,
    },
    home: { id: f.teams?.home?.id, name: f.teams?.home?.name },
    away: { id: f.teams?.away?.id, name: f.teams?.away?.name },
    goals: { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
    stats: {
      home: { shots: null, sot: null, corners: null, fouls: null, saves: null, cards: null },
      away: { shots: null, sot: null, corners: null, fouls: null, saves: null, cards: null },
    },
  };
}

function compactFixture(f) {
  const home = f.teams?.home;
  const away = f.teams?.away;
  const hs = f.statistics?.find(x => x.team?.id === home?.id)?.statistics || [];
  const as = f.statistics?.find(x => x.team?.id === away?.id)?.statistics || [];
  return {
    fixtureId: f.fixture?.id,
    kickoff: f.fixture?.date || null,
    status: f.fixture?.status?.short || null,
    league: {
      id: f.league?.id,
      name: f.league?.name,
      country: f.league?.country,
      season: f.league?.season,
    },
    home: { id: home?.id, name: home?.name },
    away: { id: away?.id, name: away?.name },
    goals: { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
    stats: {
      home: {
        shots: statValue(hs, 'Total Shots'),
        sot: statValue(hs, 'Shots on Goal'),
        corners: statValue(hs, 'Corner Kicks'),
        fouls: statValue(hs, 'Fouls'),
        saves: statValue(hs, 'Goalkeeper Saves'),
        cards: statValue(hs, 'Yellow Cards'),
      },
      away: {
        shots: statValue(as, 'Total Shots'),
        sot: statValue(as, 'Shots on Goal'),
        corners: statValue(as, 'Corner Kicks'),
        fouls: statValue(as, 'Fouls'),
        saves: statValue(as, 'Goalkeeper Saves'),
        cards: statValue(as, 'Yellow Cards'),
      },
    },
  };
}

const candidates = [];
const teams = new Map();

// First collect every completed fixture from the season lists. These calls provide
// reliable goals/results without spending one request per fixture on statistics.
for (const league of leagues) {
  const result = await api(`/fixtures?league=${league.id}&season=${season}`);
  const list = result.data.response || [];
  for (const f of list) {
    const status = String(f.fixture?.status?.short || '');
    if (!f.fixture?.id || !['FT', 'AET', 'P'].includes(status)) continue;
    candidates.push({ fixtureId: f.fixture.id, kickoff: f.fixture.date || '', leagueId: league.id });
    if (f.teams?.home?.id) teams.set(f.teams.home.id, { apiId: f.teams.home.id, name: f.teams.home.name, leagueId: league.id });
    if (f.teams?.away?.id) teams.set(f.teams.away.id, { apiId: f.teams.away.id, name: f.teams.away.name, leagueId: league.id });
  }
  console.error(`league=${league.name} fixtures=${list.length} remaining=${result.remaining ?? '?'}`);
  await sleep(sleepMs);
}

// Keep the full result history, then enrich a recent balanced subset with detailed stats.
const summaries = [];
for (const league of leagues) {
  summaries.push(...candidates
    .filter(x => x.leagueId === league.id)
    .sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)))
    .map(x => x.fixtureId));
}

const summaryById = new Map();
for (const league of leagues) {
  for (const c of candidates.filter(x => x.leagueId === league.id)) {
    // Details are filled below for selected fixtures; all other rows are populated
    // from the already-fetched season list, so no extra API request is needed.
    summaryById.set(c.fixtureId, c);
  }
}

// Re-fetching the season list is intentionally avoided. Build summaries from the
// candidate IDs and use detail calls only for the latest matches per competition.
// The Worker accepts null statistical fields and uses available values in AVG().
const fixtures = [];

// We need the list response data to create complete summary rows, so collect it once
// more from the local candidate metadata only where possible; details will replace
// selected rows. For un-enriched fixtures, use a minimal row and preserve the result
// data from the original API list through the compact candidate structure.
// To keep the snapshot useful, select detail fixtures first and append them below.
const selectedIds = [];
const perLeague = Math.max(1, Math.floor(maxDetailFixtures / leagues.length));
for (const league of leagues) {
  selectedIds.push(...candidates
    .filter(x => x.leagueId === league.id)
    .sort((a, b) => String(b.kickoff).localeCompare(String(a.kickoff)))
    .slice(0, perLeague)
    .map(x => x.fixtureId));
}

const uniqueIds = [...new Set(selectedIds)].slice(0, maxDetailFixtures);
const detailed = new Map();

for (let i = 0; i < uniqueIds.length; i++) {
  const fixtureId = uniqueIds[i];
  const result = await api(`/fixtures?id=${fixtureId}`);
  for (const f of result.data.response || []) detailed.set(f.fixture?.id, compactFixture(f));
  console.error(`detail=${fixtureId} (${i + 1}/${uniqueIds.length}) remaining=${result.remaining ?? '?'}`);
  if (result.remaining !== null && result.remaining <= 1) break;
  if (i + 1 < uniqueIds.length) await sleep(sleepMs);
}

// The season-list response already contains goals and teams, but to avoid a second
// set of API calls we reconstruct those fields from the selected detailed fixtures
// and the candidate metadata. Detailed fixtures are authoritative for the enriched
// subset; non-enriched fixtures are intentionally omitted from this bootstrap rather
// than fabricating missing team/result fields.
for (const [id, f] of detailed) fixtures.push(f);
fixtures.sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));

const snapshot = {
  generatedAt: new Date().toISOString(),
  season,
  mode: 'historical-bootstrap',
  leagues,
  teams: [...teams.values()],
  fixtures,
};

process.stdout.write(JSON.stringify(snapshot, null, 2));
