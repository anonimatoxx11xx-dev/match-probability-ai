import base from './index';

interface Env { DB: D1Database; API_FOOTBALL_KEY: string; }

function canonical(name: string) {
  const n = String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases: Record<string,string> = {
    'fc internazionale milano':'inter','internazionale milano':'inter','inter milano':'inter',
  };
  const tokens = n.split(' ').filter(Boolean).filter(x => !['fc','acf','as','ss','us','ac','calcio','football','club','1907','1909','1913','1893'].includes(x));
  return aliases[tokens.join(' ')] || tokens.join(' ');
}

async function normalizeTeams(env: Env) {
  const rows = (await env.DB.prepare('SELECT id,league_id,name,api_football_id FROM teams ORDER BY league_id,id').all<any>()).results || [];
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const key = `${r.league_id}|${canonical(r.name)}`;
    const g = groups.get(key) || []; g.push(r); groups.set(key,g);
  }
  let merged = 0;
  const ops: D1PreparedStatement[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a,b) => (a.api_football_id == null ? 1 : 0) - (b.api_football_id == null ? 1 : 0) || String(a.name).length - String(b.name).length || a.id-b.id);
    const keep = g[0];
    for (const dup of g.slice(1)) {
      if (keep.api_football_id == null && dup.api_football_id != null) {
        ops.push(env.DB.prepare('UPDATE teams SET api_football_id=? WHERE id=?').bind(dup.api_football_id, keep.id));
        keep.api_football_id = dup.api_football_id;
      }
      ops.push(env.DB.prepare('UPDATE matches SET home_team_id=? WHERE home_team_id=?').bind(keep.id, dup.id));
      ops.push(env.DB.prepare('UPDATE matches SET away_team_id=? WHERE away_team_id=?').bind(keep.id, dup.id));
      ops.push(env.DB.prepare('DELETE FROM team_stats WHERE team_id=?').bind(dup.id));
      ops.push(env.DB.prepare('DELETE FROM teams WHERE id=?').bind(dup.id));
      merged++;
    }
  }
  for (let i=0;i<ops.length;i+=100) await env.DB.batch(ops.slice(i,i+100));
  return merged;
}

async function rebuildTeamStats(env: Env) {
  await env.DB.exec('DELETE FROM team_stats;');
  const result = await env.DB.prepare(`SELECT t.id AS team_id,COUNT(m.id) AS matches,
    COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_goals ELSE m.away_goals END),0) goals_for,
    COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.away_goals ELSE m.home_goals END),0) goals_against,
    COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_shots ELSE m.away_shots END),0) shots_for,
    COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_sot ELSE m.away_sot END),0) shots_on_target_for,
    COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_corners ELSE m.away_corners END),0) corners_for,
    COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_fouls ELSE m.away_fouls END),0) fouls_for,
    COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_saves ELSE m.away_saves END),0) saves_for,
    COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_cards ELSE m.away_cards END),0) cards_for,
    COALESCE(SUM(CASE WHEN m.home_team_id=t.id THEN 1 ELSE 0 END),0) home_matches,
    COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.home_goals END),0) home_goals_for,
    COALESCE(AVG(CASE WHEN m.home_team_id=t.id THEN m.away_goals END),0) home_goals_against,
    COALESCE(SUM(CASE WHEN m.away_team_id=t.id THEN 1 ELSE 0 END),0) away_matches,
    COALESCE(AVG(CASE WHEN m.away_team_id=t.id THEN m.away_goals END),0) away_goals_for,
    COALESCE(AVG(CASE WHEN m.away_team_id=t.id THEN m.home_goals END),0) away_goals_against
    FROM teams t JOIN matches m ON (m.home_team_id=t.id OR m.away_team_id=t.id) AND m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL GROUP BY t.id`).all<any>();
  const rows = result.results || [];
  const statements = rows.map((r:any)=>env.DB.prepare(`INSERT OR REPLACE INTO team_stats(team_id,matches,goals_for,goals_against,shots_for,shots_on_target_for,corners_for,fouls_for,saves_for,cards_for,home_matches,home_goals_for,home_goals_against,away_matches,away_goals_for,away_goals_against) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(Number(r.team_id),Number(r.matches),Number(r.goals_for),Number(r.goals_against),Number(r.shots_for||0),Number(r.shots_on_target_for||0),Number(r.corners_for||0),Number(r.fouls_for||0),Number(r.saves_for||0),Number(r.cards_for||0),Number(r.home_matches||0),Number(r.home_goals_for||0),Number(r.home_goals_against||0),Number(r.away_matches||0),Number(r.away_goals_for||0),Number(r.away_goals_against||0)));
  for(let i=0;i<statements.length;i+=100) await env.DB.batch(statements.slice(i,i+100));
  return rows.length;
}

type BT={n:number;gf:number;ga:number;hn:number;hgf:number;hga:number;an:number;agf:number;aga:number};
function empty():BT{return {n:0,gf:0,ga:0,hn:0,hgf:0,hga:0,an:0,agf:0,aga:0};}
function btStats(map:Map<number,BT>,id:number){return map.get(id)||empty();}
function btPredict(h:BT,a:BT){const hgf=h.n?h.gf/h.n:1.35,hga=h.n?h.ga/h.n:1.35,agf=a.n?a.gf/a.n:1.15,aga=a.n?a.ga/a.n:1.15;const hs=h.hn?{gf:h.hgf/h.hn,ga:h.hga/h.hn}:{gf:hgf,ga:hga},as=a.an?{gf:a.agf/a.an,ga:a.aga/a.an}:{gf:agf,ga:aga};const sw=(n:number)=>n<=0?0:n/(n+8),hw=sw(h.hn),aw=sw(a.an),hf=hs.gf*hw+hgf*(1-hw),ha=hs.ga*hw+hga*(1-hw),af=as.gf*aw+agf*(1-aw),aa=as.ga*aw+aga*(1-aw),lh=Math.max(.2,Math.min(3.8,(hf*.55+aa*.45)*1.05)),la=Math.max(.15,Math.min(3.5,(af*.55+ha*.45)*.95));const p=(l:number,k:number)=>{let x=Math.exp(-l);for(let i=1;i<=k;i++)x*=l/i;return x},dh=Array.from({length:9},(_,k)=>p(lh,k)),da=Array.from({length:9},(_,k)=>p(la,k)),sh=dh.reduce((x,y)=>x+y,0),sa=da.reduce((x,y)=>x+y,0);let home=0,draw=0,away=0;for(let i=0;i<9;i++)for(let j=0;j<9;j++){const q=(dh[i]/sh)*(da[j]/sa);if(i>j)home+=q;else if(i===j)draw+=q;else away+=q}return{home,draw,away};}

async function runBacktest(env:Env,leagueName:string|null,minHistory:number){const q=leagueName?env.DB.prepare(`SELECT m.home_team_id,m.away_team_id,m.home_goals,m.away_goals,m.kickoff,l.name league FROM matches m JOIN leagues l ON l.id=m.league_id WHERE m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL AND l.name=? ORDER BY m.kickoff,m.id`).bind(leagueName):env.DB.prepare(`SELECT m.home_team_id,m.away_team_id,m.home_goals,m.away_goals,m.kickoff,l.name league FROM matches m JOIN leagues l ON l.id=m.league_id WHERE m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL ORDER BY m.kickoff,m.id`);const rows=(await q.all<any>()).results||[],history=new Map<number,BT>(),by=new Map<string,{evaluated:number;correct:number;brier:number;logLoss:number}>();for(const r of rows){const h=btStats(history,Number(r.home_team_id)),a=btStats(history,Number(r.away_team_id));if(h.n>=minHistory&&a.n>=minHistory){const p=btPredict(h,a),oh=+((+r.home_goals)>(+r.away_goals)),od=+((+r.home_goals)===(+r.away_goals)),oa=+((+r.home_goals)<(+r.away_goals)),bs=(p.home-oh)**2+(p.draw-od)**2+(p.away-oa)**2,ll=-Math.log(Math.max(oh?p.home:od?p.draw:p.away,1e-15)),k=String(r.league||'unknown'),x=by.get(k)||{evaluated:0,correct:0,brier:0,logLoss:0};x.evaluated++;x.correct+=((oh&&p.home>=p.draw&&p.home>=p.away)||(od&&p.draw>=p.home&&p.draw>=p.away)||(oa&&p.away>=p.home&&p.away>=p.draw))?1:0;x.brier+=bs;x.logLoss+=ll;by.set(k,x)}const hg=+r.home_goals,ag=+r.away_goals;h.n++;h.gf+=hg;h.ga+=ag;h.hn++;h.hgf+=hg;h.hga+=ag;history.set(+r.home_team_id,h);a.n++;a.gf+=ag;a.ga+=hg;a.an++;a.agf+=ag;a.aga+=hg;history.set(+r.away_team_id,a)}const evaluated=[...by.values()].reduce((s,x)=>s+x.evaluated,0),correct=[...by.values()].reduce((s,x)=>s+x.correct,0),brier=[...by.values()].reduce((s,x)=>s+x.brier,0),logLoss=[...by.values()].reduce((s,x)=>s+x.logLoss,0);return{method:'walk-forward',minHistory,evaluated,accuracy:evaluated?correct/evaluated:0,brier:evaluated?brier/evaluated:0,logLoss:evaluated?logLoss/evaluated:0,leagues:Object.fromEntries([...by.entries()].map(([k,x])=>[k,{evaluated:x.evaluated,accuracy:x.evaluated?x.correct/x.evaluated:0,brier:x.evaluated?x.brier/x.evaluated:0,logLoss:x.evaluated?x.logLoss/x.evaluated:0}]))};}

export default {async fetch(request:Request,env:Env,ctx:ExecutionContext){const u=new URL(request.url);if(request.method==='GET'&&['/api/teams','/api/predict','/api/backtest','/api/data/status'].includes(u.pathname)){await normalizeTeams(env);await rebuildTeamStats(env)}if(request.method==='GET'&&u.pathname==='/api/predict'){const home=Number(u.searchParams.get('home')),away=Number(u.searchParams.get('away'));if(!Number.isInteger(home)||!Number.isInteger(away)||home<=0||away<=0)return new Response(JSON.stringify({error:'Usa /api/predict?home=ID&away=ID'}),{status:400,headers:{'content-type':'application/json'}});return base.fetch(new Request(request.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({homeTeamId:home,awayTeamId:away})}),env,ctx)}if(request.method==='GET'&&u.pathname==='/api/backtest'){const minHistory=Math.max(3,Math.min(20,Number(u.searchParams.get('minHistory')||5)));return new Response(JSON.stringify(await runBacktest(env,u.searchParams.get('league'),minHistory),null,2),{headers:{'content-type':'application/json;charset=UTF-8','access-control-allow-origin':'*'}})}return base.fetch(request,env,ctx)},async scheduled(controller:ScheduledController,env:Env,ctx:ExecutionContext){await(base as any).scheduled(controller,env,ctx);await normalizeTeams(env);await rebuildTeamStats(env)}};