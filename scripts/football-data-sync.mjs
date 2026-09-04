const API = 'https://api.football-data.org/v4';
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
if (!API_KEY) throw new Error('FOOTBALL_DATA_API_KEY secret mancante');

const season = Number(process.env.SEASON || 2026);
const competitions = [
  { code: 'SA', name: 'Serie A', country: 'Italy', apiFootballLeagueId: 135 },
  { code: 'PL', name: 'Premier League', country: 'England', apiFootballLeagueId: 39 },
  { code: 'PD', name: 'La Liga', country: 'Spain', apiFootballLeagueId: 140 },
  { code: 'BL1', name: 'Bundesliga', country: 'Germany', apiFootballLeagueId: 78 },
  { code: 'FL1', name: 'Ligue 1', country: 'France', apiFootballLeagueId: 61 },
  { code: 'CL', name: 'Champions League', country: 'Europe', apiFootballLeagueId: 2 },
];

const BASE = new URL('../data/api-football/latest.json', import.meta.url);
const fs = await import('node:fs/promises');

const norm = s => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

async function api(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'X-Auth-Token': API_KEY, accept: 'application/json' },
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`football-data HTTP ${response.status}: ${text.slice(0, 300)}`); }
  if (!response.ok) throw new Error(`football-data HTTP ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

let base = { generatedAt: null, season, mode: 'merged', leagues: [], teams: [], fixtures: [] };
try {
  base = JSON.parse(await fs.readFile(new URL(BASE), 'utf8'));
} catch {
  console.error('API-Football snapshot non presente: creo uno snapshot football-data-only.');
}

const existingFixtures = Array.isArray(base.fixtures) ? base.fixtures : [];
const existingTeams = Array.isArray(base.teams) ? base.teams : [];
const fixtures = [...existingFixtures];
const teams = new Map(existingTeams.map(t => [Number(t.apiId), t]));
const existingKeys = new Set(existingFixtures.map(f => [norm(f.home?.name), norm(f.away?.name), String(f.kickoff || '').slice(0, 16)].join('|')));

let imported = 0;
let duplicates = 0;

for (const comp of competitions) {
  const data = await api(`/competitions/${comp.code}/matches?season=${season}&limit=500`);
  const matches = Array.isArray(data.matches) ? data.matches : [];
  console.error(`competition=${comp.name} matches=${matches.length}`);

  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;
    if (m.score?.fullTime?.home == null || m.score?.fullTime?.away == null) continue;

    const homeName = m.homeTeam?.name;
    const awayName = m.awayTeam?.name;
    if (!m.id || !homeName || !awayName) continue;

    const homeKey = norm(homeName);
    const awayKey = norm(awayName);
    const kickoff = m.utcDate || null;
    const key = [homeKey, awayKey, String(kickoff || '').slice(0, 16)].join('|');
    if (existingKeys.has(key)) { duplicates++; continue; }

    // Keep football-data IDs in a separate numeric namespace so they can coexist
    // with API-Football IDs inside the existing D1 importer.
    const homeId = 100000000 + Number(m.homeTeam.id);
    const awayId = 100000000 + Number(m.awayTeam.id);
    const matchId = 200000000 + Number(m.id);

    if (!teams.has(homeId)) teams.set(homeId, { apiId: homeId, name: homeName, leagueId: comp.apiFootballLeagueId });
    if (!teams.has(awayId)) teams.set(awayId, { apiId: awayId, name: awayName, leagueId: comp.apiFootballLeagueId });

    fixtures.push({
      fixtureId: matchId,
      kickoff,
      status: 'FT',
      league: {
        id: comp.apiFootballLeagueId,
        name: comp.name,
        country: comp.country,
        season,
      },
      home: { id: homeId, name: homeName },
      away: { id: awayId, name: awayName },
      goals: { home: Number(m.score.fullTime.home), away: Number(m.score.fullTime.away) },
      stats: {
        home: { shots: null, sot: null, corners: null, fouls: null, saves: null, cards: null },
        away: { shots: null, sot: null, corners: null, fouls: null, saves: null, cards: null },
      },
      source: 'football-data.org',
      sourceMatchId: m.id,
    });
    existingKeys.add(key);
    imported++;
  }
}

fixtures.sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));

const snapshot = {
  generatedAt: new Date().toISOString(),
  season: base.season ?? season,
  mode: 'merged-api-football-plus-football-data',
  providers: ['api-football', 'football-data.org'],
  leagues: base.leagues?.length ? base.leagues : competitions.map(c => ({ id: c.apiFootballLeagueId, name: c.name, country: c.country, localLeague: c.name })),
  teams: [...teams.values()],
  fixtures,
};

console.error(`football-data imported=${imported} duplicates=${duplicates} totalFixtures=${fixtures.length}`);
process.stdout.write(JSON.stringify(snapshot, null, 2));
