interface Env { DB: D1Database; API_FOOTBALL_KEY: string; }

type Stats = {
  matches:number; goalsFor:number; goalsAgainst:number; homeMatches:number; homeGoalsFor:number; homeGoalsAgainst:number;
  awayMatches:number; awayGoalsFor:number; awayGoalsAgainst:number;
};

function clamp(x:number,a:number,b:number){return Math.max(a,Math.min(b,x));}
function poisson(lambda:number,k:number){let p=Math.exp(-lambda);for(let i=1;i<=k;i++)p*=lambda/i;return p;}
function predict(h:Stats,a:Stats){
  const hw=h.homeMatches/(h.homeMatches+8), aw=a.awayMatches/(a.awayMatches+8);
  const hgf=h.homeMatches?h.homeGoalsFor/h.homeMatches:h.matches?h.goalsFor/h.matches:1.35;
  const hga=h.homeMatches?h.homeGoalsAgainst/h.homeMatches:h.matches?h.goalsAgainst/h.matches:1.35;
  const agf=a.awayMatches?a.awayGoalsFor/a.awayMatches:a.matches?a.goalsFor/a.matches:1.15;
  const aga=a.awayMatches?a.awayGoalsAgainst/a.awayMatches:a.matches?a.goalsAgainst/a.matches:1.15;
  const ogf=h.matches?h.goalsFor/h.matches:1.35, oga=h.matches?h.goalsAgainst/h.matches:1.35;
  const oagf=a.matches?a.goalsFor/a.matches:1.15, oaga=a.matches?a.goalsAgainst/a.matches:1.15;
  const homeFor=hgf*hw+ogf*(1-hw), homeAgainst=hga*hw+oga*(1-hw);
  const awayFor=agf*aw+oagf*(1-aw), awayAgainst=aga*aw+oaga*(1-aw);
  const lh=clamp((homeFor*.55+awayAgainst*.45)*1.05,.2,3.8), la=clamp((awayFor*.55+homeAgainst*.45)*.95,.15,3.5);
  const dh=Array.from({length:9},(_,k)=>poisson(lh,k)), da=Array.from({length:9},(_,k)=>poisson(la,k));
  const sh=dh.reduce((a,b)=>a+b,0), sa=da.reduce((a,b)=>a+b,0); let home=0,draw=0,away=0,over25=0,btts=0;
  for(let i=0;i<9;i++)for(let j=0;j<9;j++){const p=(dh[i]/sh)*(da[j]/sa);if(i>j)home+=p;else if(i===j)draw+=p;else away+=p;if(i+j>=3)over25+=p;if(i>0&&j>0)btts+=p;}
  const minMatches=Math.min(h.matches,a.matches), reliability=clamp(.35+Math.min(minMatches,30)/30*.65,.35,1);
  return {expectedGoals:{home:lh,away:la,total:lh+la},result:{home,draw,away},markets:{over25,bttsYes:btts},reliability,minMatches};
}

function romeDate(){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const y=parts.find(x=>x.type==='year')?.value,m=parts.find(x=>x.type==='month')?.value,d=parts.find(x=>x.type==='day')?.value;return `${y}-${m}-${d}`;
}

export async function todayMatches(env:Env,date:string|null){
  const day=date||romeDate();
  if(!env.API_FOOTBALL_KEY) throw new Error('API_FOOTBALL_KEY non configurata');
  const url=`https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(day)}&timezone=Europe%2FRome`;
  const r=await fetch(url,{headers:{'x-apisports-key':env.API_FOOTBALL_KEY,accept:'application/json'}});
  if(!r.ok) throw new Error(`API-Football HTTP ${r.status}`);
  const payload=await r.json() as any;
  if(Number(payload?.errors?.rateLimit)||payload?.errors?.requests) throw new Error('Limite API-Football raggiunto');
  const allowed=new Set([39,135,140,78,61,2]);
  const fixtures=Array.isArray(payload?.response)?payload.response:[];
  const teams=await env.DB.prepare('SELECT id,name,api_football_id FROM teams').all<any>();
  const byApi=new Map<number,any>();
  const byName=new Map<string,any>();
  for(const t of teams.results||[]){if(t.api_football_id!=null)byApi.set(Number(t.api_football_id),t);byName.set(String(t.name).toLowerCase(),t);}
  const out:any[]=[];
  for(const f of fixtures){
    const leagueId=Number(f.league?.id); if(!allowed.has(leagueId))continue;
    const hs=byApi.get(Number(f.teams?.home?.id))||byName.get(String(f.teams?.home?.name||'').toLowerCase());
    const as=byApi.get(Number(f.teams?.away?.id))||byName.get(String(f.teams?.away?.name||'').toLowerCase());
    let prediction=null,reason=null;
    if(hs&&as){
      const hr=await env.DB.prepare('SELECT matches,goals_for,goals_against,home_matches,home_goals_for,home_goals_against,away_matches,away_goals_for,away_goals_against FROM team_stats WHERE team_id=?').bind(Number(hs.id)).first<any>();
      const ar=await env.DB.prepare('SELECT matches,goals_for,goals_against,home_matches,home_goals_for,home_goals_against,away_matches,away_goals_for,away_goals_against FROM team_stats WHERE team_id=?').bind(Number(as.id)).first<any>();
      if(hr&&ar)prediction=predict({matches:Number(hr.matches||0),goalsFor:Number(hr.goals_for||0),goalsAgainst:Number(hr.goals_against||0),homeMatches:Number(hr.home_matches||0),homeGoalsFor:Number(hr.home_goals_for||0),homeGoalsAgainst:Number(hr.home_goals_against||0),awayMatches:Number(hr.away_matches||0),awayGoalsFor:Number(hr.away_goals_for||0),awayGoalsAgainst:Number(hr.away_goals_against||0)},{matches:Number(ar.matches||0),goalsFor:Number(ar.goals_for||0),goalsAgainst:Number(ar.goals_against||0),homeMatches:Number(ar.home_matches||0),homeGoalsFor:Number(ar.home_goals_for||0),homeGoalsAgainst:Number(ar.home_goals_against||0),awayMatches:Number(ar.away_matches||0),awayGoalsFor:Number(ar.away_goals_for||0),awayGoalsAgainst:Number(ar.away_goals_against||0)});
      else reason='Statistiche storiche insufficienti';
    } else reason='Squadra non ancora associata ai dati storici';
    out.push({fixtureId:Number(f.fixture?.id),date:f.fixture?.date,league:{id:leagueId,name:f.league?.name,country:f.league?.country},status:f.fixture?.status?.short,home:{id:hs?.id??null,name:f.teams?.home?.name},away:{id:as?.id??null,name:f.teams?.away?.name},prediction,reason});
  }
  out.sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
  return {date:day,timezone:'Europe/Rome',source:'API-Football',matches:out.length,fixtures:out};
}
