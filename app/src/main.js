import './style.css';
import { todayMatches, findTeamIds, teamHistory, enrichHistory, diagnostics } from './provider-engine.js';

const app=document.querySelector('#app');
const esc=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const poisson=(k,l)=>{l=Math.max(.05,Math.min(6,Number(l)||.05));let p=Math.exp(-l);for(let i=1;i<=k;i++)p*=l/i;return p};
const state={date:'',matches:[],out:[],done:0,tab:'today',filter:'all',busy:false};

const STAT_DEFS=[
  ['shots','Tiri','T','🎯'],['shotsOnTarget','Tiri in porta','P','🥅'],['corners','Corner','C','◈'],
  ['fouls','Falli','F','⚑'],['yellow','Cartellini','G','🟨'],['offsides','Fuorigioco','O','↗']
];
const statDef=k=>STAT_DEFS.find(x=>x[0]===k);

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
function mean(v){return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function trend(v){if(v.length<4)return '→ stabile';const recent=mean(v.slice(0,2)),older=mean(v.slice(2));if(!recent||!older)return '→ stabile';const d=(recent-older)/Math.max(1,older);return d>.12?'↑ in crescita':d<-.12?'↓ in calo':'→ stabile'}

// Match-total forecast: home distribution + away distribution.
function statForecast(homeStats,awayStats,key){
  const h=values(homeStats,key),a=values(awayStats,key);
  if(!h.length&&!a.length)return null;
  const hm=mean(h),am=mean(a),expected=(hm??0)+(am??0);
  if(h.length&&a.length){
    const lo=Math.max(0,Math.floor(quantile(h,.25)+quantile(a,.25)));
    const hi=Math.max(lo,Math.ceil(quantile(h,.75)+quantile(a,.75)));
    const spread=Math.max(1,hi-lo);
    const consistency=Math.max(35,Math.min(96,Math.round(100-(spread/Math.max(1,expected))*75)));
    return {expected,lo,hi,hm,am,consistency,sample:Math.min(h.length,a.length),trend:`${trend(h)} / ${trend(a)}`};
  }
  const one=h.length?h:a,lo=Math.max(0,Math.floor(quantile(one,.25))),hi=Math.max(lo,Math.ceil(quantile(one,.75))),spread=Math.max(1,hi-lo);
  return {expected,lo,hi,hm,am,consistency:Math.max(30,Math.min(80,Math.round(100-(spread/Math.max(1,expected))*75))),sample:one.length,trend:trend(one)};
}

function statSignals(t){
  const h=t.H?.stats||[],a=t.A?.stats||[];
  return STAT_DEFS.map(([key,label,short,icon])=>({key,label,short,icon,...(statForecast(h,a,key)||{expected:null,lo:null,hi:null,consistency:0,sample:0})})).filter(x=>x.expected!=null);
}

function aiStatInsight(t){
  const sig=statSignals(t),data=[...(t.H?.stats||[]),...(t.A?.stats||[])];
  const usable=sig.filter(x=>x.sample>0),quality=data.filter(x=>Object.keys(x.data||{}).length).length;
  const strong=[...usable].sort((a,b)=>b.consistency-a.consistency).slice(0,3);
  const best=strong[0];
  const confidence=Math.max(40,Math.min(94,Math.round(46+Math.min(24,(t.H?.form?.length||0)+(t.A?.form?.length||0))+Math.min(18,quality*2)+Math.min(6,(best?.consistency||0)/16))));
  let text='Dati statistici insufficienti per un segnale forte.';
  if(best)text=`Il segnale più leggibile è ${best.label.toLowerCase()}: ${best.lo}-${best.hi}, stima ${best.expected.toFixed(1)}. ${best.trend}. Coerenza ${best.consistency}%.`;
  return {signals:sig,quality,confidence,text,strong};
}

function confidenceClass(v){return v>=85?'high':v>=70?'mid':'low'}
function metricCard(s){
  return `<div class="metric stat-metric"><div class="metric-top"><span>${s.icon} ${esc(s.label)}</span><em class="signal ${confidenceClass(s.consistency)}">${s.consistency}%</em></div><b>${s.lo}-${s.hi}</b><small>stima ${s.expected.toFixed(1)} · ${esc(s.trend)}</small></div>`;
}
function statAnalysis(t){
  const ai=aiStatInsight(t);
  return `<div class="stat-ai-panel"><div class="stat-ai-head"><div class="ai-icon">✦</div><div><strong>AI: cosa emerge dalla gara</strong><p>${esc(ai.text)}</p></div></div><div class="stat-signal-list">${ai.strong.map((s,i)=>`<div><span><i>${i+1}</i>${s.icon} ${esc(s.label)}</span><b>${s.lo}-${s.hi}</b><small>stima ${s.expected.toFixed(1)} · ${esc(s.trend)} · coerenza ${s.consistency}%</small></div>`).join('')||'<div><span>Statistiche</span><b>In raccolta</b></div>'}</div></div>`;
}
function resultBlock(p){
  const pct=p.p.map(x=>(x*100).toFixed(1)+'%'),mx=Math.max(...p.p);
  return `<div class="secondary-result"><span>Esito orientativo</span><div>${[['1','Casa',pct[0]],['X','Pareggio',pct[1]],['2','Trasferta',pct[2]]].map((x,i)=>`<div class="result-mini ${p.p[i]===mx?'selected':''}"><small>${x[0]}</small><b>${x[2]}</b><em>${x[1]}</em></div>`).join('')}</div></div>`;
}

function card(t,index){
  const h=t.H||{form:[],stats:[]},a=t.A||{form:[],stats:[]},p=pred(h.form,a.form),ai=aiStatInsight(t),signals=ai.signals;
  const stats=[...h.stats,...a.stats],src=[...new Set(stats.flatMap(x=>x.sources||[]))];
  const filtered=state.filter==='all'?signals:signals.filter(s=>s.key===state.filter);
  const hasData=signals.length>0;
  return `<article class="match-card ${index===0?'featured':''}">
    <div class="match-head"><div><div class="match-meta">${esc(t.league)} · ${esc(t.time||'')}</div><span class="live-dot"></span><span class="tag">AI STAT ENGINE</span></div><span class="confidence ${confidenceClass(ai.confidence)}">${ai.confidence}% affidabilità dati</span></div>
    <div class="teams"><div><b>${esc(t.home)}</b><small>CASA</small></div><span>VS</span><div><b>${esc(t.away)}</b><small>TRASFERTA</small></div></div>
    ${statAnalysis(t)}
    <div class="metrics-title"><b>Previsioni statistiche</b><span>${signals.length}/6 mercati</span></div>
    <div class="metrics">${filtered.map(metricCard).join('')||'<div class="empty-stat">Nessun dato disponibile per questo mercato.</div>'}</div>
    <div class="goal-line"><span>Gol attesi <b>${p.lh.toFixed(2)}–${p.la.toFixed(2)}</b></span><span>Totale <b>${p.totalGoals.toFixed(2)}</b></span></div>
    ${resultBlock(p)}
    <div class="history-line"><span>Storico <b>${h.form.length}/10</b> casa · <b>${a.form.length}/10</b> trasferta</span><span>${src.length?esc(src.join(' + ')):'raccolta dati…'}</span></div>
    <details class="details-content"><summary>Apri dettaglio AI</summary><div class="analysis-grid">${signals.map(s=>`<div><span>${s.icon} ${esc(s.label)}</span><b>${s.lo}-${s.hi}</b><small>stima ${s.expected.toFixed(1)} · ${esc(s.trend)} · ${s.consistency}%</small></div>`).join('')}</div><div class="team-split"><span>Casa: ${signals.map(s=>{const f=statForecast(h.stats,[],s.key);return f?`${s.label} ${f.expected.toFixed(1)}`:''}).filter(Boolean).join(' · ')}</span><span>Trasferta: ${signals.map(s=>{const f=statForecast([],a.stats,s.key);return f?`${s.label} ${f.expected.toFixed(1)}`:''}).filter(Boolean).join(' · ')}</span></div><p class="muted">Le fasce sono stime statistiche del totale gara. Non vengono generati risultati esatti.</p></details>
    ${!hasData?'<div class="loading-note">⟳ Dati storici ancora in raccolta</div>':''}
  </article>`;
}

function sourceState(x){const e=String(x.error||'');if(/429|rate/i.test(e))return{cls:'limited',label:'LIMITATA',text:'Limite richieste raggiunto'};return x.ok?{cls:'ok',label:'ATTIVA',text:'Risposta valida ricevuta'}:{cls:'ko',label:'OFFLINE',text:'Nessuna risposta valida'}}
function sourceCard(x){const s=sourceState(x);return `<div class="source-row ${s.cls}"><span class="source-status ${s.cls}"></span><div><b>${esc(x.name)}</b><small>${esc(s.text)}${x.error&&!/429|rate/i.test(String(x.error))?' · '+esc(x.error):''}</small></div><strong>${s.label}</strong></div>`}

function render(){
  const matches=state.out.length?state.out:state.matches.map(m=>({...m,H:{form:[],stats:[]},A:{form:[],stats:[]},loading:true}));
  const analyzed=matches.filter(x=>!x.loading).length,diag=diagnostics(),active=diag.filter(x=>x.ok).length;
  let body='';
  if(state.tab==='today'){
    const filterButtons=[['all','Tutti'],...STAT_DEFS.map(x=>[x[0],x[3]+' '+x[1]])];
    const visible=state.filter==='all'?matches:matches.filter(m=>statSignals(m).some(s=>s.key===state.filter));
    body=`<section class="hero"><div class="eyebrow">AI FOOTBALL INTELLIGENCE · BUILD 58</div><h2>Statistiche di oggi</h2><p>Previsioni quantitative su tiri, tiri in porta, corner, falli, cartellini e fuorigioco. <b>Nessun risultato esatto.</b></p><div class="hero-stats"><div><b>${state.matches.length||0}</b><span>partite</span></div><div><b>${analyzed}/${state.matches.length||0}</b><span>analizzate</span></div><div><b>${active}</b><span>fonti attive</span></div></div></section><section class="panel"><div class="filter-bar">${filterButtons.map(x=>`<button class="filter-chip ${state.filter===x[0]?'active':''}" data-filter="${x[0]}">${x[1]}</button>`).join('')}</div><div class="panel-head"><div><span class="eyebrow">${esc(state.date)}</span><h3>Analisi statistiche AI</h3></div><button class="refresh" id="r">↻</button></div><div class="today-list">${visible.map(card).join('')||'<div class="empty-panel">Nessuna partita contiene ancora dati per questo mercato.</div>'}</div></section>`;
  }else if(state.tab==='ai'){
    const ranked=matches.map((m,i)=>({m,i,a:aiStatInsight(m)})).sort((x,y)=>(y.a.strong[0]?.consistency||0)-(x.a.strong[0]?.consistency||0));
    body=`<section class="hero"><div class="eyebrow">MODELLO AI</div><h2>Centro decisionale</h2><p>L'AI seleziona i segnali più solidi per ogni gara. La classifica usa <b>coerenza storica + quantità dei dati</b>, non risultati inventati.</p></section><section class="panel"><div class="ai-summary"><div class="ai-orb">✦</div><div><b>AI Statistical Engine</b><p>${analyzed}/${matches.length} analizzate · ranking dei segnali più affidabili</p></div></div><div class="model-chips"><span>🎯 Tiri</span><span>◈ Corner</span><span>⚑ Falli</span><span>🟨 Cartellini</span></div><div class="ranking">${ranked.slice(0,10).map((x,pos)=>{const s=x.a.strong[0];return `<button class="rank-row stat-rank" data-open="${x.i}"><span class="rank-number">${pos+1}</span><div><b>${esc(x.m.home)} <i>vs</i> ${esc(x.m.away)}</b><small>${s?`${s.icon} ${esc(s.label)} ${s.lo}-${s.hi} · stima ${s.expected.toFixed(1)} · ${esc(s.trend)}`:'Dati in raccolta'}</small></div><strong>${s?.consistency||0}%</strong></button>`}).join('')||'<div class="empty-panel">Analisi in raccolta…</div>'}</div></section>`;
  }else if(state.tab==='analysis'){
    const analyzedMatches=matches.filter(x=>!x.loading),allSignals=analyzedMatches.flatMap(m=>statSignals(m));
    const avg=k=>{const v=allSignals.filter(s=>s.key===k).map(s=>s.consistency);return v.length?Math.round(mean(v)):0};
    const top=[...STAT_DEFS].map(([key,label,short,icon])=>({key,label,icon,value:avg(key)})).sort((a,b)=>b.value-a.value);
    body=`<section class="hero"><div class="eyebrow">ANALISI</div><h2>Quadro statistico</h2><p>Una vista unica per capire dove il modello trova segnali più consistenti nelle partite di oggi.</p></section><section class="panel"><div class="feature-grid"><span>📊 <b>${analyzedMatches.length}</b><small>analisi completate</small></span><span>🧠 <b>Stat AI</b><small>6 mercati osservati</small></span><span>🌐 <b>${active}</b><small>fonti attive</small></span><span>⚡ <b>${state.done}/${state.matches.length}</b><small>aggiornamento</small></span></div><div class="section-label">Coerenza media per mercato</div><div class="market-bars">${top.map(s=>`<button class="market-bar" data-filter="${s.key}"><span>${s.icon} ${esc(s.label)}</span><div><i style="width:${s.value}%"></i></div><b>${s.value}%</b></button>`).join('')}</div><div class="section-label">Segnali migliori</div><div class="analysis-list">${analyzedMatches.slice(0,12).map(m=>{const ai=aiStatInsight(m),ss=ai.strong;return `<button class="analysis-row stat-analysis-row" data-open-match="${esc(m.id||'')}" data-open-name="${esc(m.home+' vs '+m.away)}"><div><b>${esc(m.home)} <i>vs</i> ${esc(m.away)}</b><small>${ss.map(s=>`${s.icon} ${esc(s.label)} ${s.lo}-${s.hi}`).join(' · ')||'Statistiche in raccolta'}</small></div><strong>${ss[0]?ss[0].consistency+'%':'—'}</strong></button>`}).join('')}</div></section>`;
  }else{
    const used=['FotMob','ESPN','SofaScore','TheSportsDB','OpenLigaDB'];
    const rows=used.map(name=>diag.find(x=>x.name===name)||{name,ok:false,error:''});
    body=`<section class="hero"><div class="eyebrow">DATI REALI</div><h2>Fonti & qualità</h2><p>Stato delle fonti che l'APK può interrogare direttamente. Una fonte limitata non viene spacciata per attiva.</p><div class="quality-pill"><span>●</span> ${active} fonti hanno risposto</div></section><section class="panel source-panel"><div class="panel-head"><div><span class="eyebrow">LIVE PROVIDERS</span><h3>Connessioni reali</h3></div><button class="refresh" id="r">↻</button></div>${rows.map(sourceCard).join('')}<div class="source-note"><b>Trasparenza</b><p>API-Football, Sportmonks, GoalServe, Sportradar e gli altri provider richiedono credenziali o piani dedicati: non vengono dichiarati collegati finché non sono realmente configurati nell'APK.</p></div></section>`;
  }
  app.innerHTML=`<div class="app-shell"><header class="app-header"><div class="brand"><div class="brand-mark">⚽</div><div><b>Match Probability</b><small>AI FOOTBALL LAB · BUILD 58</small></div></div><button class="header-btn" id="r">↻</button></header>${body}<nav>${[['today','⌂','Oggi'],['analysis','◈','Analisi'],['ai','✦','AI Model'],['data','◎','Dati']].map(x=>`<button class="${state.tab===x[0]?'active':''}" data-tab="${x[0]}"><span>${x[1]}</span><small>${x[2]}</small></button>`).join('')}</nav></div>`;
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;state.tab='today';render()});
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{state.tab='today';render();setTimeout(()=>document.querySelector('.match-card')?.scrollIntoView({behavior:'smooth',block:'start'}),50)});
  document.querySelectorAll('[data-open-match]').forEach(b=>b.onclick=()=>{state.tab='today';render();setTimeout(()=>document.querySelector('.match-card')?.scrollIntoView({behavior:'smooth',block:'start'}),50)});
  document.querySelectorAll('#r').forEach(b=>b.onclick=()=>build());
}

async function analyzeOne(m){
  const [hi,ai]=await Promise.all([findTeamIds(m.home),findTeamIds(m.away)]);
  const [hf,af]=await Promise.all([teamHistory(m.home,hi),teamHistory(m.away,ai)]);
  const [hstats,astats]=await Promise.all([Promise.all(hf.slice(0,5).map(x=>enrichHistory(x,m.home))),Promise.all(af.slice(0,5).map(x=>enrichHistory(x,m.away)))]);
  return {...m,H:{form:hf,stats:hstats},A:{form:af,stats:astats},loading:false};
}

async function build(){
  if(state.busy)return;state.busy=true;state.tab='today';state.filter='all';
  state.date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  app.innerHTML='<div class="boot"><div class="boot-orb">✦</div><div class="eyebrow">AI FOOTBALL INTELLIGENCE</div><h2>Match Probability AI</h2><p>Raccolta dati reali e costruzione delle previsioni statistiche…</p><div class="loader"></div></div>';
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
