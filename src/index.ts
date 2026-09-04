interface Env {
  DB: D1Database;
  API_FOOTBALL_KEY: string;
}

const SNAPSHOT_URL = 'https://raw.githubusercontent.com/anonimatoxx11xx-dev/match-probability-ai/main/data/api-football/latest.json';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: {
    'content-type': 'application/json;charset=UTF-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  },
});

function poisson(lambda: number, k: number) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function distribution(lambda: number, max = 8) {
  const p: number[] = [];
  for (let k = 0; k <= max; k++) p.push(poisson(lambda, k));
  const s = p.reduce((a, b) => a + b, 0);
  return p.map(x => x / s);
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

type Stats = {
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  shots: number;
  sot: number;
  corners: number;
  fouls: number;
  saves: number;
  cards: number;
  homeMatches: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayMatches: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
};

function weightedSplit(splitMatches: number, splitFor: number, splitAgainst: number, overallFor: number, overallAgainst: number) {
  const weight = splitMatches <= 0 ? 0 : splitMatches / (splitMatches + 8);
  return {
    goalsFor: splitFor * weight + overallFor * (1 - weight),
    goalsAgainst: splitAgainst * weight + overallAgainst * (1 - weight),
  };
}

function predict(h: Stats, a: Stats) {
  const homeSplit = weightedSplit(h.homeMatches, h.homeGoalsFor, h.homeGoalsAgainst, h.goalsFor, h.goalsAgainst);
  const awaySplit = weightedSplit(a.awayMatches, a.awayGoalsFor, a.awayGoalsAgainst, a.goalsFor, a.goalsAgainst);
  const hg = clamp((homeSplit.goalsFor * 0.55 + awaySplit.goalsAgainst * 0.45) * 1.05, 0.20, 3.80);
  const ag = clamp((awaySplit.goalsFor * 0.55 + homeSplit.goalsAgainst * 0.45) * 0.95, 0.15, 3.50);
  const hd = distribution(hg, 8), ad = distribution(ag, 8);
  const score: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    const p = hd[i] * ad[j]; score[i][j] = p;
    if (i > j) home += p; else if (i === j) draw += p; else away += p;
  }
  const sum = (fn: (i: number, j: number) => boolean) => {
    let x = 0; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if (fn(i, j)) x += score[i][j]; return x;
  };
  const over = (line: number) => sum((i, j) => i + j > line);
  const under = (line: number) => sum((i, j) => i + j < line);
  const bttsYes = sum((i, j) => i >= 1 && j >= 1);
  const correctScores: Array<{ score: string; probability: number }> = [];
  for (let i = 0; i <= 5; i++) for (let j = 0; j <= 5; j++) correctScores.push({ score: `${i}-${j}`, probability: score[i][j] });
  correctScores.sort((x, y) => y.probability - x.probability);
  const minMatches = Math.min(h.matches, a.matches);
  const dataQuality = minMatches >= 20 ? 'high' : minMatches >= 8 ? 'medium' : 'low';
  const reliability = clamp(0.35 + Math.min(minMatches, 30) / 30 * 0.65, 0.35, 1);
  return {
    expectedGoals: { home: hg, away: ag, total: hg + ag },
    result: { home, draw, away },
    doubleChance: { '1X': home + draw, 'X2': draw + away, '12': home + away },
    drawNoBet: { home: home + away > 0 ? home / (home + away) : 0, away: home + away > 0 ? away / (home + away) : 0, drawRefund: draw },
    markets: { over05: over(0), under05: under(1), over15: over(1), under15: under(2), over25: over(2), under25: under(3), over35: over(3), under35: under(4), over45: over(4), under45: under(5), bttsYes, bttsNo: 1 - bttsYes },
    correctScores: correctScores.slice(0, 10),
    expectedStats: { shots: h.shots + a.shots, sot: h.sot + a.sot, corners: h.corners + a.corners, fouls: h.fouls + a.fouls, saves: h.saves + a.saves, cards: h.cards + a.cards },
    dataQuality: { homeMatches: h.matches, awayMatches: a.matches, minMatches, level: dataQuality, reliability },
    model: 'Poisson + home/away splits + historical team averages + home advantage',
  };
}

async function stats(env: Env, id: number): Promise<Stats | null> {
  const r = await env.DB.prepare(`SELECT matches,goals_for,goals_against,shots_for,shots_on_target_for,corners_for,fouls_for,saves_for,cards_for,home_matches,home_goals_for,home_goals_against,away_matches,away_goals_for,away_goals_against FROM team_stats WHERE team_id=?`).bind(id).first<any>();
  if (!r) return null;
  return {
    matches: Number(r.matches || 0), goalsFor: Number(r.goals_for || 0), goalsAgainst: Number(r.goals_against || 0),
    shots: Number(r.shots_for || 0), sot: Number(r.shots_on_target_for || 0), corners: Number(r.corners_for || 0), fouls: Number(r.fouls_for || 0), saves: Number(r.saves_for || 0), cards: Number(r.cards_for || 0),
    homeMatches: Number(r.home_matches || 0), homeGoalsFor: Number(r.home_goals_for || 0), homeGoalsAgainst: Number(r.home_goals_against || 0),
    awayMatches: Number(r.away_matches || 0), awayGoalsFor: Number(r.away_goals_for || 0), awayGoalsAgainst: Number(r.away_goals_against || 0),
  };
}

function canonical(name: string) {
  const n = String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases: Record<string, string> = {
    'bayern munich': 'fc bayern munchen', 'bayern munchen': 'fc bayern munchen', 'inter milan': 'inter', 'internazionale': 'inter', 'ac milan': 'milan', 'as roma': 'roma', 'ssc napoli': 'napoli',
  };
  return aliases[n] || n;
}

async function resolveTeam(env: Env, value: string | null) {
  if (!value) return null;
  const id = Number(value);
  if (Number.isInteger(id) && id > 0) return await env.DB.prepare('SELECT id,name FROM teams WHERE id=?').bind(id).first<any>();
  const wanted = canonical(value);
  const rows = await env.DB.prepare('SELECT id,name FROM teams').all<any>();
  return (rows.results || []).find((r: any) => canonical(r.name) === wanted) || null;
}

type Snapshot = {
  generatedAt: string; season: number; mode?: string;
  leagues: Array<{ id: number; name: string; country: string; localLeague: string }>;
  teams: Array<{ apiId: number; name: string; leagueId: number }>;
  fixtures: Array<any>;
};

async function importSnapshot(env: Env) {
  const response = await fetch(SNAPSHOT_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Snapshot HTTP ${response.status}`);
  const snapshot = await response.json() as Snapshot;
  if (!snapshot.generatedAt || !Array.isArray(snapshot.fixtures)) throw new Error('Snapshot non valido');

  const leagueRows = await env.DB.prepare('SELECT id,name,api_football_id FROM leagues').all<any>();
  const localLeagueByApi = new Map<number, number>();
  const localLeagueByName = new Map<string, number>();
  for (const row of leagueRows.results || []) {
    if (row.api_football_id != null) localLeagueByApi.set(Number(row.api_football_id), Number(row.id));
    localLeagueByName.set(String(row.name), Number(row.id));
  }
  const leagueStatements = snapshot.leagues.map(l => {
    const localId = localLeagueByName.get(l.localLeague || l.name);
    return localId ? env.DB.prepare('UPDATE leagues SET api_football_id=? WHERE id=?').bind(l.id, localId) : null;
  }).filter(Boolean) as D1PreparedStatement[];
  if (leagueStatements.length) await env.DB.batch(leagueStatements);

  const refreshedLeagues = await env.DB.prepare('SELECT id,name,api_football_id FROM leagues').all<any>();
  localLeagueByApi.clear();
  for (const row of refreshedLeagues.results || []) if (row.api_football_id != null) localLeagueByApi.set(Number(row.api_football_id), Number(row.id));

  const existingTeamRows = await env.DB.prepare('SELECT id,league_id,name,api_football_id FROM teams').all<any>();
  const teamIdByApi = new Map<number, number>();
  const teamByCanonical = new Map<string, any>();
  for (const row of existingTeamRows.results || []) {
    if (row.api_football_id != null) teamIdByApi.set(Number(row.api_football_id), Number(row.id));
    teamByCanonical.set(canonical(row.name), row);
  }

  const teamStatements: D1PreparedStatement[] = [];
  for (const team of snapshot.teams) {
    const apiId = Number(team.apiId);
    if (!apiId || !team.name || teamIdByApi.has(apiId)) continue;
    const existing = teamByCanonical.get(canonical(team.name));
    if (existing) {
      teamIdByApi.set(apiId, Number(existing.id));
      teamStatements.push(env.DB.prepare('UPDATE teams SET api_football_id=? WHERE id=? AND api_football_id IS NULL').bind(apiId, Number(existing.id)));
      continue;
    }
    const localLeagueId = localLeagueByApi.get(Number(team.leagueId));
    if (!localLeagueId) continue;
    teamStatements.push(env.DB.prepare('INSERT OR IGNORE INTO teams (league_id,name,api_football_id) VALUES (?,?,?)').bind(localLeagueId, team.name, apiId));
  }
  if (teamStatements.length) await env.DB.batch(teamStatements);

  const refreshedTeams = await env.DB.prepare('SELECT id,name,api_football_id FROM teams').all<any>();
  teamIdByApi.clear();
  teamByCanonical.clear();
  for (const row of refreshedTeams.results || []) {
    if (row.api_football_id != null) teamIdByApi.set(Number(row.api_football_id), Number(row.id));
    teamByCanonical.set(canonical(row.name), row);
  }

  const matchStatements: D1PreparedStatement[] = [];
  let imported = 0, skipped = 0;
  for (const f of snapshot.fixtures) {
    if (!f.fixtureId || !['FT','AET','P'].includes(String(f.status))) continue;
    if (f.goals?.home == null || f.goals?.away == null) continue;
    const leagueId = localLeagueByApi.get(Number(f.league?.id));
    const homeId = teamIdByApi.get(Number(f.home?.id)) || teamByCanonical.get(canonical(f.home?.name))?.id;
    const awayId = teamIdByApi.get(Number(f.away?.id)) || teamByCanonical.get(canonical(f.away?.name))?.id;
    if (!leagueId || !homeId || !awayId) { skipped++; continue; }
    const hs = f.stats?.home || {}, as = f.stats?.away || {};
    matchStatements.push(env.DB.prepare(`INSERT INTO matches (league_id,home_team_id,away_team_id,kickoff,home_goals,away_goals,home_shots,away_shots,home_sot,away_sot,home_corners,away_corners,home_fouls,away_fouls,home_saves,away_saves,home_cards,away_cards,api_football_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(api_football_id) DO UPDATE SET league_id=excluded.league_id,home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,kickoff=excluded.kickoff,home_goals=excluded.home_goals,away_goals=excluded.away_goals,home_shots=excluded.home_shots,away_shots=excluded.away_shots,home_sot=excluded.home_sot,away_sot=excluded.away_sot,home_corners=excluded.home_corners,away_corners=excluded.away_corners,home_fouls=excluded.home_fouls,away_fouls=excluded.away_fouls,home_saves=excluded.home_saves,away_saves=excluded.away_saves,home_cards=excluded.home_cards,away_cards=excluded.away_cards`).bind(leagueId,homeId,awayId,f.kickoff,f.goals.home,f.goals.away,hs.shots,as.shots,hs.sot,as.sot,hs.corners,as.corners,hs.fouls,as.fouls,hs.saves,as.saves,hs.cards,as.cards,f.fixtureId));
    imported++;
  }
  for (let i = 0; i < matchStatements.length; i += 100) await env.DB.batch(matchStatements.slice(i, i + 100));
  return { generatedAt: snapshot.generatedAt, season: snapshot.season, importedMatches: imported, skippedMatches: skipped };
}

function samplePoisson(lambda: number) {
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L && k < 20);
  return k - 1;
}

async function simulate(env: Env, homeId: number, awayId: number, runs: number) {
  const h = await stats(env, homeId), a = await stats(env, awayId);
  if (!h || !a) throw new Error('Statistiche squadra non disponibili');
  const base = predict(h, a);
  let hw = 0, d = 0, aw = 0, o25 = 0;
  for (let n = 0; n < runs; n++) {
    const x = samplePoisson(base.expectedGoals.home), y = samplePoisson(base.expectedGoals.away);
    if (x > y) hw++; else if (x === y) d++; else aw++;
    if (x + y >= 3) o25++;
  }
  return { runs, homeWin: hw/runs, draw: d/runs, awayWin: aw/runs, over25: o25/runs, expectedGoals: base.expectedGoals };
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'OPTIONS') return json({ ok: true });
    const u = new URL(request.url);
    try {
      if (u.pathname === '/api/health') return json({ ok: true, service: 'match-probability-ai', version: '1.6.0' });
      if (u.pathname === '/api/provider/test') return json({ ok: true, provider: 'API-Football', configured: Boolean(env.API_FOOTBALL_KEY), mode: 'scheduled-github-collector' });
      if (u.pathname === '/api/data/status') {
        const r = await env.DB.prepare('SELECT COUNT(*) AS matches FROM matches WHERE home_goals IS NOT NULL AND away_goals IS NOT NULL').first<any>();
        const t = await env.DB.prepare('SELECT COUNT(*) AS teams_with_stats FROM team_stats WHERE matches > 0').first<any>();
        return json({ ok: true, matches: Number(r?.matches || 0), teamsWithStats: Number(t?.teams_with_stats || 0) });
      }
      if (u.pathname === '/api/leagues') return json((await env.DB.prepare('SELECT id,name,country FROM leagues ORDER BY name').all()).results);
      if (u.pathname === '/api/teams') {
        const league = u.searchParams.get('league');
        const r = league ? await env.DB.prepare('SELECT t.id,t.name,l.name league FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.name=? ORDER BY t.name').bind(league).all() : await env.DB.prepare('SELECT id,name FROM teams ORDER BY name').all();
        return json(r.results);
      }
      if (u.pathname === '/api/predict') {
        let homeValue: string | null = u.searchParams.get('home');
        let awayValue: string | null = u.searchParams.get('away');
        if (request.method === 'POST') { const b = await request.json() as any; homeValue = String(b.homeTeamId ?? b.home ?? ''); awayValue = String(b.awayTeamId ?? b.away ?? ''); }
        const homeTeam = await resolveTeam(env, homeValue), awayTeam = await resolveTeam(env, awayValue);
        if (!homeTeam || !awayTeam || homeTeam.id === awayTeam.id) return json({ error: 'Squadre home/away non valide' }, 400);
        const h = await stats(env, Number(homeTeam.id)), a = await stats(env, Number(awayTeam.id));
        if (!h || !a) return json({ error: 'Statistiche squadra non disponibili' }, 404);
        return json({ homeTeam: homeTeam.name, awayTeam: awayTeam.name, ...predict(h, a) });
      }
      if (u.pathname === '/api/simulate' && request.method === 'POST') {
        const b = await request.json() as any;
        const homeTeam = await resolveTeam(env, String(b.homeTeamId ?? b.home ?? ''));
        const awayTeam = await resolveTeam(env, String(b.awayTeamId ?? b.away ?? ''));
        if (!homeTeam || !awayTeam || homeTeam.id === awayTeam.id) return json({ error: 'Squadre home/away non valide' }, 400);
        const runs = clamp(Number(b.runs || 10000), 1000, 100000);
        return json({ homeTeam: homeTeam.name, awayTeam: awayTeam.name, ...await simulate(env, Number(homeTeam.id), Number(awayTeam.id), Math.round(runs)) });
      }
      if (request.method === 'POST' && u.pathname === '/api/import') return json(await importSnapshot(env));
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      return json({ error: String(error instanceof Error ? error.message : error) }, 500);
    }
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    await importSnapshot(env);
  },
};
