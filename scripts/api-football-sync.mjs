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
  { id: 197, name: 'Super League 1', country: 'Greece', localLeague: 'Super League 1' },
  { id: 218, name: 'Bundesliga Austria', country: 'Austria', localLeague: 'Bundesliga Austria' },
];

const season = Number(process.env.SEASON || 2024);
const sleepMs = Number(process.env.REQUEST_DELAY_MS || 6500);
const maxFixtures = Math.min(Number(process.env.MAX_DETAIL_FIXTURES || 36), 36);
const todayTeamIds = new Set(String(process.env.TODAY_TEAM_IDS || '').split(',').map(Number).filter(Boolean));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const todayTeamNames = new Set(String(process.env.TODAY_TEAM_NAMES || '').split('|').map(norm).filter(Boolean));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(path) {
  const response = await fetch(`${API}${path}`, { headers: { 'x-apisports-key': API_KEY, accept: 'application/json' } });
  const remainingHeader = response.headers.get('X-RateLimit-Remaining');
  const remaining = remainingHeader == null ? null : Number(remainingHeader);
  if (response.status === 429) throw new Error(`API-Football 429 rate limit; remaining=${remainingHeader ?? 'unknown'}`);
  const data = await response.json();
  if (!response.ok || (data.errors && Object.keys(data.errors).length)) throw new Error(`API-Football: ${JSON.stringify(data.errors || data)}`);
  return { data, remaining };
}

function dateRome() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${p.find(x => x.type === 'year')?.value}-${p.find(x => x.type === 'month')?.value}-${p.find(x => x.type === 'day')?.value}`;
}

function summaryFixture(f, leagueId) {
  return {
    fixtureId: f.fixture?.id,
    kickoff: f.fixture?.date || null,
    status: f.fixture?.status?.short || null,
    league: { id: f.league?.id ?? leagueId, name: f.league?.name, country: f.league?.country, season: f.league?.season ?? season },
    home: { id: f.teams?.home?.id, name: f.teams?.home?.name },
    away: { id: f.teams?.away?.id, name: f.teams?.away?.name },
    goals: { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
    stats: { home: { shots: null, sot: null, corners: null, fouls: null, saves: null, cards: null }, away: { shots: null, sot: null, corners: null, fouls: null, saves: null, cards: null } },
  };
}

const today = dateRome();
const candidates = [];
const listFixtures = new Map();
const teams = new Map();
const todayIds = new Set(todayTeamIds);
let quotaReached = false;

for (const league of leagues) {
  let result;
  try {
    result = await api(`/fixtures?league=${league.id}&season=${season}`);
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('429') || msg.includes('request limit') || msg.includes('daily quota') || msg.includes('rate limit')) {
      console.error(`API quota reached while loading ${league.name}; keeping collected data.`);
      quotaReached = true;
      break;
    }
    throw error;
  }
  const list = result.data.response || [];
  for (const f of list) {
    const homeId = f.teams?.home?.id;
    const awayId = f.teams?.away?.id;
    const homeName = norm(f.teams?.home?.name);
    const awayName = norm(f.teams?.away?.name);
    const kickoff = f.fixture?.date || '';
    if (season === 2026 && kickoff.slice(0, 10) === today) {
      if (homeId) todayIds.add(homeId);
      if (awayId) todayIds.add(awayId);
    }
    const status = String(f.fixture?.status?.short || '');
    if (!f.fixture?.id || !['FT', 'AET', 'P'].includes(status)) continue;
    const priority = todayIds.has(homeId) || todayIds.has(awayId) || todayTeamNames.has(homeName) || todayTeamNames.has(awayName) ? 1 : 0;
    candidates.push({ fixtureId: f.fixture.id, kickoff, leagueId: league.id, priority });
    listFixtures.set(f.fixture.id, summaryFixture(f, league.id));
    if (homeId) teams.set(homeId, { apiId: homeId, name: f.teams.home.name, leagueId: league.id });
    if (awayId) teams.set(awayId, { apiId: awayId, name: f.teams.away.name, leagueId: league.id });
  }
  console.error(`league=${league.name} fixtures=${list.length} remaining=${result.remaining ?? '?'}`);
  if (result.remaining !== null && result.remaining <= 2) { quotaReached = true; break; }
  await sleep(sleepMs);
}

const priority = candidates.filter(x => x.priority === 1).sort((a,b) => String(b.kickoff).localeCompare(String(a.kickoff)));
const normal = candidates.filter(x => x.priority !== 1).sort((a,b) => String(b.kickoff).localeCompare(String(a.kickoff)));
const ordered = [...priority, ...normal];
const fixtures = [...new Set(ordered.map(x => x.fixtureId))].slice(0, maxFixtures).map(id => listFixtures.get(id));
fixtures.sort((a,b) => String(a.kickoff).localeCompare(String(b.kickoff)));

const snapshot = {
  generatedAt: new Date().toISOString(),
  season,
  mode: 'historical-bootstrap-priority-today-names-sofascore-stats',
  today,
  todayTeamIds: [...todayIds],
  todayTeamNames: [...todayTeamNames],
  leagues,
  teams: [...teams.values()],
  fixtures,
};
process.stdout.write(JSON.stringify(snapshot, null, 2));
