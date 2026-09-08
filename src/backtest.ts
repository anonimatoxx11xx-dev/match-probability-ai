type BTStats = { matches: number; goalsFor: number; goalsAgainst: number; homeMatches: number; homeGoalsFor: number; homeGoalsAgainst: number; awayMatches: number; awayGoalsFor: number; awayGoalsAgainst: number };

function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }
function poisson(lambda: number, k: number) { let p = Math.exp(-lambda); for (let i = 1; i <= k; i++) p *= lambda / i; return p; }
function distribution(lambda: number) { const p: number[] = []; for (let k = 0; k <= 8; k++) p.push(poisson(lambda, k)); const s = p.reduce((a, b) => a + b, 0); return p.map(x => x / s); }
function weighted(n: number, gf: number, ga: number, overallF: number, overallA: number) { const w = n <= 0 ? 0 : n / (n + 8); return { for: gf * w + overallF * (1 - w), against: ga * w + overallA * (1 - w) }; }
function probabilities(h: BTStats, a: BTStats) {
  const hs = weighted(h.homeMatches, h.homeGoalsFor / Math.max(h.homeMatches, 1), h.homeGoalsAgainst / Math.max(h.homeMatches, 1), h.goalsFor / Math.max(h.matches, 1), h.goalsAgainst / Math.max(h.matches, 1));
  const aw = weighted(a.awayMatches, a.awayGoalsFor / Math.max(a.awayMatches, 1), a.awayGoalsAgainst / Math.max(a.awayMatches, 1), a.goalsFor / Math.max(a.matches, 1), a.goalsAgainst / Math.max(a.matches, 1));
  const hg = clamp((hs.for * .55 + aw.against * .45) * 1.05, .20, 3.80);
  const ag = clamp((aw.for * .55 + hs.against * .45) * .95, .15, 3.50);
  const hd = distribution(hg), ad = distribution(ag);
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const p = hd[i] * ad[j]; if (i > j) home += p; else if (i === j) draw += p; else away += p; }
  const s = home + draw + away;
  return { home: home / s, draw: draw / s, away: away / s };
}
function empty(): BTStats { return { matches: 0, goalsFor: 0, goalsAgainst: 0, homeMatches: 0, homeGoalsFor: 0, homeGoalsAgainst: 0, awayMatches: 0, awayGoalsFor: 0, awayGoalsAgainst: 0 }; }
function add(x: BTStats, gf: number, ga: number, home: boolean) { x.matches++; x.goalsFor += gf; x.goalsAgainst += ga; if (home) { x.homeMatches++; x.homeGoalsFor += gf; x.homeGoalsAgainst += ga; } else { x.awayMatches++; x.awayGoalsFor += gf; x.awayGoalsAgainst += ga; } }

export async function runBacktest(env: { DB: D1Database }, leagueName = 'Serie A', minHistory = 3) {
  const sql = leagueName && leagueName !== 'all'
    ? `SELECT m.id,m.league_id,m.home_team_id,m.away_team_id,m.kickoff,m.home_goals,m.away_goals,l.name AS league FROM matches m JOIN leagues l ON l.id=m.league_id WHERE m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL AND l.name=? ORDER BY m.kickoff ASC,m.id ASC`
    : `SELECT m.id,m.league_id,m.home_team_id,m.away_team_id,m.kickoff,m.home_goals,m.away_goals,l.name AS league FROM matches m JOIN leagues l ON l.id=m.league_id WHERE m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL ORDER BY m.kickoff ASC,m.id ASC`;
  const query = leagueName && leagueName !== 'all' ? await env.DB.prepare(sql).bind(leagueName).all<any>() : await env.DB.prepare(sql).all<any>();
  const history = new Map<number, BTStats>();
  let evaluated = 0, correct = 0, brier = 0, logLoss = 0;
  const leagues: Record<string, { evaluated: number; correct: number; brier: number; logLoss: number }> = {};
  for (const m of query.results || []) {
    const h = history.get(Number(m.home_team_id)) || empty(), a = history.get(Number(m.away_team_id)) || empty();
    if (h.matches >= minHistory && a.matches >= minHistory) {
      const p = probabilities(h, a), hg = Number(m.home_goals), ag = Number(m.away_goals), actual = hg > ag ? 0 : hg === ag ? 1 : 2;
      const ps = [p.home, p.draw, p.away], prediction = ps.indexOf(Math.max(...ps));
      if (prediction === actual) correct++;
      const score = (p.home - (actual === 0 ? 1 : 0)) ** 2 + (p.draw - (actual === 1 ? 1 : 0)) ** 2 + (p.away - (actual === 2 ? 1 : 0)) ** 2;
      brier += score; logLoss += -Math.log(Math.max(ps[actual], 1e-15)); evaluated++;
      const key = String(m.league); if (!leagues[key]) leagues[key] = { evaluated: 0, correct: 0, brier: 0, logLoss: 0 };
      const x = leagues[key]; x.evaluated++; if (prediction === actual) x.correct++; x.brier += score; x.logLoss += -Math.log(Math.max(ps[actual], 1e-15));
    }
    add(h, Number(m.home_goals), Number(m.away_goals), true); add(a, Number(m.away_goals), Number(m.home_goals), false);
    history.set(Number(m.home_team_id), h); history.set(Number(m.away_team_id), a);
  }
  const leagueResults: Record<string, any> = {};
  for (const [name, x] of Object.entries(leagues)) leagueResults[name] = { evaluated: x.evaluated, accuracy: x.evaluated ? x.correct / x.evaluated : 0, brier: x.evaluated ? x.brier / x.evaluated : 0, logLoss: x.evaluated ? x.logLoss / x.evaluated : 0 };
  return { method: 'walk-forward', league: leagueName, minHistory, totalMatches: (query.results || []).length, evaluated, accuracy: evaluated ? correct / evaluated : 0, brier: evaluated ? brier / evaluated : 0, logLoss: evaluated ? logLoss / evaluated : 0, leagues: leagueResults };
}
