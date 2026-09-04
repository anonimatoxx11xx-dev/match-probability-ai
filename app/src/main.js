const API='https://match-probability-ai.forzajuve9314.workers.dev';
import './style.css';

const app=document.querySelector('#app');
const state={league:'Serie A',teams:[],home:null,away:null,loading:false};

function pct(x){return `${(Number(x||0)*100).toFixed(1)}%`}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function render(){
 app.innerHTML=`<main class="shell">
  <header><div class="brand"><span class="ball">⚽</span><div><h1>Match Probability AI</h1><small>Analisi intelligente delle partite</small></div></div><button id="refresh" class="icon">↻</button></header>
  <section class="hero"><span class="eyebrow">PREDICTION ENGINE</span><h2>Calcola la probabilità<br>prima della partita</h2><p>Dati storici + modello Poisson + fattore casa.</p></section>
  <section class="card controls"><label>Campionato<select id="league"><option>Serie A</option><option>Premier League</option><option>La Liga</option><option>Bundesliga</option><option>Ligue 1</option><option>Champions League</option></select></label>
   <div class="teams"><label>Casa<select id="home"></select></label><label>Trasferta<select id="away"></select></label></div>
   <button id="predict" class="primary">ANALIZZA PARTITA <span>→</span></button><div id="error" class="error"></div>
  </section><div id="result"></div>
  <nav><button class="active">⌂<small>Analisi</small></button><button id="backtestBtn">◈<small>Modello</small></button><button id="statusBtn">◉<small>Dati</small></button></nav>
 </main>`;
 document.querySelector('#league').value=state.league;
 document.querySelector('#league').onchange=e=>{state.league=e.target.value;loadTeams()};
 document.querySelector('#refresh').onclick=loadTeams;
 document.querySelector('#predict').onclick=predict;
 document.querySelector('#backtestBtn').onclick=backtest;
 document.querySelector('#statusBtn').onclick=status;
 fillTeams();
}
function fillTeams(){for(const id of ['home','away']){const s=document.querySelector('#'+id);s.innerHTML=state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');if(state[id])s.value=state[id]}}
async function loadTeams(){try{state.teams=[];fillTeams();const r=await fetch(`${API}/api/teams?league=${encodeURIComponent(state.league)}`);const d=await r.json();state.teams=Array.isArray(d)?d:(d.teams||[]);fillTeams();}catch(e){document.querySelector('#error').textContent='Impossibile caricare le squadre.'}}
async function predict(){const h=document.querySelector('#home').value,a=document.querySelector('#away').value;if(!h||!a||h===a){document.querySelector('#error').textContent='Scegli due squadre diverse.';return}state.home=h;state.away=a;document.querySelector('#error').textContent='';document.querySelector('#predict').disabled=true;document.querySelector('#predict').textContent='CALCOLO…';try{const r=await fetch(`${API}/api/predict?home=${h}&away=${a}`);const d=await r.json();if(!r.ok)throw new Error(d.error||'Errore');showPrediction(d)}catch(e){document.querySelector('#error').textContent=e.message}finally{document.querySelector('#predict').disabled=false;document.querySelector('#predict').innerHTML='ANALIZZA PARTITA <span>→</span>'}}
function showPrediction(d){const h=state.teams.find(x=>String(x.id)===state.home)?.name||'Casa',a=state.teams.find(x=>String(x.id)===state.away)?.name||'Trasferta';const p=d.result||{};const m=d.markets||{};document.querySelector('#result').innerHTML=`<section class="card result"><div class="match"><strong>${esc(h)}</strong><span>VS</span><strong>${esc(a)}</strong></div><div class="prob"><div><b>${pct(p.home)}</b><span>1 · Casa</span></div><div><b>${pct(p.draw)}</b><span>X · Pareggio</span></div><div><b>${pct(p.away)}</b><span>2 · Ospite</span></div></div><div class="bar"><i style="width:${Math.max(3,p.home*100)}%"></i><i style="width:${Math.max(3,p.draw*100)}%"></i><i style="width:${Math.max(3,p.away*100)}%"></i></div><div class="grid"><article><span>⚽ Gol attesi</span><b>${Number(d.expectedGoals?.home||0).toFixed(2)} - ${Number(d.expectedGoals?.away||0).toFixed(2)}</b></article><article><span>🔥 Over 2.5</span><b>${pct(m.over25)}</b></article><article><span>🎯 Gol/Gol</span><b>${pct(m.bttsYes)}</b></article><article><span>📊 Affidabilità</span><b>${pct(d.dataQuality?.reliability)}</b></article></div><div class="quality">Qualità dati: <b>${esc(d.dataQuality?.level||'n/d')}</b> · ${d.dataQuality?.minMatches||0} partite minime</div></section>`}
async function backtest(){const r=await fetch(`${API}/api/backtest?league=${encodeURIComponent(state.league)}&minHistory=3`);const d=await r.json();document.querySelector('#result').innerHTML=`<section class="card result"><span class="eyebrow">BACKTEST WALK-FORWARD</span><h3>${esc(state.league)}</h3><div class="big">${pct(d.accuracy)}</div><p>Accuracy su <b>${d.evaluated}</b> partite valutate</p><div class="grid"><article><span>Brier</span><b>${Number(d.brier).toFixed(3)}</b></article><article><span>Log Loss</span><b>${Number(d.logLoss).toFixed(3)}</b></article></div></section>`}
async function status(){const r=await fetch(`${API}/api/data/status`);const d=await r.json();document.querySelector('#result').innerHTML=`<section class="card result"><span class="eyebrow">DATABASE</span><h3>Dati disponibili</h3><div class="big">${d.matches}</div><p>partite storiche · <b>${d.teamsWithStats}</b> squadre con statistiche</p></section>`}
render();loadTeams();
