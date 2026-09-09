import './style.css';

const app = document.querySelector('#app');
const FOTMOB = 'https://www.fotmob.com';
const SOFA = 'https://www.sofascore.com/api/v1';
const state = { loading:false, fixtures:[], source:'', error:null };

const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
const pct = x => `${(Number(x || 0) * 100).toFixed(1)}%`;
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const num = x => {
  if (x && typeof x === 'object') {
    if (x.value !== undefined) return num(x.value);
    if (x.homeValue !== undefined) return num(x.homeValue);
  }
  const s = String(x ?? '').replace('%','').replace(',','.');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) ? n : null;
};
function dateRome(){
  const p = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const o=Object.fromEntries(p.map(x=>[x.type,x.value])); return `${o.year}${o.month}${o.day}`;
}
function dateIsoRome(){ const s=dateRome(); return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}`; }
async function get(url){
  const r=await fetch(url,{headers:{Accept:'application/json'}});
  const t=await r.text(); let d; try{d=JSON.parse(t)}catch{throw new Error(`JSON non valido ${r.status}`)}
  if(!r.ok) throw new Error(`${r.status} ${url}`); return d;
}
function poisson(k,l){ return Math.exp(-l)*Math.pow(l,k)/fact(k); }
const fact=n=>{let x=1;for(let i=2;i<=n;i++)x*=i;return x};
function prediction(home,away){
  const h=home.form, a=away.form;
  let lh = 1.52, la = 1.12;
  if(h.n) lh = 0.45*lh + 0.55*((h.gf/h.n)*0.72 + (a.n ? (a.ga/a.n)*0.28 : 1.1));
  if(a.n) la = 0.45*la + 0.55*((a.gf/a.n)*0.72 + (h.n ? (h.ga/h.n)*0.28 : 1.0));
  lh=clamp(lh,0.35,3.8); la=clamp(la,0.30,3.2);
  const cells=[];let sum=0,ph=0,pd=0,pa=0;
  for(let i=0;i<=7;i++)for(let j=0;j<=7;j++){const p=poisson(i,lh)*poisson(j,la);sum+=p;cells.push([i,j,p]);if(i>j)ph+=p;else if(i===j)pd+=p;else pa+=p;}
  ph/=sum;pd/=sum;pa/=sum;
  const total=lh+la;
  const under=t=>Math.exp(-total)*Array.from({length:t+1},(_,k)=>Math.pow(total,k)/fact(k)).reduce((a,b)=>a+b,0);
  const over=t=>1-under(t);
  const btts=1-Math.exp(-lh)-Math.exp(-la)+Math.exp(-total);
  return {home:lh,away:la,total,result:{home:ph,draw:pd,away:pa},markets:{over05:over(0),under05:under(0),over15:over(1),under15:under(1),over25:over(2),under25:under(2),over35:over(3),under35:under(3),over45:over(4),under45:under(4),bttsYes:btts,bttsNo:1-btts},doubleChance:{'1X':ph+pd,X2:pd+pa,'12':ph+pa},drawNoBet:{home:ph/(ph+pa),away:pa/(ph+pa)},correctScores:cells.sort((x,y)=>y[2]-x[2]).slice(0,5).map(x=>({score:`${x[0]}-${x[1]}`,probability:x[2]/sum}))};
}
function normalize(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/fc|afc|sk|club|calcio|rotterdam/g,'').replace(/[^a-z0-9]/g,'');}
function sameTeam(a,b){const x=normalize(a),y=normalize(b);return x===y||x.includes(y)||y.includes(x);}
function emptyForm(){return {n:0,gf:0,ga:0,results:[],stats:[],statSource:'N/D'};}
function addResult(form,gf,ga,home,matchId,utcTime,opponent){
  form.n++;form.gf+=gf;form.ga+=ga;form.results.push({gf,ga,home,matchId,utcTime:utcTime||null,opponent:opponent||''});
}
function extractFixtures(payload){
  const out=[]; for(const lg of (payload?.leagues||[])) for(const m of (lg.matches||[])) out.push({id:m.id,league:lg.name||m.leagueName||'Calcio',time:m.time,status:m.status,home:{id:m.home?.id,name:m.home?.name},away:{id:m.away?.id,name:m.away?.name}});
  return out;
}
async function fotmobToday(){ return extractFixtures(await get(`${FOTMOB}/api/matches?date=${dateRome()}`)); }
function walkMatches(obj,out=[]){
  if(!obj||typeof obj!=='object')return out;
  if(Array.isArray(obj)){for(const x of obj)walkMatches(x,out);return out}
  if(obj.home?.name&&obj.away?.name&&(obj.id||obj.matchId))out.push(obj);
  for(const [k,v] of Object.entries(obj)){if(['squad','players','transfers'].includes(k))continue;walkMatches(v,out)}
  return out;
}

/* FotMob matchDetails.stats is grouped: Periods.All.stats[] -> groups -> group.stats[] -> stat rows. */
function statRows(payload){
  const groups=payload?.content?.stats?.Periods?.All?.stats;
  if(!Array.isArray(groups)) return [];
  const rows=[];
  for(const group of groups){
    if(Array.isArray(group?.stats)) {
      for(const row of group.stats) rows.push(row);
    } else if(group && (group.title||group.key||group.name)) rows.push(group);
  }
  return rows;
}
function statKey(value){
  const raw=String(value||'').toLowerCase();
  const t=raw.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  const compact=t.replace(/[^a-z0-9]/g,'');
  if(/shotsontarget|shotsongoal|ontarget|shots on target|shots on goal|tiri in porta/.test(t)||/shotsontarget|shotsongoal|ontarget/.test(compact)) return 'shotsOnTarget';
  if(/total shots|shots total|shot attempts|tiri totali|tiri$/.test(t)||compact==='shots'||compact==='totalshots'||compact==='shotattempts') return 'shots';
  if(/corners|corner kicks|corner|calci d'angolo/.test(t)||compact==='cornerkicks'||compact==='corners') return 'corners';
  if(/fouls|total fouls|falli/.test(t)||compact==='fouls'||compact==='totalfouls') return 'fouls';
  if(/yellow cards|yellow card|yellow|ammonizioni|cartellini gialli/.test(t)||compact==='yellowcards'||compact==='yellowcard') return 'yellow';
  if(/offsides|offside|fuorigioco/.test(t)||compact==='offsides'||compact==='offside') return 'offsides';
  if(/big chances|big chance/.test(t)||compact==='bigchances'||compact==='bigchance') return 'bigChances';
  if(/expected goals|expected goal|xg/.test(t)||compact==='expectedgoals'||compact==='expectedgoal') return 'xg';
  return null;
}
function parseMatchStats(payload,teamName){
  const rows=statRows(payload), out={};
  const homeName=payload?.general?.homeTeam?.name||payload?.header?.teams?.[0]?.name||'';
  const awayName=payload?.general?.awayTeam?.name||payload?.header?.teams?.[1]?.name||'';
  const isHome=sameTeam(homeName,teamName), isAway=sameTeam(awayName,teamName);
  if(!isHome&&!isAway) return out;
  for(const row of rows){
    const key=statKey(row?.title||row?.key||row?.name); const vals=row?.stats;
    if(!key||!Array.isArray(vals)||vals.length<2)continue;
    const h=num(vals[0]),a=num(vals[1]);
    if(h===null||a===null)continue;
    out[key]=isHome?h:a;
  }
  return out;
}
const fotmobStatCache=new Map();
async function fotmobMatchStats(matchId,teamName){
  const cacheKey=`${matchId}:${normalize(teamName)}`;
  if(fotmobStatCache.has(cacheKey)) return fotmobStatCache.get(cacheKey);
  let result=null;
  try{
    const p=await get(`${FOTMOB}/api/data/matchDetails?matchId=${encodeURIComponent(matchId)}`);
    const stats=parseMatchStats(p,teamName);
    result=Object.keys(stats).length?stats:null;
  }catch(e){ result=null; }
  fotmobStatCache.set(cacheKey,result);
  return result;
}
function sofaStatRows(payload){
  const all=(payload?.statistics||[]).find(x=>String(x?.period||'').toUpperCase()==='ALL') || payload?.statistics?.[0];
  const groups=all?.groups;
  if(!Array.isArray(groups)) return [];
  return groups.flatMap(g=>Array.isArray(g?.statisticsItems)?g.statisticsItems:[]);
}
function parseSofaStats(payload,teamName){
  const event=payload?.event||payload;
  const homeName=event?.homeTeam?.name||'', awayName=event?.awayTeam?.name||'';
  const isHome=sameTeam(homeName,teamName), isAway=sameTeam(awayName,teamName);
  if(!isHome&&!isAway) return {};
  const out={};
  for(const row of sofaStatRows(payload)){
    const key=statKey(row?.key||row?.name||row?.title); if(!key) continue;
    const h=row?.homeValue!==undefined?num(row.homeValue):num(row.home);
    const a=row?.awayValue!==undefined?num(row.awayValue):num(row.away);
    if(h===null||a===null) continue;
    out[key]=isHome?h:a;
  }
  return out;
}
const sofaStatCache=new Map();
async function sofaMatchStats(eventId,teamName,meta=null){
  const cacheKey=`${eventId}:${normalize(teamName)}`;
  if(sofaStatCache.has(cacheKey)) return sofaStatCache.get(cacheKey);
  let result=null;
  try{
    const p=await get(`${SOFA}/event/${encodeURIComponent(eventId)}/statistics`);
    const event={homeTeam:{name:meta?.home?teamName:(meta?.opponent||'')},awayTeam:{name:meta?.home?(meta?.opponent||''):teamName}};
    const stats=parseSofaStats({...p,event},teamName);
    result=Object.keys(stats).length?stats:null;
  }catch(e){result=null}
  sofaStatCache.set(cacheKey,result);
  return result;
}
async function sofaSearch(name){
  const p=await get(`${SOFA}/search/all?q=${encodeURIComponent(name)}`);
  const teams=(p?.results||[]).filter(x=>x?.entity?.id);
  const hit=teams.find(x=>sameTeam(x.entity?.name,name))||teams[0]; return hit?.entity?.id||null;
}
async function sofaRecentEvents(id,name){
  const out=[],seen=new Set();
  for(let page=0;page<3&&out.length<10;page++){
    const p=await get(`${SOFA}/team/${id}/events/last/${page}`);
    for(const m of (p.events||[])){
      if(m.status?.type!=='finished')continue;
      const mid=String(m.id);if(seen.has(mid))continue;seen.add(mid);
      const hn=m.homeTeam?.name||'',an=m.awayTeam?.name||'';
      const ts=m.startTimestamp?new Date(m.startTimestamp*1000).toISOString():null;
      if(sameTeam(hn,name)) out.push({matchId:mid,home:true,opponent:an,utcTime:ts});
      else if(sameTeam(an,name)) out.push({matchId:mid,home:false,opponent:hn,utcTime:ts});
      if(out.length>=10)break;
    }
  }
  return out;
}
async function sofaTeam(id,name){
  try{
    const form=emptyForm(),events=await sofaRecentEvents(id,name);
    for(const e of events){
      const p=await get(`${SOFA}/event/${e.matchId}`),m=p?.event;
      const hs=num(m?.homeScore?.current??m?.homeScore?.display),as=num(m?.awayScore?.current??m?.awayScore?.display);
      if(hs===null||as===null)continue;
      if(e.home)addResult(form,hs,as,true,e.matchId,e.utcTime,e.opponent); else addResult(form,as,hs,false,e.matchId,e.utcTime,e.opponent);
      if(form.n>=10)break;
    }
    const stats=await Promise.all(form.results.slice(-5).reverse().map(r=>sofaMatchStats(r.matchId,name,r)));
    form.stats=stats.filter(Boolean); form.statSummary=aggregateStats(form.stats); form.statSource=form.stats.length?'SofaScore':'N/D';
    if(form.n>=2)return {form,source:'SofaScore',teamId:id};
  }catch(e){}
  return null;
}
function aggregateStats(items){
  const keys=['shots','shotsOnTarget','corners','fouls','yellow','offsides','bigChances','xg'];
  const out={};
  for(const key of keys){
    const vals=items.map(x=>num(x?.[key])).filter(x=>x!==null); if(!vals.length)continue;
    const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
    const variance=vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length;
    out[key]={n:vals.length,mean,sd:Math.sqrt(variance),values:vals};
  }
  return out;
}
function findSofaMatch(sofaEvents,r){
  const rt=r.utcTime?new Date(r.utcTime).getTime():0;
  const candidates=sofaEvents.filter(e=>e.home===r.home && (!rt || !e.utcTime || Math.abs(new Date(e.utcTime).getTime()-rt)<=3*86400000));
  if(!candidates.length) return null;
  return candidates.sort((a,b)=>{
    const da=rt&&a.utcTime?Math.abs(new Date(a.utcTime).getTime()-rt):Number.MAX_SAFE_INTEGER;
    const db=rt&&b.utcTime?Math.abs(new Date(b.utcTime).getTime()-rt):Number.MAX_SAFE_INTEGER;
    return da-db;
  })[0];
}
async function enrichFormStats(form,name){
  const recent=form.results.slice(-5).reverse();
  const fotStats=await Promise.all(recent.map(r=>fotmobMatchStats(r.matchId,name)));
  let sofaEvents=[];
  try{
    const sid=await sofaSearch(name);
    if(sid) sofaEvents=await sofaRecentEvents(sid,name);
  }catch(e){}
  const combined=[];
  for(let i=0;i<recent.length;i++){
    if(fotStats[i]) { combined.push(fotStats[i]); continue; }
    const r=recent[i];
    let target=findSofaMatch(sofaEvents,r);
    if(!target) target=sofaEvents.find(e=>sameTeam(e.opponent,r.opponent) && (!r.utcTime || !e.utcTime || Math.abs(new Date(e.utcTime)-new Date(r.utcTime))<=3*86400000));
    if(target){
      const s=await sofaMatchStats(target.matchId,name,target);
      if(s) combined.push(s);
    }
  }
  form.stats=combined; form.statSummary=aggregateStats(combined);
  const fotCount=fotStats.filter(Boolean).length, sofaCount=Math.max(0,combined.length-fotCount);
  form.statSource=fotCount&&sofaCount?'FotMob+SofaScore':fotCount?'FotMob':sofaCount?'SofaScore':'N/D';
  return form;
}
async function fotmobTeam(id,name){
  try{
    const p=await get(`${FOTMOB}/api/data/teams?id=${encodeURIComponent(id)}`);
    const ms=walkMatches(p,[]).filter(m=>m.status?.finished===true || m.status?.type==='finished' || m.finished===true);
    const seen=new Set(), form=emptyForm();
    ms.sort((a,b)=>new Date(b.status?.utcTime||b.utcTime||0)-new Date(a.status?.utcTime||a.utcTime||0));
    for(const m of ms){
      const mid=String(m.id||m.matchId);if(seen.has(mid))continue;seen.add(mid);
      const hn=m.home?.name||'',an=m.away?.name||'',hs=num(m.home?.score??m.homeScore),as=num(m.away?.score??m.awayScore);let gf,ga,ishome;
      if(sameTeam(hn,name)){gf=hs??0;ga=as??0;ishome=true}else if(sameTeam(an,name)){gf=as??0;ga=hs??0;ishome=false}else continue;
      if(Number.isFinite(gf)&&Number.isFinite(ga))addResult(form,gf,ga,ishome,mid,m.status?.utcTime||m.utcTime,ishome?an:hn);
      if(form.n>=10)break;
    }
    if(form.n>=2)return {form:await enrichFormStats(form,name),source:'FotMob',teamId:id};
  }catch(e){}
  return null;
}
async function history(team){
  if(team.id){const f=await fotmobTeam(team.id,team.name);if(f)return f;}
  try{const sid=await sofaSearch(team.name);if(sid){const s=await sofaTeam(sid,team.name);if(s)return s;}}catch(e){}
  return {form:emptyForm(),source:'N/D',teamId:team.id||null};
}
function totalStatRange(home,away,key){
  const ownH=home?.statSummary?.[key], ownA=away?.statSummary?.[key]; if(!ownH&&!ownA)return null;
  const mean=(ownH?.mean||0)+(ownA?.mean||0), sd=Math.sqrt((ownH?.sd||0)**2+(ownA?.sd||0)**2), width=Math.max(1.5,sd*.75,mean*.10);
  return {min:Math.max(0,Math.round(mean-width)),max:Math.max(0,Math.round(mean+width)),mean};
}
function rangeText(r){return r?`${r.min}-${r.max}`:'N/D'}
function statPrediction(home,away){return {shots:totalStatRange(home,away,'shots'),shotsOnTarget:totalStatRange(home,away,'shotsOnTarget'),corners:totalStatRange(home,away,'corners'),fouls:totalStatRange(home,away,'fouls'),yellow:totalStatRange(home,away,'yellow'),offsides:totalStatRange(home,away,'offsides'),bigChances:totalStatRange(home,away,'bigChances'),xg:totalStatRange(home,away,'xg')};}
async function build(){
  state.loading=true;state.error=null;render();
  try{
    const all=await fotmobToday(), fixtures=all.filter(x=>/champions league/i.test(x.league||'')), unique=fixtures.filter((x,i,a)=>a.findIndex(y=>String(y.id)===String(x.id))===i);
    state.fixtures=await Promise.all(unique.slice(0,12).map(async f=>{const [h,a]=await Promise.all([history(f.home),history(f.away)]);const p=prediction(h,a);p.stats=statPrediction(h.form,a.form);const reliability=clamp((Math.min(h.form.n,10)+Math.min(a.form.n,10))/20,0,1);return {...f,history:{home:h,away:a},prediction:p,reliability};}));
    state.source='FotMob calendario + FotMob/SofaScore cronologia + statistiche match FotMob/SofaScore';
  }catch(e){state.error=e;state.fixtures=[];state.source=''}
  state.loading=false;render();
}
function time(v){try{return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return '--:--'}}
function card(f){
  const p=f.prediction,q=f.history,r=p.result,st=p.stats,historyCount=Math.min(q.home.form.n,10)+Math.min(q.away.form.n,10),statCount=(q.home.form.stats?.length||0)+(q.away.form.stats?.length||0),statSources=[q.home.form.statSource,q.away.form.statSource].filter(x=>x&&x!=='N/D'),sourceLabel=[...new Set(statSources)].join('+')||'N/D';
  return `<article class="match-card"><div class="match-meta">${esc(f.league)} · ${time(f.status?.utcTime||f.time)} · TEST APK DIRETTO</div><div class="teams-line"><strong>${esc(f.home.name)}</strong><span>VS</span><strong>${esc(f.away.name)}</strong></div><div class="today-prob"><span>1 <b>${pct(r.home)}</b></span><span>X <b>${pct(r.draw)}</b></span><span>2 <b>${pct(r.away)}</b></span></div><div class="pick">Gol attesi <b>${p.home.toFixed(2)}-${p.away.toFixed(2)}</b> · Gol totali <b>${Math.max(0,Math.round(p.total-.7))}-${Math.round(p.total+1.0)}</b></div><div class="quality">Casa: <b>${q.home.form.n}</b> gare (${esc(q.home.source)}) · Trasferta: <b>${q.away.form.n}</b> gare (${esc(q.away.source)})</div><h4>Range statistiche previste</h4><div class="stat-grid compact"><div><span>Tiri totali</span><b>${rangeText(st.shots)}</b></div><div><span>Tiri in porta</span><b>${rangeText(st.shotsOnTarget)}</b></div><div><span>Corner</span><b>${rangeText(st.corners)}</b></div><div><span>Falli</span><b>${rangeText(st.fouls)}</b></div><div><span>Cartellini</span><b>${rangeText(st.yellow)}</b></div><div><span>Fuorigioco</span><b>${rangeText(st.offsides)}</b></div></div><h4>Top risultati</h4><div class="score-list">${p.correctScores.map(x=>`<div><span>${x.score}</span><b>${pct(x.probability)}</b></div>`).join('')}</div><div class="quality">Cronologia: <b>${historyCount}/20 gare</b> · Statistiche dettagliate: <b>${statCount}/10 partite</b> · Fonte stats: <b>${esc(sourceLabel)}</b></div></article>`;
}
function render(){app.innerHTML=`<main class="shell"><header><div class="brand"><span class="ball">⚽</span><div><h1>Match Probability AI</h1><small>APK · motore dati diretto</small></div></div><button id="refresh" class="icon">↻</button></header><section class="hero"><span class="eyebrow">TEST APK · NO VERCEL</span><h2>Partite di oggi</h2><p>Questa versione legge direttamente FotMob e usa SofaScore come fallback per cronologia e statistiche. Nessuna chiamata a <code>/api/today</code>.</p></section><div id="result">${state.loading?'<section class="card result"><h3>Recupero dati diretto...</h3><p>Calendario → cronologia → statistiche match FotMob/SofaScore.</p></section>':state.error?`<section class="card result"><div class="error">${esc(state.error.message||state.error)}</div><p>Il motore diretto ha incontrato un errore nel recupero dati.</p></section>`:`<section class="card result"><span class="eyebrow">${esc(dateIsoRome())}</span><h3>${state.fixtures.length} partite Champions League</h3><p>${esc(state.source)}</p><div class="today-list">${state.fixtures.map(card).join('')}</div></section>`}</div><nav><button class="active">●<small>Oggi</small></button><button>⌂<small>Analisi</small></button><button>◈<small>Modello AI</small></button><button>◉<small>Dati</small></button></nav></main>`;document.querySelector('#refresh').onclick=build}
build();