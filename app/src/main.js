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
  let winH=0,draw=0,winA=0;
  for(let i=0;i<=12;i++)for(let j=0;j<=12;j++){const q=poisson(i,lh)*poisson(j,la);if(i>j)winH+=q;else if(i===j)draw+=q;else winA+=q}
  const total=winH+draw+winA||1;
  return {lh,la,totalGoals:lh+la,p:[winH/total,draw/total,winA/total]};
}

function values(stats,key){return stats.map(x=>x.data?.[key]).filter(x=>x!=null&&Number.isFinite(x))}
function quantile(v,p){if(!v.length)return null;const a=[...v].sort((x,y)=>x-y),pos=(a.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(pos-lo)}

// Forecasts are match totals. We combine the home team's historical distribution
// with the away team's historical distribution instead of treating one team's
// number as the total match value.
function statForecast(homeStats,awayStats,key){
  const h=values(homeStats,key),a=values(awayStats,key);
  if(!h.length&&!a.length)return null;
  const hm=h.length?h.reduce((s,x)=>s+x,0)/h.length:null;
  const am=a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const expected=(hm??0)+(am??0);
  if(h.length&&a.length){
    const lo=Math.max(0,Math.floor(quantile(h,.25)+quantile(a,.25)));
    const hi=Math.max(lo,Math.ceil(quantile(h,.75)+quantile(a,.75)));
    const spread=Math.max(1,hi-lo);
    const consistency=Math.max(35,Math.min(96,Math.round(100-(spread/Math.max(1,expected))*75)));
    return {expected,lo,hi,hm,am,consistency,sample:Math.min(h.length,a.length)};
  }
  const one=h.length?h:a,lo=Math.max(0,Math.floor(quantile(one,.25))),hi=Math.max(lo,Math.ceil(quantile(one,.75))),spread=Math.max(1,hi-lo);
  return {expected,lo,hi,hm,am,consistency:Math.max(30,Math.min(80,Math.round(100-(spread/Math.max(1,expected))*75))),sample:one.length};
}

const STAT_DEFS=[
  ['shots','Tiri'],['shotsOnTarget','Tiri in porta'],['corners','Corner'],['fouls','Falli'],['yellow','Cartellini'],['offsides','Fuorigioco']
];

function statSignals(t){
  const h=t.H?.stats||[],a=t.A?.stats||[];
  return STAT_DEFS.map(([key,label])=>({key,label,...(statForecast(h,a,key)||{expected:null,lo:null,hi:null,consistency:0,sample:0})})).filter(x=>x.expected!=null);
}

function aiStatInsight(t){
  const sig=statSignals(t),p=pred(t.H?.form||[],t.A?.form||[]),data=[...(t.H?.stats||[]),...(t.A?.stats||[])];
  const usable=sig.filter(x=>x.sample>0),quality=data.filter(x=>Object.keys(x.data||{}).length).length;
  const strong=[...usable].sort((a,b)=>b.consistency-a.consistency).slice(0,3);
  const best=strong[0];
  const resultPick=p.p[0]>=p.p[1]&&p.p[0]>=p.p[2]?'1':p.p[2]>=p.p[0]&&p.p[2]>=p.p[1]?'2':'X';
  const confidence=Math.max(40,Math.min(94,Math.round(48+Math.min(22,(t.H?.form?.length||0)+(t.A?.form?.length||0))+Math.min(18,quality*2)+Math.min(6,(best?.consistency||0)/16))));
  let text='Dati statistici insufficienti per un segnale forte.';
  if(best)text=`Il segnale più leggibile è ${best.label.toLowerCase()}: stima centrale ${best.expected.toFixed(1)}, fascia ${best.lo}-${best.hi}, con coerenza storica ${best.consistency}%.`;
  return {signals:sig,quality,resultPick,confidence,text,strong};
}

function metric(label,f){
  if(!f)return `<div class="metric"><span>${label}</span><b>N/D</b></div>`;
  return `<div class="metric stat-metric"><span>${label}</span><b>${f.lo}-${f.hi}</b><small>stima ${f.expected.toFixed(1)}</small></div>`;
}

function statAnalysis(t){
  const ai=aiStatInsight(t);
  return `<div class="stat-ai-panel"><div class="stat-ai-head"><div class="ai-icon">✦</div><div><strong>Analisi AI delle statistiche</strong><p>${esc(ai.text)}</p></div></div><div class="stat-signal-list">${ai.strong.map(s=>`<div><span>${esc(s.label)}</span><b>${s.lo}-${s.hi}</b><small>media ${s.expected.toFixed(1)} · coerenza ${s.consistency}%</small></div>`).join('')||'<div><span>Statistiche</span><b>In attesa</b></div>'}</div></div>`;
}

function card(t,index){
  const h=t.H||{form:[],stats:[]},a=t.A||{form:[],stats:[]},p=pred(h.form,a.form),ai=aiStatInsight(t),stats=[...h.stats,...a.stats];
  const d=stats.filter(x=>Object.keys(x.data||{}).length).length,src=[...new Set(stats.flatMap(x=>x.sources||[]))];
  const pct=p.p.map(x=>(x*100).toFixed(1)+'%');
  const signals=ai.signals;
  return `<article class="match-card ${index===0?'featured':''}">
    <div class="match-head"><div><div class="match-meta">${esc(t.league)} · ${esc(t.time||'')}</div><span class="live-dot"></span><span class="tag">AI STAT ENGINE</span></div><span class="confidence">${ai.confidence}% dati</span></div>
    <div class="teams"><div><b>${esc(t.home)}</b><small>CASA</small></div><span>VS</span><div><b>${esc(t.away)}</b><small>TRASFERTA</small></div></div>
    <div class="prob-grid"><div class="prob-cell ${ai.resultPick==='1'?'selected':''}"><span>1</span><b>${pct[0]}</b></div><div class="prob-cell ${ai.resultPick==='X'?'selected':''}"><span>X</span><b>${pct[1]}</b></div><div class="prob-cell ${ai.resultPick==='2'?'selected':''}"><span>2</span><b>${pct[2]}</b></div></div>
    ${statAnalysis(t)}
    <div class="goal-line"><span>Gol attesi <b>${p.lh.toFixed(2)} - ${p.la.toFixed(2)}</b></span><span>Totale gol <b>${p.totalGoals.toFixed(2)}</b></span></div>
    <div class="metrics">${signals.map(s=>metric(s.label,{lo:s.lo,hi:s.hi,expected:s.expected})).join('')}</div>
    <div class="history-line"><span>Storico <b>${h.form.length}/10</b> casa · <b>${a.form.length}/10</b> trasferta</span><span>${src.length?esc(src.join(' + ')):'raccolta dati…'}</span></div>
    <details class="details-content"><summary>Dettaglio previsione statistica</summary><div class="analysis-grid">${signals.map(s=>`<div><span>${esc(s.label)}</span><b>${s.lo}-${s.hi}</b><small>media ${s.expected.toFixed(1)} · ${s.consistency}% coerenza</small></div>`).join('')}</div><p class="muted">Il modello mostra fasce statistiche e non un risultato esatto. Le stime dipendono esclusivamente dai dati disponibili nell'APK.</p></details>
  </article>`;
}

function render(){
  const matches=state.out.length?state.out:state.matches.map(m=>({...m,H:{form:[],stats:[]},A:{form:[],stats:[]},loading:true}));
  const analyzed=matches.filter(x=>!x.loading).length,diag=diagnostics();
  let body='';
  if(state.tab==='today'){
    body=`<section class="hero"><div class="eyebrow">AI FOOTBALL INTELLIGENCE</div><h2>Partite di oggi</h2><p>Previsioni statistiche reali su corner, tiri, falli, cartellini e fuorigioco. Nessun risultato esatto inventato.</p><div class="hero-stats"><div><b>${state.matches.length||0}</b><span>partite</span></div><div><b>${analyzed}</b><span>analizzate</span></div><div><b>${new Set(matches.flatMap(x=>[...(x.H?.stats||[]),...(x.A?.stats||[])].flatMap(s=>s.sources||[]))).size}</b><span>fonti</span></div></div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">${esc(state.date)}</span><h3>Analisi statistiche AI</h3></div><button class="refresh" id="r">↻</button></div><div class="today-list">${matches.map(card).join('')}</div></section>`;
  }else if(state.tab==='ai'){
    const ranked=matches.map((m,i)=>({m,i,a:aiStatInsight(m)})).sort((x,y)=>{const ay=y.a.strong[0]?.consistency||0,ax=x.a.strong[0]?.consistency||0;return ay-ax});
    body=`<section class="hero"><div class="eyebrow">MODELLO AI</div><h2>Centro decisionale</h2><p>Qui l'AI ordina le partite in base alla qualità dei segnali statistici: corner, tiri, falli, cartellini e fuorigioco.</p></section><section class="panel"><div class="ai-summary"><div class="ai-orb">✦</div><div><b>AI Statistical Engine</b><p>${analyzed}/${matches.length} partite analizzate · ranking per coerenza dei dati</p></div></div><div class="ranking">${ranked.slice(0,10).map(x=>{const s=x.a.strong[0];return `<button class="rank-row stat-rank" data-open="${x.i}"><span>${s?.label?.slice(0,1)||'•'}</span><div><b>${esc(x.m.home)} <i>vs</i> ${esc(x.m.away)}</b><small>${s?`${esc(s.label)}: ${s.lo}-${s.hi} · stima ${s.expected.toFixed(1)} · coerenza ${s.consistency}%`:'Dati in raccolta'}</small></div><strong>${s?.consistency||0}%</strong></button>`}).join('')}</div></section>`;
  }else if(state.tab==='analysis'){
    const analyzedMatches=matches.filter(x=>!x.loading);
    body=`<section class="hero"><div class="eyebrow">ANALISI</div><h2>Statistiche & forma</h2><p>La sezione analizza le previsioni di gara, non cerca il risultato esatto.</p></section><section class="panel"><div class="feature-grid"><span>📊 <b>${analyzedMatches.length}</b><small>analisi completate</small></span><span>🧠 <b>Stat AI</b><small>motore statistiche</small></span><span>🌐 <b>${diag.filter(x=>x.ok).length}</b><small>fonti attive</small></span><span>⚡ <b>Live</b><small>aggiornamento APK</small></span></div><div class="analysis-list">${analyzedMatches.slice(0,10).map(m=>{const ai=aiStatInsight(m);return `<div class="analysis-row stat-analysis-row"><div><b>${esc(m.home)} vs ${esc(m.away)}</b><small>${ai.strong.slice(0,3).map(s=>`${esc(s.label)} ${s.lo}-${s.hi}`).join(' · ')||'Statistiche in raccolta'}</small></div><strong>${ai.strong[0]?ai.strong[0].consistency+'%':'—'}</strong></div>`}).join('')}</div></section>`;
  }else{
    body=`<section class="hero"><div class="eyebrow">DATI REALI</div><h2>Fonti & qualità</h2><p>Controllo trasparente delle fonti interrogate direttamente dall'APK.</p></section><section class="panel source-panel">${diag.map(x=>`<div class="source-row"><span class="source-status ${x.ok?'ok':'ko'}"></span><div><b>${esc(x.name)}</b><small>${x.ok?'Risposta ricevuta':'Nessuna risposta valida'}${x.error?' · '+esc(x.error):''}</small></div><strong>${x.ok?'OK':'—'}</strong></div>`).join('')||'<p class="muted">Le fonti verranno mostrate dopo il primo recupero dati.</p>'}</section>`;
  }
  app.innerHTML=`<div class="app-shell"><header class="app-header"><div class="brand"><div class="brand-mark">⚽</div><div><b>Match Probability</b><small>AI FOOTBALL LAB · BUILD 57</small></div></div><button class="header-btn" id="r">↻</button></header>${body}<nav>${[['today','⌂','Oggi'],['analysis','◈','Analisi'],['ai','✦','AI Model'],['data','◎','Dati']].map(x=>`<button class="${state.tab===x[0]?'active':''}" data-tab="${x[0]}"><span>${x[1]}</span><small>${x[2]}</small></button>`).join('')}</nav></div>`;
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
