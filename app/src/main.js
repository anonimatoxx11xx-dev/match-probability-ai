import './style.css';

const app = document.querySelector('#app');
const FOTMOB = 'https://www.fotmob.com';
const SOFA = 'https://www.sofascore.com/api/v1';
const state = { loading:false, fixtures:[], source:'', error:null };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const pct = x => `${(Number(x || 0) * 100).toFixed(1)}%`;
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
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
function emptyForm(){return {n:0,gf:0,ga:0,results:[]};}
function addResult(form,gf,ga,home){form.n++;form.gf+=gf;form.ga+=ga;form.results.push({gf,ga,home});}
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
async function fotmobTeam(id,name){
  try{
    const p=await get(`${FOTMOB}/api/data/teams?id=${encodeURIComponent(id)}`);
    const ms=walkMatches(p,[]).filter(m=>m.status?.finished===true || m.status?.type==='finished' || m.finished===true);
    const seen=new Set(), form=emptyForm();
    ms.sort((a,b)=>new Date(b.status?.utcTime||b.utcTime||0)-new Date(a.status?.utcTime||a.utcTime||0));
    for(const m of ms){const mid=String(m.id||m.matchId);if(seen.has(mid))continue;seen.add(mid);const hn=m.home?.name||'',an=m.away?.name||'';let gf,ga,ishome;
      if(sameTeam(hn,name)){gf=Number(m.home?.score??m.homeScore??0);ga=Number(m.away?.score??m.awayScore??0);ishome=true}
      else if(sameTeam(an,name)){gf=Number(m.away?.score??m.awayScore??0);ga=Number(m.home?.score??m.homeScore??0);ishome=false}
      else continue;
      if(Number.isFinite(gf)&&Number.isFinite(ga))addResult(form,gf,ga,ishome); if(form.n>=10)break;
    }
    if(form.n>=2)return {form,source:'FotMob',teamId:id};
  }catch(e){}
  return null;
}
async function sofaSearch(name){
  const p=await get(`${SOFA}/search/all?q=${encodeURIComponent(name)}`);
  const teams=(p?.results||[]).filter(x=>x?.entity?.id);
  const hit=teams.find(x=>sameTeam(x.entity?.name,name))||teams[0]; return hit?.entity?.id||null;
}
async function sofaTeam(id,name){
  try{
    const form=emptyForm(),seen=new Set();
    for(let page=0;page<3&&form.n<10;page++){
      const p=await get(`${SOFA}/team/${id}/events/last/${page}`);
      for(const m of (p.events||[])){
        if(m.status?.type!=='finished')continue; const mid=String(m.id);if(seen.has(mid))continue;seen.add(mid);
        const hn=m.homeTeam?.name||'',an=m.awayTeam?.name||'',hs=Number(m.homeScore?.current??m.homeScore?.display),as=Number(m.awayScore?.current??m.awayScore?.display);
        if(!Number.isFinite(hs)||!Number.isFinite(as))continue;
        if(sameTeam(hn,name))addResult(form,hs,as,true);else if(sameTeam(an,name))addResult(form,as,hs,false);if(form.n>=10)break;
      }
    }
    if(form.n>=2)return {form,source:'SofaScore',teamId:id};
  }catch(e){}
  return null;
}
async function history(team){
  if(team.id){const f=await fotmobTeam(team.id,team.name);if(f)return f;}
  try{const sid=await sofaSearch(team.name);if(sid){const s=await sofaTeam(sid,team.name);if(s)return s;}}catch(e){}
  return {form:emptyForm(),source:'N/D',teamId:team.id||null};
}
async function build(){
  state.loading=true;state.error=null;render();
  try{
    const all=await fotmobToday();
    const fixtures=all.filter(x=>/champions league/i.test(x.league||''));
    const unique=fixtures.filter((x,i,a)=>a.findIndex(y=>String(y.id)===String(x.id))===i);
    state.fixtures=await Promise.all(unique.slice(0,12).map(async f=>{
      const [h,a]=await Promise.all([history(f.home),history(f.away)]); const p=prediction(h,a);
      const reliability=clamp((Math.min(h.form.n,10)+Math.min(a.form.n,10))/20,0,1);
      return {...f,history:{home:h,away:a},prediction:p,reliability};
    }));
    state.source='FotMob calendario + FotMob/SofaScore cronologia';
  }catch(e){state.error=e;state.fixtures=[];state.source=''}
  state.loading=false;render();
}
function time(v){try{return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return '--:--'}}
function card(f){const p=f.prediction,q=f.history,r=p.result,m=p.markets,d=p.doubleChance,dn=p.drawNoBet;return `<article class="match-card"><div class="match-meta">${esc(f.league)} · ${time(f.status?.utcTime||f.time)} · TEST APK DIRETTO</div><div class="teams-line"><strong>${esc(f.home.name)}</strong><span>VS</span><strong>${esc(f.away.name)}</strong></div><div class="today-prob"><span>1 <b>${pct(r.home)}</b></span><span>X <b>${pct(r.draw)}</b></span><span>2 <b>${pct(r.away)}</b></span></div><div class="pick">Gol attesi <b>${p.home.toFixed(2)}-${p.away.toFixed(2)}</b> · O2.5 <b>${pct(m.over25)}</b></div><div class="quality">Casa: <b>${q.home.form.n}</b> gare (${esc(q.home.source)}) · Trasferta: <b>${q.away.form.n}</b> gare (${esc(q.away.source)})</div><div class="stat-grid compact"><div><span>1X</span><b>${pct(d['1X'])}</b></div><div><span>X2</span><b>${pct(d.X2)}</b></div><div><span>12</span><b>${pct(d['12'])}</b></div><div><span>DNB 1</span><b>${pct(dn.home)}</b></div><div><span>BTTS</span><b>${pct(m.bttsYes)}</b></div><div><span>Over 1.5</span><b>${pct(m.over15)}</b></div></div><h4>Top risultati</h4><div class="score-list">${p.correctScores.map(x=>`<div><span>${x.score}</span><b>${pct(x.probability)}</b></div>`).join('')}</div><div class="quality">Qualità cronologia: <b>${pct(f.reliability)}</b></div></article>`}
function render(){app.innerHTML=`<main class="shell"><header><div class="brand"><span class="ball">⚽</span><div><h1>Match Probability AI</h1><small>APK · motore dati diretto</small></div></div><button id="refresh" class="icon">↻</button></header><section class="hero"><span class="eyebrow">TEST APK · NO VERCEL</span><h2>Partite di oggi</h2><p>Questa versione legge direttamente FotMob e, se necessario, SofaScore. Nessuna chiamata a <code>/api/today</code>.</p></section><div id="result">${state.loading?'<section class="card result"><h3>Recupero dati diretto...</h3><p>Calendario FotMob → cronologia FotMob → fallback SofaScore.</p></section>':state.error?`<section class="card result"><div class="error">${esc(state.error.message||state.error)}</div><p>Se FotMob blocca la richiesta dal WebView, il prossimo step sarà usare CapacitorHttp nativo.</p></section>`:`<section class="card result"><span class="eyebrow">${esc(dateIsoRome())}</span><h3>${state.fixtures.length} partite Champions League</h3><p>${esc(state.source)}</p><div class="today-list">${state.fixtures.map(card).join('')}</div></section>`}</div><nav><button class="active">●<small>Oggi</small></button><button>⌂<small>Analisi</small></button><button>◈<small>Modello AI</small></button><button>◉<small>Dati</small></button></nav></main>`;document.querySelector('#refresh').onclick=build}
build();
