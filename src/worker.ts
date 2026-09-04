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

type BT = { n: number; gf: number; ga: number; hn: number; hgf: number; hga: number; an: number; agf: number; aga: number };

function btStats(map: Map<number, BT>, id: number) {
  return map.get(id) || { n: 0, gf: 0, ga: 0, hn: 0, hgf: 0, hga: 0, an: 0, agf: 0, aga: 0 };
}

function btPredict(h: BT, a: BT) {
  const hgf = h.n ? h.gf / h.n : 1.35;
  const hga = h.n ? h.ga / h.n : 1.35;
  const agf = a.n ? a.gf / a.n : 1.15;
  const aga = a.n ? a.ga / a.n : 1.15;
  const hs = h.hn ? { gf: h.hgf / h.hn, ga: h.hga / h.hn } : { gf: hgf, ga: hga };
  const as = a.an ? { gf: a.agf / a.an, ga: a.aga / a.an } : { gf: agf, ga: aga };
  const sw = (n: number) => n <= 0 ? 0 : n / (n + 8);
  const hHomeW = sw(h.hn), aAwayW = sw(a.an);
  const homeFor = hs.gf * hHomeW + hgf * (1 - hHomeW);
  const homeAgainst = hs.ga * hHomeW + hga * (1 - hHomeW);
  const awayFor = as.gf * aAwayW + agf * (1 - aAwayW);
  const awayAgainst = as.ga * aAwayW + aga * (1 - aAwayW);
  const lambdaH = Math.max(0.20, Math.min(3.80, (homeFor * 0.55 + awayAgainst * 0.45) * 1.05));
  const lambdaA = Math.max(0.15, Math.min(3.50, (awayFor * 0.55 + homeAgainst * 0.45) * 0.95));
  const p = (l: number, k: number) => { let x = Math.exp(-l); for (let i=1;i<=k;i++) x*=l/i; return x; };
  const dH = Array.from({length:9},(_,k)=>p(lambdaH,k));
  const dA = Array.from({length:9},(_,k)=>p(lambdaA,k));
  const sh = dH.reduce((x,y)=>x+y,0), sa = dA.reduce((x,y)=>x+y,0);
  let home=0, draw=0, away=0;
  for(let i=0;i<9;i++) for(let j=0;j<9;j++) { const q=(dH[i]/sh)*(dA[j]/sa); if(i>j)home+=q; else if(i===j)draw+=q; else away+=q; }
  return { home, draw, away };
}

async function runBacktest(env: Env, leagueName: string | null, minHistory: number) {
  const q = leagueName
    ? env.DB.prepare(`SELECT m.league_id,m.home_team_id,m.away_team_id,m.home_goals,m.away_goals,m.kickoff,l.name league FROM matches m JOIN leagues l ON l.id=m.league_id WHERE m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL AND l.name=? ORDER BY m.kickoff,m.id`).bind(leagueName)
    : env.DB.prepare(`SELECT m.league_id,m.home_team_id,m.away_team_id,m.home_goals,m.away_goals,m.kickoff,l.name league FROM matches m JOIN leagues l ON l.id=m.league_id WHERE m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL ORDER BY m.kickoff,m.id`);
  const rows = (await q.all<any>()).results || [];
  const history = new Map<number,BT>();
  let evaluated=0, correct=0, brier=0, logLoss=0;
  const byLeague = new Map<string,{evaluated:number;correct:number;brier:number;logLoss:number}>();

  for (const r of rows) {
    const h = btStats(history, Number(r.home_team_id));
    const a = btStats(history, Number(r.away_team_id));
    if (h.n >= minHistory && a.n >= minHistory) {
      const pred = btPredict(h,a);
      const oh = Number(r.home_goals) > Number(r.away_goals) ? 1 : 0;
      const od = Number(r.home_goals) === Number(r.away_goals) ? 1 : 0;
      const oa = Number(r.home_goals) < Number(r.away_goals) ? 1 : 0;
      const bs = (pred.home-oh)**2 + (pred.draw-od)**2 + (pred.away-oa)**2;
      const actual = oh ? pred.home : od ? pred.draw : pred.away;
      const ll = -Math.log(Math.max(actual, 1e-15));
      const key = String(r.league || 'unknown');
      const x = byLeague.get(key) || {evaluated:0,correct:0,brier:0,logLoss:0};
      x.evaluated++; x.correct += (oh && pred.home>=pred.draw && pred.home>=pred.away) || (od && pred.draw>=pred.home && pred.draw>=pred.away) || (oa && pred.away>=pred.home && pred.away>=pred.draw) ? 1 : 0;
      x.brier += bs; x.logLoss += ll; byLeague.set(key,x);
      evaluated++; correct += x.correct - (byLeague.get(key)!.correct - 0); // corrected below by aggregate update
      brier += bs; logLoss += ll;
    }
    const hg=Number(r.home_goals), ag=Number(r.away_goals);
    h.n++; h.gf+=hg; h.ga+=ag; h.hn++; h.hgf+=hg; h.hga+=ag; history.set(Number(r.home_team_id),h);
    a.n++; a.gf+=ag; a.ga+=hg; a.an++; a.agf+=ag; a.aga+=hg; history.set(Number(r.away_team_id),a);
  }

  // Recompute accuracy from per-league counters to avoid stateful increment ambiguity.
  correct = [...byLeague.values()].reduce((s,x)=>s+x.correct,0);
  const leagues = Object.fromEntries([...byLeague.entries()].map(([k,x])=>[k,{evaluated:x.evaluated,accuracy:x.evaluated?x.correct/x.evaluated:0,brier:x.evaluated?x.brier/x.evaluated:0,logLoss:x.evaluated?x.logLoss/x.evaluated:0}]));
  return {method:'walk-forward',minHistory,evaluated,accuracy:evaluated?correct/evaluated:0,brier:evaluated?brier/evaluated:0,logLoss:evaluated?logLoss/evaluated:0,leagues};
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const u = new URL(request.url);

    if (request.method === 'GET' && u.pathname === '/api/predict') {
      const homeTeamId = Number(u.searchParams.get('home'));
      const awayTeamId = Number(u.searchParams.get('away'));
      if (!Number.isInteger(homeTeamId) || !Number.isInteger(awayTeamId) || homeTeamId <= 0 || awayTeamId <= 0) {
        return new Response(JSON.stringify({ error: 'Usa /api/predict?home=ID&away=ID' }), { status:400, headers:{'content-type':'application/json;charset=UTF-8','access-control-allow-origin':'*'} });
      }
      const body = JSON.stringify({ homeTeamId, awayTeamId });
      return base.fetch(new Request(request.url,{method:'POST',headers:{'content-type':'application/json'},body}),env,ctx);
    }

    if (request.method === 'GET' && u.pathname === '/api/backtest') {
      const minHistory = Math.max(3, Math.min(20, Number(u.searchParams.get('minHistory') || 5)));
      const league = u.searchParams.get('league');
      return new Response(JSON.stringify(await runBacktest(env, league, minHistory), null, 2), {headers:{'content-type':'application/json;charset=UTF-8','access-control-allow-origin':'*'}});
    }

    return base.fetch(request, env, ctx);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    await (base as any).scheduled(controller, env, ctx);
    await rebuildTeamStats(env);
  },
};
