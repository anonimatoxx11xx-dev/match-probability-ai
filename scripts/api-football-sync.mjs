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

const season = Number(process.env.SEASON || new Date().getUTCFullYear());
const daysBack = Number(process.env.DAYS_BACK || 21);
const daysForward = Number(process.env.DAYS_FORWARD || 7);
const sleepMs = Number(process.env.REQUEST_DELAY_MS || 7000);
const maxDetailFixtures = Number(process.env.MAX_DETAIL_FIXTURES || 60);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const isoDate = d => d.toISOString().slice(0, 10);
const now = new Date();
const from = new Date(now.getTime() - daysBack * 86400000);
const to = new Date(now.getTime() + daysForward * 86400000);

async function api(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'x-apisports-key': API_KEY, accept: 'application/json' },
  });
  const remaining = response.headers.get('X-RateLimit-Remaining');
  if (response.status === 429) throw new Error(`API-Football 429 rate limit; remaining=${remaining ?? 'unknown'}`);
  const data = await response.json();
  if (!response.ok || (data.errors && Object.keys(data.errors).length)) {
    throw new Error(`API-Football: ${JSON.stringify(data.errors || data)}`);
  }
  return { data, remaining };
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function statValue(stats, name) {
  const row = stats?.find(x => norm(x.type) === norm(name));
  const v = row?.value;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace('%', ''));
  return Number.isFinite(n) ? n : null;
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
    league: { id: f.league?.id, name: f.league?.name, country: f.league?.country, season: f.league?.season },
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

const fixtureIds = [];
const teams = new Map();

for (const league of leagues) {
  const q = new URLSearchParams({ league: String(league.id), season: String(season), from: isoDate(from), to: isoDate(to) });
  const result = await api(`/fixtures?${q}`);
  const list = result.data.response || [];
  for (const f of list) {
    if (!f.fixture?.id) continue;
    fixtureIds.push(f.fixture.id);
    if (f.teams?.home?.id) teams.set(f.teams.home.id, { apiId: f.teams.home.id, name: f.teams.home.name, leagueId: league.id });
    if (f.teams?.away?.id) teams.set(f.teams.away.id, { apiId: f.teams.away.id, name: f.teams.away.name, leagueId: league.id });
  }
  console.error(`league=${league.name} fixtures=${list.length} remaining=${result.remaining ?? '?'}`);
  await sleep(sleepMs);
}

const uniqueIds = [...new Set(fixtureIds)].slice(0, maxDetailFixtures);
const details = [];
for (let i = 0; i < uniqueIds.length; i += 20) {
  const ids = uniqueIds.slice(i, i + 20);
  const result = await api(`/fixtures?ids=${ids.join('-')}`);
  for (const f of result.data.response || []) details.push(compactFixture(f));
  console.error(`details=${ids.length} remaining=${result.remaining ?? '?'}`);
  if (i + 20 < uniqueIds.length) await sleep(sleepMs);
}

details.sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));

const snapshot = {
  generatedAt: new Date().toISOString(),
  season,
  window: { from: isoDate(from), to: isoDate(to) },
  leagues,
  teams: [...teams.values()],
  fixtures: details,
};

process.stdout.write(JSON.stringify(snapshot, null, 2));
