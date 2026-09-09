import './style.css';

const app=document.querySelector('#app');
const F='https://www.fotmob.com';
const S='https://api.sofascore.com/api/v1';
const E='https://site.api.espn.com/apis/site/v2/sports/soccer/all';
const T='https://www.thesportsdb.com/api/v1/json/123';
const K=['shots','shotsOnTarget','corners','fouls','yellow','offsides','xg','bigChances'];

const esc=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const n=x=>{if(x&&typeof x==='object')x=x.value??x.displayValue??x.homeValue;if(typeof x==='string'&&x.includes('/'))x=x.split('/')[0];const m=String(x??'').replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null};
const norm=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(fc|afc|sk|club|calcio|rotterdam|cf|fk|sc|ac|as)\b/g,'').replace(/[^a-z0-9]/g,'');
const same=(a,b)=>{a=norm(a);b=norm(b);return !!a&&!!b&&(a===b||a.includes(b)||b.includes(a))};
const day=d=>new Date(d).toISOString().slice(0,10);
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}

async function get(u){
  const r=await fetch(u,{headers:{Accept:'application/json'}});
  const t=await r.text();
  let j;
  try{j=JSON.parse(t)}catch{throw Error(`JSON ${r.status} · ${u}`)}
  if(!r.ok)throw Error(`HTTP ${r.status} · ${u}`);
  if(j==null)throw Error(`RISPOSTA VUOTA · ${u}`);
  return j;
}

function key(v){
  const t=String(v||'').toLowerCase().replace(/[_-]/g,' ');
  if(/shots? on target|shots? on goal|on target/.test(t)||/shots?ontarget/.test(t.replace(/\W/g,'')))return'shotsOnTarget';
  if(/total shots|shot attempts|^shots$/.test(t))return'shots';
  if(/corner/.test(t))return'corners';
  if(/foul/.test(t))return'fouls';
  if(/yellow|ammon/.test(t))return'yellow';
  if(/offside/.test(t))return'offsides';
  if(/expected goal|^xg/.test(t))return'xg';
  if(/big chance/.test(t))return'bigChances';
}

function parseFot(p,team){
  const a=p?.content?.stats?.Periods?.All?.stats||[];
  const h=p?.general?.homeTeam?.name||p?.header?.teams?.[0]?.name||'';
  const w=p?.general?.awayTeam?.name||p?.header?.teams?.[1]?.name||'';
  const out={};
  for(const g of a)for(const r of(Array.isArray(g?.stats)?g.stats:[g])){
    const k=key(r?.key||r?.title||r?.name),v=r?.stats;
    if(!k||!Array.isArray(v)||v.length<2)continue;
    if(same(h,team))out[k]=n(v[0]);else if(same(w,team))out[k]=n(v[1]);
  }
  return out;
}
const fc=new Map();
async function fot(id,team){const q=id+norm(team);if(fc.has(q))return fc.get(q);let z={};try{z=parseFot(await get(`${F}/api/data/matchDetails?matchId=${id}`),team)}catch{}fc.set(q,z);return z}

const ss=new Map();
async function sofaDay(d){if(ss.has(d))return ss.get(d);let a=[];try{a=(await get(`${S}/sport/football/scheduled-events/${d}`)).events||[]}catch{}ss.set(d,a);return a}
function sofaPick(a,home,away,time){const tm=time?new Date(time).getTime():0;let best=null,bs=-1e9;for(const e of a){let x=0;if(same(e.homeTeam?.name,home))x+=100;if(same(e.awayTeam?.name,away))x+=100;if(x<200)continue;if(tm&&e.startTimestamp)x-=Math.min(Math.abs(e.startTimestamp*1000-tm)/36e5,72);if(x>bs)bs=x,best=e}return best}
function parseSofa(p,team){const rows=(p.statistics||[]).find(x=>String(x.period).toUpperCase()==='ALL')?.groups||[];const h=p._event?.homeTeam?.name||'',w=p._event?.awayTeam?.name||'',out={};for(const g of rows)for(const r of g.statisticsItems||[]){const k=key(r.key||r.name),a=n(r.homeValue??r.home),b=n(r.awayValue??r.away);if(k&&a!=null&&b!=null)out[k]=same(h,team)?a:same(w,team)?b:null}return out}
const sc=new Map();
async function sofa(r,team){const q=r.id+norm(team);if(sc.has(q))return sc.get(q);let z={};try{let e=null;if(r.sofaId)e={id:r.sofaId,homeTeam:{name:r.home?r.team:r.opp},awayTeam:{name:r.home?r.opp:r.team}};else{const d=day(r.time),base=new Date(d+'T12:00:00Z'),ds=[];for(let i=-1;i<=1;i++){const x=new Date(base);x.setUTCDate(x.getUTCDate()+i);ds.push(x.toISOString().slice(0,10))}for(const d of ds){e=sofaPick(await sofaDay(d),r.home?r.team:r.opp,r.home?r.opp:r.team,r.time);if(e)break}}if(e){const p=await get(`${S}/event/${e.id}/statistics`);p._event=e;z=parseSofa(p,team)}}catch{}sc.set(q,z);return z}

function espnEvent(p,h,a){for(const e of p?.events||[]){const c=e.competitions?.[0]?.competitors||[];const hh=c.find(x=>x.homeAway==='home')||c[0],aa=c.find(x=>x.homeAway==='away')||c[1];if(same(hh?.team?.displayName||'',h)&&same(aa?.team?.displayName||'',a))return e}}
function parseEspn(p,team){const t=(p?.boxscore?.teams||[]).find(x=>same(x.team?.displayName||x.team?.name,team)),o={};for(const r of t?.statistics||[]){const k=key(r.name||r.label),v=n(r.displayValue??r.value);if(k&&v!=null)o[k]=v}return o}
const ec=new Map();
async function espn(r,team){const q=r.id+norm(team);if(ec.has(q))return ec.get(q);let z={};try{const d=day(r.time),base=new Date(d+'T12:00:00Z');for(let i=-1;i<=1&&!Object.keys(z).length;i++){const x=new Date(base);x.setUTCDate(x.getUTCDate()+i);const p=await get(`${E}/scoreboard?dates=${x.toISOString().slice(0,10).replace(/-/g,'')}`),e=espnEvent(p,r.home?r.team:r.opp,r.home?r.opp:r.team);if(e)z=parseEspn(await get(`${E}/summary?event=${e.id}`),team)}}catch{}ec.set(q,z);return z}

const tc=new Map(),tsc=new Map();
async function tsDay(d){if(tc.has(d))return tc.get(d);let a=[];try{a=(await get(`${T}/eventsday.php?d=${d}&s=Soccer`)).events||[]}catch{}tc.set(d,a);return a}
function tsPick(a,h,w){return a.find(e=>same(e.strHomeTeam,h)&&same(e.strAwayTeam,w))}
function parseTs(p,team,e){const out={},rows=(p.eventstats||[]).flatMap(x=>x.eventstats||x.stats||[]);for(const r of rows){const k=key(r.strStat||r.strName||r.name),a=n(r.intHome??r.home),b=n(r.intAway??r.away);if(k&&a!=null&&b!=null)out[k]=same(e.strHomeTeam,team)?a:b}return out}
async function ts(r,team){const q=r.id+norm(team);if(tsc.has(q))return tsc.get(q);let z={};try{const d=day(r.time),e=tsPick(await tsDay(d),r.home?r.team:r.opp,r.home?r.opp:r.team);if(e){const id=e.idEvent;if(!tc.has('stats'+id))tc.set('stats'+id,await get(`${T}/lookupeventstats.php?id=${id}`));z=parseTs(tc.get('stats'+id),team)}}catch{}tsc.set(q,z);return z}

function merge(a,...b){const o={...a};for(const x of b)for(const k of K)if(o[k]==null&&x?.[k]!=null)o[k]=x[k];return o}
async function enrich(r,team){const [a,b,c,d]=await Promise.all([fot(r.id,team),sofa(r,team),espn(r,team),ts(r,team)]);return{data:merge(a,b,c,d),sources:['FotMob',Object.keys(b).length?'SofaScore':'',Object.keys(c).length?'ESPN':'',Object.keys(d).length?'TheSportsDB':''].filter(Boolean),opp:r.opp}}

async function sofaSearch(name){try{const p=await get(`${S}/search/all?q=${encodeURIComponent(name)}`),a=p.results||[],x=a.find(x=>x.entity?.name&&same(x.entity.name,name)&&String(x.entity?.type||'').toLowerCase()==='team')||a.find(x=>String(x.entity?.type||'').toLowerCase()==='team');return x?.entity?.id||null}catch{return null}}
async function sofaTeamForm(id,name){if(!id)return[];const out=[];try{for(let page=0;page<3&&out.length<5;page++){const p=await get(`${S}/team/${id}/events/last/${page}`),ev=p.events||[];for(const m of ev){if(String(m.status?.type||'').toLowerCase()!=='finished')continue;const h=m.homeTeam?.name,w=m.awayTeam?.name,a=n(m.homeScore?.current),b=n(m.awayScore?.current);if(a==null||b==null)continue;if(same(h,name))out.push({id:`sofa-${m.id}`,sofaId:String(m.id),team:name,opp:w,home:true,gf:a,ga:b,time:m.startTimestamp?new Date(m.startTimestamp*1000).toISOString():''});else if(same(w,name))out.push({id:`sofa-${m.id}`,sofaId:String(m.id),team:name,opp:h,home:false,gf:b,ga:a,time:m.startTimestamp?new Date(m.startTimestamp*1000).toISOString():''});if(out.length>=5)break}}}catch{}return out.slice(0,5)}
async function teamForm(id,name){
  let out=[];
  if(id)try{
    const p=await get(`${F}/api/data/teams?id=${id}`),all=[];
    const walk=o=>{if(!o||typeof o!=='object')return;if(Array.isArray(o)){o.forEach(walk);return}if(o.home?.name&&o.away?.name&&o.id)all.push(o);Object.entries(o).forEach(([k,v])=>!['players','squad','transfers'].includes(k)&&walk(v))};
    walk(p);
    for(const m of all.sort((a,b)=>new Date(b.status?.utcTime||0)-new Date(a.status?.utcTime||0))){
      if(!(m.status?.finished||m.status?.type==='finished'))continue;
      const h=m.home?.name,w=m.away?.name,a=n(m.home?.score),b=n(m.away?.score);if(a==null||b==null)continue;
      if(same(h,name))out.push({id:String(m.id),team:name,opp:w,home:true,gf:a,ga:b,time:m.status?.utcTime});
      else if(same(w,name))out.push({id:String(m.id),team:name,opp:h,home:false,gf:b,ga:a,time:m.status?.utcTime});
      if(out.length>=5)break;
    }
  }catch{}
  if(out.length<5){const sid=await sofaSearch(name);const sf=await sofaTeamForm(sid,name);const seen=new Set(out.map(x=>`${x.opp}|${x.time}`));for(const x of sf)if(!seen.has(`${x.opp}|${x.time}`))out.push(x);}
  return out.slice(0,5);
}
async function search(name){try{const p=await get(`${F}/api/data/search/suggest?term=${encodeURIComponent(name)}&hits=20&lang=en`),a=p.results||p.suggestions||[],x=a.find(x=>same(x.title||x.name||x.entity?.name,name))||a.find(x=>x.type==='team')||a[0];return x?.id||x?.entity?.id}catch{return null}}

function poisson(k,l){let p=Math.exp(-l);for(let i=1;i<=k;i++)p*=l/i;return p}
function pred(h,a){let lh=1.52,la=1.12;if(h.length)lh=.45*lh+.55*(h.reduce((s,x)=>s+x.gf,0)/h.length*.72+a.reduce((s,x)=>s+x.ga,0)/Math.max(1,a.length)*.28);if(a.length)la=.45*la+.55*(a.reduce((s,x)=>s+x.gf,0)/a.length*.72+h.reduce((s,x)=>s+x.ga,0)/Math.max(1,h.length)*.28);let sh=0,sd=0,sa=0,cs=[];for(let i=0;i<8;i++)for(let j=0;j<8;j++){const q=poisson(i,lh)*poisson(j,la);sh+=i>j?q:0;sd+=i===j?q:0;sa+=i<j?q:0;cs.push([i,j,q])}return{lh,la,total:lh+la,p:[sh,sd,sa],cs:cs.sort((a,b)=>b[2]-a[2]).slice(0,5)}}
function range(arr,k){const v=arr.map(x=>x.data?.[k]).filter(x=>x!=null);if(!v.length)return'N/D';const m=v.reduce((a,b)=>a+b,0)/v.length,s=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length),w=Math.max(1.5,s*.75,m*.1);return`${Math.max(0,Math.round(m-w))}-${Math.round(m+w)}`}

function normalizeMatches(p){
  const leagues=Array.isArray(p?.leagues)?p.leagues:[];
  const out=[];
  for(const l of leagues)for(const m of(Array.isArray(l?.matches)?l.matches:[]))if(m.home?.name&&m.away?.name&&!m.status?.finished)out.push({id:String(m.id),league:l.name||'Calcio',time:m.time||m.status?.utcTime||'',home:m.home.name,away:m.away.name});
  return out;
}
async function loadFotMatches(d){
  const urls=[`${F}/api/data/matches?date=${d}&timezone=Europe%2FRome`,`${F}/api/matches?date=${d}&timezone=Europe%2FRome`];
  for(const u of urls){try{const p=await get(u),m=normalizeMatches(p);if(m.length)return m}catch{}}
  return[];
}
async function loadSofaMatches(d){
  try{
    const a=(await get(`${S}/sport/football/scheduled-events/${d}`)).events||[];
    return a.filter(e=>e.homeTeam?.name&&e.awayTeam?.name).map(e=>({id:String(e.id),sofaId:String(e.id),league:e.tournament?.name||e.uniqueTournament?.name||'Calcio',time:e.startTimestamp?new Date(e.startTimestamp*1000).toISOString():'',home:e.homeTeam.name,away:e.awayTeam.name}));
  }catch{return[]}
}
async function loadEspnMatches(d){
  try{
    const p=await get(`${E}/scoreboard?dates=${d.replace(/-/g,'')}`);
    return(p.events||[]).map(e=>{const c=e.competitions?.[0]?.competitors||[],h=c.find(x=>x.homeAway==='home')||c[0],a=c.find(x=>x.homeAway==='away')||c[1];return h?.team?.displayName&&a?.team?.displayName?{id:`espn-${e.id}`,espnId:String(e.id),league:e.league?.name||e.season?.name||'Calcio',time:e.date||'',home:h.team.displayName,away:a.team.displayName}:null}).filter(Boolean);
  }catch{return[]}
}
function mergeSchedule(...lists){
  const out=[];
  for(const list of lists)for(const m of list){const exists=out.find(x=>same(x.home,m.home)&&same(x.away,m.away));if(exists){exists.id=exists.id.startsWith('espn-')&&m.id&&!m.id.startsWith('espn-')?m.id:exists.id;exists.espnId=exists.espnId||m.espnId;exists.sofaId=exists.sofaId||m.sofaId;exists.league=exists.league==='Calcio'?m.league:exists.league;exists.time=exists.time||m.time}else out.push({...m})}
  return out;
}

function card(f){
  const h=f.H,a=f.A,p=pred(h.form,a.form),d=Math.min(h.stats.filter(x=>Object.keys(x.data).length).length+a.stats.filter(x=>Object.keys(x.data).length).length,10),src=[...new Set([...h.stats,...a.stats].flatMap(x=>x.sources))];
  return`<article class="match-card"><div class="match-meta">${esc(f.league)} · ${esc(f.time||'')} · TEST APK MULTI-SOURCE</div><div class="teams-line"><b>${esc(f.home)}</b><span>VS</span><b>${esc(f.away)}</b></div><div class="today-prob"><span>1 <b>${(p.p[0]*100).toFixed(1)}%</b></span><span>X <b>${(p.p[1]*100).toFixed(1)}%</b></span><span>2 <b>${(p.p[2]*100).toFixed(1)}%</b></span></div><div class="pick">Gol attesi <b>${p.lh.toFixed(2)}-${p.la.toFixed(2)}</b> · Gol totali <b>${Math.floor(p.total)}-${Math.ceil(p.total+1)}</b></div><div class="quality">Casa: <b>${h.form.length}</b> gare · Trasferta: <b>${a.form.length}</b> gare · storico multi-source</div><h3>Range statistiche previste</h3><div class="stat-grid"><div>Tiri totali <b>${range([...h.stats,...a.stats],'shots')}</b></div><div>Tiri in porta <b>${range([...h.stats,...a.stats],'shotsOnTarget')}</b></div><div>Corner <b>${range([...h.stats,...a.stats],'corners')}</b></div><div>Falli <b>${range([...h.stats,...a.stats],'fouls')}</b></div><div>Cartellini <b>${range([...h.stats,...a.stats],'yellow')}</b></div><div>Fuorigioco <b>${range([...h.stats,...a.stats],'offsides')}</b></div></div><h3>Top risultati</h3><div class="score-list">${p.cs.map(x=>`<div>${x[0]}-${x[1]}<b>${(x[2]*100).toFixed(1)}%</b></div>`).join('')}</div><div class="quality">Cronologia: <b>${h.form.length+a.form.length}/10</b> gare · Statistiche dettagliate: <b>${d}/10 partite</b> · Fonte stats: <b>${esc(src.join(' + ')||'N/D')}</b></div><details class="details-content"><summary>Diagnostica fonti</summary>${[...h.stats,...a.stats].map(x=>`<div class="quality" style="text-align:left">${esc(x.opp)} → <b>${esc(x.sources.join(' + ')||'nessuna')}</b> · ${Object.keys(x.data).length} metriche</div>`).join('')}</details></article>`;
}

async function load(){
  app.innerHTML='<div class="shell"><section class="hero"><div class="eyebrow">TEST APK · NO VERCEL</div><h2>Partite di oggi</h2><p>Aggiornamento live multi-source…</p></section><div class="card">Controllo FotMob, SofaScore ed ESPN…</div></div>';
  try{
    const d=today();
    const [fm,ssx,ex]=await Promise.all([loadFotMatches(d),loadSofaMatches(d),loadEspnMatches(d)]);
    const fx=mergeSchedule(fm,ssx,ex).filter(m=>m.home&&m.away).slice(0,12);
    if(!fx.length)throw Error('Nessuna partita disponibile dalle fonti live');
    const out=[];
    for(const f of fx){
      const [hi,ai]=await Promise.all([search(f.home),search(f.away)]);
      const [hf,af]=await Promise.all([teamForm(hi,f.home),teamForm(ai,f.away)]);
      const [hs,as]=await Promise.all([Promise.all(hf.map(r=>enrich(r,f.home))),Promise.all(af.map(r=>enrich(r,f.away)))]);
      out.push({...f,H:{form:hf,stats:hs},A:{form:af,stats:as}});
    }
    app.innerHTML=`<div class="shell"><header><div class="brand"><div class="ball">⚽</div><div><h1>Match Probability AI</h1><small>APK · motore dati multi-source</small></div></div><button class="icon" id="r">↻</button></header><section class="hero"><div class="eyebrow">TEST APK · NO VERCEL</div><h2>Partite di oggi</h2><p>FotMob come base, fallback automatici SofaScore, ESPN e TheSportsDB. Nessun crash se una fonte risponde vuota.</p></section><section class="card"><div class="match-meta">${d}</div><h3 style="margin:4px 0 0">${out.length} partite</h3><p>Fonti live controllate direttamente dall'APK.</p><div class="today-list">${out.map(card).join('')}</div></section></div><nav><button class="active">◉<small>Oggi</small></button><button>⌂<small>Analisi</small></button><button>◇<small>Modello AI</small></button><button>⊙<small>Dati</small></button></nav>`;
    document.querySelector('#r').onclick=load;
  }catch(e){
    app.innerHTML=`<div class="shell"><section class="hero"><div class="eyebrow">ERRORE DATI</div><h2>Partite di oggi</h2><p class="error">${esc(e.message||e)}</p></section><button class="secondary" id="r">Riprova</button></div>`;
    document.querySelector('#r').onclick=load;
  }
}
load();