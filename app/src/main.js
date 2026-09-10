import './style.css';
import { todayMatches, findTeamIds, teamHistory, enrichHistory, diagnostics } from './provider-engine.js';

const app=document.querySelector('#app');
const esc=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const poisson=(k,l)=>{l=Math.max(.05,Math.min(6,Number(l)||.05));let p=Math.exp(-l);for(let i=1;i<=k;i++)p*=l/i;return p};

const state={date:'',matches:[],out:[],done:0,tab:'today',busy:false};

function pred(home,away){
  let lh=1.52,la=1.12;
  if(home.length){const gf=home.reduce((s,x)=>s+Math.max(0,x.gf||0),0)/home.length;const ag=away.length?away.reduce((s,x)=>s+Math.max(0,x.ga||0),0)/away.length:1.12;lh=.45*1.52+.55*(gf*.72+ag*.28)}
  if(away.length){const gf=away.reduce((s,x)=>s+Math.max(0,x.gf||0),0)/away.length;const ag=home.length?home.reduce((s,x)=>s+Math.max(0,x.ga||0),0)/home.length:1.52;la=.45*1.12+.55*(gf*.72+ag*.28)}
  lh=Math.max(.2,Math.min(4.5,lh));la=Math.max(.2,Math.min(4.5,la));
  let winH=0,draw=0,winA=0,cs=[];
  for(let i=0;i<=12;i++)for(let j=0;j<=12;j++){const q=poisson(i,lh)*poisson(j,la);if(i>j)winH+=q;else if(i===j)draw+=q;else winA+=q;cs.push([i,j,q])}
  const total=winH+draw+winA||1;
  const p=[winH/total,draw/total,winA/total];
  return {lh,la,totalGoals:lh+la,p,cs:cs.sort((a,b)=>b[2]-a[2]).slice(0,5)};
}

function range(homeStats,awayStats,k){
  const h=homeStats.map(x=>x.data?.[k]).filter(x=>x!=null&&Number.isFinite(x));
  const a=awayStats.map(x=>x.data?.[k]).filter(x=>x!=null&&Number.isFinite(x));
  if(!h.length&&!a.length)return'N/D';
  const sums=[];
  if(h.length&&a.length)for(const x of h)for(const y of a)sums.push(x+y);else sums.push(...(h.length?h:a));
  sums.sort((x,y)=>x-y);if(sums.length===1){const x=Math.max(0,Math.round(sums[0]));return`${x}-${x}`}
  const q=p=>{const pos=(sums.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return lo===hi?sums[lo]:sums[lo]+(sums[hi]-sums[lo])*(pos-lo)};
  let lo=Math.floor(q(.30)),hi=Math.ceil(q(.70));if(hi<lo)hi=lo;if(hi-lo<1)hi=lo+1;
  return`${Math.max(0,lo)}-${Math.max(0,hi)}`;
}

function aiInsight(t){
  const h=t.H?.form||[],a=t.A?.form||[],p=pred(h,a),mx=Math.max(...p.p),pick=p.p[0]===mx?'1':p.p[1]===mx?'X':'2';
  const edge=(mx-.333)*100;
  const data=[...(t.H?.stats||[]),...(t.A?.stats||[])];
  const statsCount=data.filter(x=>Object.keys(x.data||{}).length).length;
  const confidence=Math.max(42,Math.min(94,Math.round(54+Math.min(28,h.length+a.length)+Math.min(12,statsCount*2)+edge*.25)));
  let text=pick==='X'?'Modello equilibrato: il pareggio è il segno più probabile.':pick==='1'?`Leggero vantaggio ${t.home}: forma e distribuzione gol favoriscono la squadra di casa.`:`Leggero vantaggio ${t.away}: il modello vede più forza nella squadra ospite.`;
  if(!h.length||!a.length)text='Dati storici incompleti: la previsione resta disponibile ma con confidenza ridotta.';
  return {pick,confidence,text,statsCount};
}

function statPill(label,value){return `<div class="metric"><span>${label}</span><b>${esc(value)}</b></div>`}

function card(t,index){
  const h=t.H||{form:[],stats:[]},a=t.A||{form:[],stats:[]},p=pred(h.form,a.form),ai=aiInsight(t),stats=[...h.stats,...a.stats];
  const d=stats.filter(x=>Object.keys(x.data||{}).length).length,src=[...new Set(stats.flatMap(x=>x.sources||[]))];
  const pct=p.p.map(x=>(x*100).toFixed(1)+'%');
  const metrics=[['Tiri',range(h.stats,a.stats,'shots')],['In porta',range(h.stats,a.stats,'shotsOnTarget')],['Corner',range(h.stats,a.stats,'corners')],['Falli',range(h.stats,a.stats,'fouls')],['Cartellini',range(h.stats,a.stats,'yellow')],['Fuorigioco',range(h.stats,a.stats,'offsides')]];
  return `<article class="match-card ${index===0?'featured':''}" data-index="${index}">
    <div class="match-head"><div><div class="match-meta">${esc(t.league)} · ${esc(t.time||'')} </div><span class="live-dot"></span><span class="tag">AI MATCH ENGINE</span></div><span class="confidence">${ai.confidence}% conf.</span></div>
    <div class="teams"><div><b>${esc(t.home)}</b><small>CASA</small></div><span>VS</span><div><b>${esc(t.away)}</b><small>TRASFERTA</small></div></div>
    <div class="prob-grid"><div class="prob-cell ${ai.pick==='1'?'selected':''}"><span>1</span><b>${pct[0]}</b></div><div class="prob-cell ${ai.pick==='X'?'selected':''}"><span>X</span><b>${pct[1]}</b></div><div class="prob-cell ${ai.pick==='2'?'selected':''}"><span>2</span><b>${pct[2]}</b></div></div>
    <div class="ai-box"><div class="ai-icon">✦</div><div><strong>Suggerimento AI</strong><p>${esc(ai.text)}</p><small>Segno modello: <b>${ai.pick}</b> · ${ai.statsCount} partite con statistiche reali</small></div></div>
    <div class="goal-line"><span>Gol attesi <b>${p.lh.toFixed(2)} - ${p.la.toFixed(2)}</b></span><span>Totale <b>${Math.max(0,Math.floor(p.totalGoals-.5))}-${Math.ceil(p.totalGoals+.5)}</b></span></div>
    <div class="metrics">${metrics.map(x=>statPill(x[0],x[1])).join('')}</div>
    <div class="history-line"><span>Storico <b>${h.form.length}/10</b> casa · <b>${a.form.length}/10</b> trasferta</span><span>${src.length?esc(src.join(' + ')):'raccolta dati…'}</span></div>
    <details class="details-content"><summary>Analisi avanzata</summary><div class="analysis-grid"><div><span>Top score</span><b>${p.cs[0][0]}-${p.cs[0][1]}</b></div><div><span>Probabilità</span><b>${(p.cs[0][2]*100).toFixed(1)}%</b></div><div><span>Statistiche</span><b>${d}/10</b></div><div><span>Fonti</span><b>${src.length||0}</b></div></div>${t.loading?'<p class="muted">Completamento cronologia e statistiche in background…</p>':''}</details>
  </article>`;
}

function render(){
  const matches=state.out.length?state.out:state.matches.map(m=>({...m,H:{form:[],stats:[]},A:{form:[],stats:[]},loading:true}));
  const analyzed=matches.filter(x=>!x.loading).length;
  const diag=diagnostics();
  let body='';
  if(state.tab==='today')body=`<section class="hero"><div class="eyebrow">AI FOOTBALL INTELLIGENCE</div><h2>Partite di oggi</h2><p>Motore predittivo multi-source con dati reali, Poisson, forma recente e statistiche di gara.</p><div class="hero-stats"><div><b>${state.matches.length||0}</b><span>partite</span></div><div><b>${analyzed}</b><span>analizzate</span></div><div><b>${new Set(matches.flatMap(x=>[...(x.H?.stats||[]),...(x.A?.stats||[])].flatMap(s=>s.sources||[]))).size}</b><span>fonti</span></div></div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">${esc(state.date)}</span><h3>Le migliori analisi</h3></div><button class="refresh" id="r">↻</button></div><div class="today-list">${matches.map(card).join('')}</div></section>`;
  else if(state.tab==='ai'){
    const ranked=matches.map((m,i)=>({m,i,a:aiInsight(m)})).sort((x,y)=>y.a.confidence-x.a.confidence);
    body=`<section class="hero"><div class="eyebrow">MODELLO AI</div><h2>Centro decisionale</h2><p>Il motore confronta probabilità, forma e statistiche disponibili. Non sostituisce i dati reali e non garantisce il risultato.</p></section><section class="panel"><div class="ai-summary"><div class="ai-orb">✦</div><div><b>AI Match Engine</b><p>${analyzed}/${matches.length} partite analizzate · ranking dinamico per confidenza</p></div></div><div class="ranking">${ranked.slice(0,10).map(x=>`<button class="rank-row" data-open="${x.i}"><span>${x.a.pick}</span><div><b>${esc(x.m.home)} <i>vs</i> ${esc(x.m.away)}</b><small>${esc(x.a.text)}</small></div><strong>${x.a.confidence}%</strong></button>`).join('')}</div></section>`;
  }else if(state.tab==='analysis'){
    const analyzedMatches=matches.filter(x=>!x.loading);
    body=`<section class="hero"><div class="eyebrow">ANALISI</div><h2>Statistiche & forma</h2><p>Una vista compatta dei dati che alimentano il modello.</p></section><section class="panel"><div class="feature-grid"><span>📊 <b>${analyzedMatches.length}</b><small>analisi completate</small></span><span>🧠 <b>Poisson</b><small>modello risultati</small></span><span>🌐 <b>${diag.filter(x=>x.ok).length}</b><small>fonti attive</small></span><span>⚡ <b>Live</b><small>aggiornamento APK</small></span></div><div class="analysis-list">${analyzedMatches.slice(0,10).map((m,i)=>{const p=pred(m.H?.form||[],m.A?.form||[]);return `<div class="analysis-row"><div><b>${esc(m.home)} vs ${esc(m.away)}</b><small>Casa ${(p.p[0]*100).toFixed(1)}% · X ${(p.p[1]*100).toFixed(1)}% · Trasferta ${(p.p[2]*100).toFixed(1)}%</small></div><strong>${p.cs[0][0]}-${p.cs[0][1]}</strong></div>`}).join('')}</div></section>`;
  }else{
    body=`<section class="hero"><div class="eyebrow">DATI REALI</div><h2>Fonti & qualità</h2><p>Controllo trasparente delle fonti interrogate direttamente dall'APK.</p></section><section class="panel source-panel">${diag.map(x=>`<div class="source-row"><span class="source-status ${x.ok?'ok':'ko'}"></span><div><b>${esc(x.name)}</b><small>${x.ok?'Risposta ricevuta':'Nessuna risposta valida'}${x.error?' · '+esc(x.error):''}</small></div><strong>${x.ok?'OK':'—'}</strong></div>`).join('')||'<p class="muted">Le fonti verranno mostrate dopo il primo recupero dati.</p>'}</section>`;
  }
  app.innerHTML=`<div class="app-shell"><header class="app-header"><div class="brand"><div class="brand-mark">⚽</div><div><b>Match Probability</b><small>AI FOOTBALL LAB · BUILD 56</small></div></div><button class="header-btn" id="r">↻</button></header>${body}<nav>${[['today','⌂','Oggi'],['analysis','◈','Analisi'],['ai','✦','AI Model'],['data','◎','Dati']].map(x=>`<button class="${state.tab===x[0]?'active':''}" data-tab="${x[0]}"><span>${x[1]}</span><small>${x[2]}</small></button>`).join('')}</nav></div>`;
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{state.tab='today';render()});
  document.querySelectorAll('#r').forEach(b=>b.onclick=()=>build());
}

async function analyzeOne(m){
  const [hi,ai]=await Promise.all([findTeamIds(m.home),findTeamIds(m.away)]);
  const [hf,af]=await Promise.all([teamHistory(m.home,hi),teamHistory(m.away,ai)]);
  const [hstats,astats]=await Promise.all([Promise.all(hf.slice(0,5).map(x=>enrichHistory(x,m.home))),Promise.all(af.slice(0,5).map(x=>enrichHistory(x,m.away)))]);
  return {...m,H:{form:hf,stats:hstats},A:{form:af,stats:astats},loading:false};
}

async function build(){
  if(state.busy)return;state.busy=true;state.tab='today';
  state.date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  app.innerHTML='<div class="boot"><div class="boot-orb">✦</div><div class="eyebrow">AI FOOTBALL INTELLIGENCE</div><h2>Match Probability AI</h2><p>Connessione alle fonti reali…</p><div class="loader"></div></div>';
  try{
    const matches=await todayMatches(state.date);if(!matches.length)throw Error('Nessuna partita disponibile dalle fonti live');
    state.matches=matches;state.out=matches.map(m=>({...m,H:{form:[],stats:[]},A:{form:[],stats:[]},loading:true}));state.done=0;render();
    let next=0;
    const worker=async()=>{while(true){const i=next++;if(i>=matches.length)return;try{state.out[i]=await analyzeOne(matches[i])}catch(e){state.out[i]={...matches[i],H:{form:[],stats:[]},A:{form:[],stats:[]},loading:false,error:String(e?.message||e)}}state.done++;render()}};
    await Promise.all([worker(),worker()]);
  }catch(e){state.matches=[];state.out=[];app.innerHTML=`<div class="boot"><div class="eyebrow">ERRORE DATI</div><h2>Impossibile caricare le partite</h2><p class="error">${esc(e?.message||e)}</p><button class="secondary" id="r">Riprova</button></div>`;document.querySelector('#r').onclick=build}
  finally{state.busy=false}
}
build();
