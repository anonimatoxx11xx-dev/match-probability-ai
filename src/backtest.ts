type BTStats = {
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  homeMatches: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayMatches: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
};

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function poisson(lambda: number, k: number) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function distribution(lambda: number) {
  const p: number[] = [];
  for (let k = 0; k <= 8; k++) p.push(poisson(lambda, k));
  const s = p.reduce((a, b) => a + b, 0);
  return p.map(x => x / s);
}

function weighted(splitMatches: number, splitFor: number, splitAgainst: number, overallFor: number, overallAgainst: number) {
  const w = splitMatches <= 0 ? 0 : splitMatches / (splitMatches + 8);
  return {
    for: splitFor * w + overallFor * (1 - w),
    against: splitAgainst * w + overallAgainst * (1 - w),
  };
}

function probabilities(h: BTStats, a: BTStats) {
  const hs = weighted(h.homeMatches, h.homeGoalsFor, h.homeGoalsAgainst, h.goalsFor, h.goalsAgainst);
  const aw = weighted(a.awayMatches, a.awayGoalsFor, a.awayGoalsAgainst, a.goalsFor, a.goalsAgainst);
  const hg = clamp((hs.for * 0.55 + aw.against * 0.45) * 1.05, 0.20, 3.80);
  const ag = clamp((aw.for * 0.55 + hs.against * 0.45) * 0.95, 0.15, 3.50);
  const hd = distribution(hg), ad = distribution(ag);
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const p = hd[i] * ad[j];
    if (i > j) home += p;
    else if (i === j) draw += p;
    else away += p;
  }
  return { home, draw, away };
}

export async function runBacktest(env: { DB: D1Database }, minHistory = 3) {
  const matches = await env.DB.prepare(`
    SELECT m.id,m.league_id,m.home_team_id,m.away_team_id,m.kickoff,m.home_goals,m.away_goals,l.name AS league
    FROM matches m JOIN leagues l ON l.id=m.league_id
    WHERE m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL
    ORDER BY m.kickoff ASC, m.id ASC
  `).all<any>();

  let evaluated = 0, correct = 0, brier = 0, logLoss = 0;
  const leagues: Record<string, { evaluated: number; correct: number; brier: number; logLoss: number }> = {};

  for (const m of (matches.results || [])) {
    const before = String(m.kickoff);
    const query = `
      SELECT
        COUNT(*) AS matches,
        AVG(CASE WHEN home_team_id=? THEN home_goals ELSE away_goals END) AS goals_for,
        AVG(CASE WHEN home_team_id=? THEN away_goals ELSE home_goals END) AS goals_against,
        SUM(CASE WHEN home_team_id=? THEN 1 ELSE 0 END) AS home_matches,
        AVG(CASE WHEN home_team_id=? THEN home_goals END) AS home_goals_for,
        AVG(CASE WHEN home_team_id=? THEN away_goals END) AS home_goals_against,
        SUM(CASE WHEN away_team_id=? THEN 1 ELSE 0 END) AS away_matches,
        AVG(CASE WHEN away_team_id=? THEN away_goals END) AS away_goals_for,
        AVG(CASE WHEN away_team_id=? THEN home_goals END) AS away_goals_against
      FROM matches
      WHERE (home_team_id=? OR away_team_id=?)
        AND home_goals IS NOT NULL AND away_goals IS NOT NULL
        AND kickoff < ?
    `;

    const get = async (id: number) => {
      const r = await env.DB.prepare(query).bind(id,id,id,id,id,id,id,id,id,id,before).first<any>();
      if (!r || Number(r.matches || 0) < minHistory) return null;
      return {
        matches: Number(r.matches), goalsFor: Number(r.goals_for || 0), goalsAgainst: Number(r.goals_against || 0),
        homeMatches: Number(r.home_matches || 0), homeGoalsFor: Number(r.home_goals_for || 0), homeGoalsAgainst: Number(r.home_goals_against || 0),
        awayMatches: Number(r.away_matches || 0), awayGoalsFor: Number(r.away_goals_for || 0), awayGoalsAgainst: Number(r.away_goals_against || 0),
      } as BTStats;
    };

    const h = await get(Number(m.home_team_id));
    const a = await get(Number(m.away_team_id));
    if (!h || !a) continue;

    const p = probabilities(h, a);
    const actual = Number(m.home_goals) > Number(m.away_goals) ? 0 : Number(m.home_goals) === Number(m.away_goals) ? 1 : 2;
    const probs = [p.home, p.draw, p.away];
    const prediction = probs.indexOf(Math.max(...probs));
    if (prediction === actual) correct++;
    brier += (p.home - (actual === 0 ? 1 : 0)) ** 2 + (p.draw - (actual === 1 ? 1 : 0)) ** 2 + (p.away - (actual === 2 ? 1 : 0)) ** 2;
    logLoss += -Math.log(Math.max(probs[actual], 1e-15));
    evaluated++;

    const key = String(m.league);
    if (!leagues[key]) leagues[key] = { evaluated: 0, correct: 0, brier: 0, logLoss: 0 };
    leagues[key].evaluated++;
    if (prediction === actual) leagues[key].correct++;
    leagues[key].brier += (p.home - (actual === 0 ? 1 : 0)) ** 2 + (p.draw - (actual === 1 ? 1 : 0)) ** 2 + (p.away - (actual === 2 ? 1 : 0)) ** 2;
    leagues[key].logLoss += -Math.log(Math.max(probs[actual], 1e-15));
  }

  const leagueResults: Record<string, any> = {};
  for (const [name, x] of Object.entries(leagues)) {
    leagueResults[name] = {
      evaluated: x.evaluated,
      accuracy: x.evaluated ? x.correct / x.evaluated : 0,
      brier: x.evaluated ? x.brier / x.evaluated : 0,
      logLoss: x.evaluated ? x.logLoss / x.evaluated : 0,
    };
  }

  return {
    method: 'walk-forward',
    minHistory,
    totalMatches: (matches.results || []).length,
    evaluated,
    accuracy: evaluated ? correct / evaluated : 0,
    brier: evaluated ? brier / evaluated : 0,
    logLoss: evaluated ? logLoss / evaluated : 0,
    leagues: leagueResults,
  };
}
