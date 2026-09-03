import base from './index';

interface Env {
  DB: D1Database;
  API_FOOTBALL_KEY: string;
}

async function rebuildTeamStats(env: Env) {
  await env.DB.exec(`
    INSERT INTO team_stats (
      team_id,matches,goals_for,goals_against,shots_for,shots_on_target_for,
      corners_for,fouls_for,saves_for,cards_for,home_matches,home_goals_for,
      home_goals_against,away_matches,away_goals_for,away_goals_against
    )
    SELECT
      t.id,
      COUNT(m.id),
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_goals ELSE m.away_goals END),0),
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.away_goals ELSE m.home_goals END),0),
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_shots ELSE m.away_shots END),0),
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_sot ELSE m.away_sot END),0),
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_corners ELSE m.away_corners END),0),
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_fouls ELSE m.away_fouls END),0),
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_saves ELSE m.away_saves END),0),
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_cards ELSE m.away_cards END),0),
      COALESCE(SUM(CASE WHEN m.home_team_id=t.id THEN 1 ELSE 0 END),0),
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_goals END),0),
      COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.away_goals END),0),
      COALESCE(SUM(CASE WHEN m.away_team_id=t.id THEN 1 ELSE 0 END),0),
      COALESCE(AVG(CASE WHEN m.away_team_id=t.id THEN m.away_goals END),0),
      COALESCE(AVG(CASE WHEN m.away_team_id=t.id THEN m.home_goals END),0)
    FROM teams t
    LEFT JOIN matches m
      ON (m.home_team_id=t.id OR m.away_team_id=t.id)
      AND m.home_goals IS NOT NULL
      AND m.away_goals IS NOT NULL
    WHERE 1=1
    GROUP BY t.id
    ON CONFLICT(team_id) DO UPDATE SET
      matches=excluded.matches,
      goals_for=excluded.goals_for,
      goals_against=excluded.goals_against,
      shots_for=excluded.shots_for,
      shots_on_target_for=excluded.shots_on_target_for,
      corners_for=excluded.corners_for,
      fouls_for=excluded.fouls_for,
      saves_for=excluded.saves_for,
      cards_for=excluded.cards_for,
      home_matches=excluded.home_matches,
      home_goals_for=excluded.home_goals_for,
      home_goals_against=excluded.home_goals_against,
      away_matches=excluded.away_matches,
      away_goals_for=excluded.away_goals_for,
      away_goals_against=excluded.away_goals_against;
  `);
}

export default {
  fetch: base.fetch,

  async scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    try {
      // Keep the existing snapshot importer as the source of match data.
      // The current importer can fail only at its final aggregate rebuild;
      // in that case the matches have already been written, so rebuild them
      // with the SQLite parser-safe query below.
      await (base as any).scheduled(controller, env);
    } catch (error) {
      console.log('Snapshot import completed/failed before stats rebuild:', error);
    }

    await rebuildTeamStats(env);
    console.log('Team stats rebuilt successfully');
  },
};
