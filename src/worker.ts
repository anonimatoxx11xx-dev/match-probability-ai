import base from './index';

interface Env {
  DB: D1Database;
  API_FOOTBALL_KEY: string;
}

async function rebuildTeamStats(env: Env) {
  await env.DB.exec('DELETE FROM team_stats;');

  const result = await env.DB.prepare(`
    SELECT
      t.id AS team_id,
      COUNT(m.id) AS matches,
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_goals ELSE m.away_goals END),0) AS goals_for,
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.away_goals ELSE m.home_goals END),0) AS goals_against,
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_shots ELSE m.away_shots END),0) AS shots_for,
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_sot ELSE m.away_sot END),0) AS shots_on_target_for,
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_corners ELSE m.away_corners END),0) AS corners_for,
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_fouls ELSE m.away_fouls END),0) AS fouls_for,
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_saves ELSE m.away_saves END),0) AS saves_for,
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_cards ELSE m.away_cards END),0) AS cards_for,
      COALESCE(SUM(CASE WHEN m.home_team_id=t.id THEN 1 ELSE 0 END),0) AS home_matches,
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_goals END),0) AS home_goals_for,
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.away_goals END),0) AS home_goals_against,
      COALESCE(SUM(CASE WHEN m.away_team_id=t.id THEN 1 ELSE 0 END),0) AS away_matches,
      COALESCE(AVG(CASE WHEN m.away_team_id=t.id THEN m.away_goals END),0) AS away_goals_for,
      COALESCE(AVG(CASE WHEN m.away_team_id=t.id THEN m.home_goals END),0) AS away_goals_against
    FROM teams t
    JOIN matches m
      ON (m.home_team_id=t.id OR m.away_team_id=t.id)
     AND m.home_goals IS NOT NULL
     AND m.away_goals IS NOT NULL
    GROUP BY t.id
  `).all<any>();

  const rows = result.results || [];
  const statements: D1PreparedStatement[] = rows.map((r: any) =>
    env.DB.prepare(`
      INSERT OR REPLACE INTO team_stats (
        team_id,matches,goals_for,goals_against,shots_for,shots_on_target_for,
        corners_for,fouls_for,saves_for,cards_for,home_matches,home_goals_for,
        home_goals_against,away_matches,away_goals_for,away_goals_against
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      Number(r.team_id), Number(r.matches), Number(r.goals_for), Number(r.goals_against),
      Number(r.shots_for || 0), Number(r.shots_on_target_for || 0), Number(r.corners_for || 0),
      Number(r.fouls_for || 0), Number(r.saves_for || 0), Number(r.cards_for || 0),
      Number(r.home_matches || 0), Number(r.home_goals_for || 0), Number(r.home_goals_against || 0),
      Number(r.away_matches || 0), Number(r.away_goals_for || 0), Number(r.away_goals_against || 0),
    )
  );

  for (let i = 0; i < statements.length; i += 100) {
    await env.DB.batch(statements.slice(i, i + 100));
  }

  console.log(`Team stats rebuilt successfully: ${rows.length} teams`);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const u = new URL(request.url);

    // Browser-friendly GET wrapper for quick backend verification.
    // The real Android API remains POST /api/predict and POST /api/simulate.
    if (request.method === 'GET' && u.pathname === '/api/predict') {
      const homeTeamId = Number(u.searchParams.get('home'));
      const awayTeamId = Number(u.searchParams.get('away'));
      if (!Number.isInteger(homeTeamId) || !Number.isInteger(awayTeamId) || homeTeamId <= 0 || awayTeamId <= 0) {
        return new Response(JSON.stringify({ error: 'Usa /api/predict?home=ID&away=ID' }), {
          status: 400,
          headers: { 'content-type': 'application/json;charset=UTF-8', 'access-control-allow-origin': '*' },
        });
      }

      const body = JSON.stringify({ homeTeamId, awayTeamId });
      return base.fetch(new Request(request.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }), env, ctx);
    }

    return base.fetch(request, env, ctx);
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    await rebuildTeamStats(env);
  },
};
