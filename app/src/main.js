import './style.css';
import { todayMatches, findTeamIds, teamHistory, enrichHistory, diagnostics } from './provider-engine.js';

const app=document.querySelector('#app');
const esc=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const poisson=(k,l)=>{l=Math.max(.05,Math.min(6,Number(l)||.05));let p=Math.exp(-l);for(let i=1;i<=k;i++)p*=l/i;return p};

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

// Tighter prediction interval: use the central 20%-80% historical band.
function range(arr,k){
  const v=arr.map(x=>x.data?.[k]).filter(x=>x!=null&&Number.isFinite(x)).sort((a,b)=>a-b);
  if(!v.length)return'N/D';
  if(v.length===1){const x=Math.max(0,Math.round(v[0]));return`${x}-${x}`}
  const q=p=>{const pos=(v.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return lo===hi?v[lo]:v[lo]+(v[hi]-v[lo])*(pos-lo)};
  let lo=Math.floor(q(.20)),hi=Math.ceil(q(.80));
  if(hi<=lo)hi=lo+1;
  return`${Math.max(0,lo)}-${Math.max(0,hi)}`;
}

function card(t){
  const h=t.H||{form:[],stats:[]},a=t.A||{form:[],stats:[]},p=pred(h.form,a.form),stats=[...h.stats,...a.stats];
  const d=stats.filter(x=>Object.keys(x.data||{}).length).length;
  const src=[...new Set(stats.flatMap(x=>x.sources||[]))];
  const pct=p.p.map(x=>(x*100).toFixed(1)+'%');
  const total=Math.round(p.p.reduce((s,x)=>s+x,0)*1000)/10;
  const loading=t.loading===true;
  return `<article class="match-card">
    <div class="match-meta">${esc(t.league)} · ${esc(t.time||'')} · APK MULTI-SOURCE</div>
    <div class="teams"><b>${esc(t.home)}</b><span>VS</span><b>${esc(t.away)}</b></div>
    <div class="prob">
      <div style="display:flex;align-items:center;gap:8px"><span>1</span><b>${pct[0]}</b></div>
      <div style="display:flex;align-items:center;gap:8px"><span>X</span><b>${pct[1]}</b></div>
      <div style="display:flex;align-items:center;gap:8px"><span>2</span><b>${pct[2]}</b></div>
    </div>
    <div class="quality">Somma probabilità: <b>${total.toFixed(1)}%</b></div>
    <div class="goals">Gol attesi <b>${p.lh.toFixed(2)}-${p.la.toFixed(2)}</b> · Gol totali <b>${Math.max(0,Math.floor(p.totalGoals-.5))}-${Math.ceil(p.totalGoals+.5)}</b></div>
    <div class="history">Casa: <b>${h.form.length}/10</b> gare · Trasferta: <b>${a.form.length}/10</b> gare · ${loading?'analisi in corso…':'storico multi-source'}</div>
    <h3>Range statistiche previste</h3>
    <div class="ranges"><div>Tiri totali <b>${range(stats,'shots')}</b></div><div>Tiri in porta <b>${range(stats,'shotsOnTarget')}</b></div><div>Corner <b>${range(stats,'corners')}</b></div><div>Falli <b>${range(stats,'fouls')}</b></div><div>Cartellini <b>${range(stats,'yellow')}</b></div><div>Fuorigioco <b>${range(stats,'offsides')}</b></div></div>
    <h3>Top risultati</h3>
    <div class="top-results">${p.cs.map(x=>`<div>${x[0]}-${x[1]} <b>${(x[2]*100).toFixed(1)}%</b></div>`).join('')}</div>
    <div class="quality">Cronologia: <b>${h.form.length+a.form.length}/20</b> gare · Statistiche dettagliate: <b>${d}/10</b> partite · Fonti stats: <b>${esc(src.join(' + ')||'in attesa')}</b></div>
    <details class="details-content"><summary>Diagnostica fonti</summary>${loading?'<div class="quality" style="text-align:left;margin-top:6px">Recupero cronologia e statistiche reali…</div>':stats.map(i=>`<div class="quality" style="text-align:left;margin-top:6px">${esc(i.team)} vs ${esc(i.opp)} → <b>${esc(i.sources?.join(' + ')||'nessuna')}</b> · ${Object.keys(i.data||{}).length} metriche</div>`).join('')}</details>
  </article>`;
}

function shell(d,matches,out,done){
  const total=matches.length,diag=diagnostics();
  app.innerHTML=`<div class="shell"><header><div class="brand"><div class="ball">⚽</div><div><h1>Match Probability AI</h1><small>BUILD 53 · motore dati multi-source</small></div></div><button class="icon" id="r">↻</button></header><section class="hero"><div class="eyebrow">TEST APK · NO VERCEL</div><h2>Partite di oggi</h2><p>Le partite vengono mostrate subito. Cronologia e statistiche reali vengono completate in background, senza bloccare l'APK.</p></section><section class="card"><div class="match-meta">${esc(d)}</div><h3 style="margin:4px 0 0">${total} partite</h3><p>Analisi completata: <b>${done}/${total}</b>. Le probabilità 1/X/2 sono calcolate da Poisson e normalizzate matematicamente a <b>100%</b>.</p><div class="today-list">${out.map(card).join('')}</div><details class="details-content"><summary>Stato fonti live</summary>${diag.map(x=>`<div class="quality" style="text-align:left;margin-top:6px">${esc(x.name)} → <b>${x.ok?'OK':'KO'}</b>${x.error?` · ${esc(x.error)}`:''}</div>`).join('')}</details></section></div><nav><button class="active">◉<small>Oggi</small></button><button>⌂<small>Analisi</small></button><button>◇<small>Modello AI</small></button><button>⊙<small>Dati</small></button></nav>`;
  document.querySelector('#r').onclick=build;
}

async function analyzeOne(m){
  const [hi,ai]=await Promise.all([findTeamIds(m.home),findTeamIds(m.away)]);
  const [hf,af]=await Promise.all([teamHistory(m.home,hi),teamHistory(m.away,ai)]);
  const [hstats,astats]=await Promise.all([
    Promise.all(hf.slice(0,5).map(x=>enrichHistory(x,m.home))),
    Promise.all(af.slice(0,5).map(x=>enrichHistory(x,m.away)))
  ]);
  return {...m,H:{form:hf,stats:hstats},A:{form:af,stats:astats},loading:false};
}

async function build(){
  const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  app.innerHTML='<div class="shell"><section class="hero"><div class="eyebrow">BUILD 53 · APK NATIVA</div><h2>Partite di oggi</h2><p>Recupero rapido delle partite live…</p></section></div>';
  try{
    const matches=await todayMatches(d);
    if(!matches.length)throw Error('Nessuna partita disponibile dalle fonti live');
    const out=matches.map(m=>({...m,H:{form:[],stats:[]},A:{form:[],stats:[]},loading:true}));
    shell(d,matches,out,0);
    let next=0,done=0;
    const worker=async()=>{
      while(true){
        const i=next++;
        if(i>=out.length)return;
        try{out[i]=await analyzeOne(matches[i]);}
        catch(e){out[i]={...matches[i],H:{form:[],stats:[]},A:{form:[],stats:[]},loading:false,error:String(e?.message||e)}}
        done++;
        shell(d,matches,out,done);
      }
    };
    await Promise.all([worker(),worker()]);
    shell(d,matches,out,done);
  }catch(e){
    app.innerHTML=`<div class="shell"><section class="hero"><div class="eyebrow">ERRORE DATI</div><h2>Partite di oggi</h2><p class="error">${esc(e?.message||e)}</p><p>Il motore non sostituisce i dati reali con valori inventati.</p></section><button class="secondary" id="r">Riprova</button></div>`;
    document.querySelector('#r').onclick=build;
  }
}
build();
