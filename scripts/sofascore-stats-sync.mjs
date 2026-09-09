const BASE = 'https://www.sofascore.com/api/v1';
const delayMs = Number(process.env.SOFASCORE_DELAY_MS || 650);
const inputPath = process.env.SOFASCORE_INPUT || '/tmp/current.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const stop = new Set(['fc','cf','afc','sc','ac','calcio','club','the','de','of','fk','sk','sv','vfb','rb','bk','if','ik']);
const tokens = s => norm(s).split(' ').filter(x => x && !stop.has(x));

function teamScore(a,b){
  const na=norm(a), nb=norm(b); if(!na||!nb)return 0;
  if(na===nb)return 100; if(na.includes(nb)||nb.includes(na))return 92;
  const ta=new Set(tokens(a)), tb=new Set(tokens(b)); let common=0;
  for(const t of ta)if(tb.has(t))common++;
  const ratio=common/Math.max(ta.size,tb.size);
  return ratio>=0.75?88:ratio>=0.5?72:ratio>=0.34?55:0;
}
function matchScore(f,e){
  const direct=teamScore(f.home?.name,e.homeTeam?.name)+teamScore(f.away?.name,e.awayTeam?.name);
  const reverse=teamScore(f.home?.name,e.awayTeam?.name)+teamScore(f.away?.name,e.homeTeam?.name);
  return Math.max(direct,reverse);
}
async function getJson(url){
  const r=await fetch(url,{headers:{accept:'application/json','User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36',referer:'https://www.sofascore.com/'}});
  if(r.status===404)return null;
  if(!r.ok)throw new Error(`SofaScore HTTP ${r.status}`);
  return r.json();
}
function num(v){if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace('%','').replace(',','.'));return Number.isFinite(n)?n:null;}
function items(payload){const out=[];for(const p of payload?.statistics||[]){if(String(p?.period||'').toUpperCase()!=='ALL')continue;for(const g of p.groups||[])for(const i of g.statisticsItems||[])out.push(i);}return out;}
function pick(xs,names){const wanted=names.map(norm);const x=xs.find(i=>wanted.includes(norm(i.name))||wanted.includes(norm(i.key)));return x?{home:num(x.home),away:num(x.away)}:{home:null,away:null};}
function parseStats(payload){const xs=items(payload);const s=pick(xs,['Total shots','Shots']);const sot=pick(xs,['Shots on target','Shots on goal']);const c=pick(xs,['Corner kicks','Corners']);const f=pick(xs,['Fouls']);const sv=pick(xs,['Goalkeeper saves','Saves']);const y=pick(xs,['Yellow cards']);return{home:{shots:s.home,sot:sot.home,corners:c.home,fouls:f.home,saves:sv.home,cards:y.home},away:{shots:s.away,sot:sot.away,corners:c.away,fouls:f.away,saves:sv.away,cards:y.away}};}
function hasAny(s){return Object.values(s.home||{}).some(Number.isFinite)||Object.values(s.away||{}).some(Number.isFinite);}

const fs=await import('node:fs/promises');
const snapshot=JSON.parse(await fs.readFile(inputPath,'utf8'));
const fixtures=Array.isArray(snapshot.fixtures)?snapshot.fixtures:[];
const byDate=new Map();
for(const f of fixtures){const d=String(f.kickoff||'').slice(0,10);if(d){if(!byDate.has(d))byDate.set(d,[]);byDate.get(d).push(f);}}
const eventsByDate=new Map();
for(const date of byDate.keys()){
  try{const data=await getJson(`${BASE}/sport/football/scheduled-events/${date}`);eventsByDate.set(date,data?.events||[]);console.error(`sofascore-date=${date} events=${data?.events?.length||0}`);}catch(e){eventsByDate.set(date,[]);console.error(`sofascore-date=${date} error=${e.message}`);}
  await sleep(delayMs);
}

let matched=0,enriched=0,failed=0;
const out=[];
for(const f of fixtures){
  const date=String(f.kickoff||'').slice(0,10), events=eventsByDate.get(date)||[];
  let best=null,bestScore=0;
  for(const e of events){if(e?.status?.type&& !['finished','afterpenalties','afterextra'].includes(String(e.status.type).toLowerCase()))continue;const score=matchScore(f,e);if(score>bestScore){bestScore=score;best=e;}}
  let row={...f};
  if(best&&bestScore>=130&&best.id){matched++;try{const data=await getJson(`${BASE}/event/${best.id}/statistics`);const stats=parseStats(data);if(hasAny(stats)){row={...row,stats,statsSource:'sofascore',sofascoreEventId:best.id};enriched++;}else failed++;}catch(e){failed++;console.error(`sofascore-stats fixture=${f.fixtureId} event=${best.id} error=${e.message}`);}await sleep(delayMs);}
  out.push(row);
}
out.sort((a,b)=>String(a.kickoff).localeCompare(String(b.kickoff)));
await fs.writeFile(inputPath,JSON.stringify({...snapshot,generatedAt:new Date().toISOString(),mode:'historical-bootstrap-sofascore-stats-primary',statsSourcePriority:['sofascore','api-football','none'],fixtures:out},null,2));
console.error(`SofaScore enrichment: fixtures=${out.length} matched=${matched} enriched=${enriched} failedStats=${failed}`);
