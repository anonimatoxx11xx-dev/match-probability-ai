import './style.css';

const API = 'https://match-probability-ai.forzajuve9314.workers.dev';
const app = document.querySelector('#app');
const leagues = ['Serie A','Premier League','La Liga','Bundesliga','Ligue 1','Champions League'];
const state = { tab: 'today', league: 'Serie A', teams: [], home: null, away: null };

function pct(x) { return (Number(x || 0) * 100).toFixed(1) + '%'; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]; }); }
function apiGet(path) {
  return fetch(API + path, { headers: { Accept: 'application/json' } }).then(function(r) {
    return r.text().then(function(text) {
      var d;
      try { d = JSON.parse(text); } catch (_) { throw new Error('Risposta API non valida (' + r.status + ')'); }
      if (!r.ok) throw new Error(d.error || ('Errore API ' + r.status));
      return d;
    });
  });
}
function apiPost(path, body) {
  return fetch(API + path, { method: 'POST', headers: {'content-type':'application/json', Accept:'application/json'}, body: JSON.stringify(body) }).then(function(r) {
    return r.json().then(function(d) { if (!r.ok) throw new Error(d.error || ('Errore API ' + r.status)); return d; });
  });
}
function shell(title, subtitle) {
  app.innerHTML = '<main class="shell"><header><div class="brand"><span class="ball">⚽</span><div><h1>Match Probability AI</h1><small>Previsioni calcistiche intelligenti</small></div></div><button id="refresh" class="icon">↻</button></header><section class="hero"><span class="eyebrow">AI PREDICTION ENGINE</span><h2>' + title + '</h2><p>' + subtitle + '</p></section><div id="result"></div><nav><button data-tab="today" class="' + (state.tab === 'today' ? 'active' : '') + '">●<small>Oggi</small></button><button data-tab="analysis" class="' + (state.tab === 'analysis' ? 'active' : '') + '">⌂<small>Analisi</small></button><button data-tab="model" class="' + (state.tab === 'model' ? 'active' : '') + '">◈<small>Modello AI</small></button><button data-tab="data" class="' + (state.tab === 'data' ? 'active' : '') + '">◉<small>Dati</small></button></nav></main>';
  document.querySelector('#refresh').onclick = refreshCurrent;
  document.querySelectorAll('[data-tab]').forEach(function(b) { b.onclick = function() { state.tab = b.dataset.tab; render(); }; });
}
function render() {
  if (state.tab === 'today') { shell('PARTITE DI OGGI', 'Trova automaticamente le partite del giorno e calcola le probabilità.'); today(); return; }
  if (state.tab === 'model') { shell('MODELLO AI', 'Validazione reale sulle partite storiche disponibili.'); backtest(); return; }
  if (state.tab === 'data') { shell('DATI', 'Stato del database e qualità della base storica.'); status(); return; }
  shell('Analisi intelligente', 'Poisson + forma storica + fattore casa + simulazione Monte Carlo.');
  document.querySelector('#result').innerHTML = analysisControls();
  document.querySelector('#league').value = state.league;
  document.querySelector('#league').onchange = function(e) { state.league = e.target.value; state.home = null; state.away = null; loadTeams(); };
  document.querySelector('#predict').onclick = predict;
  loadTeams();
}
function analysisControls() {
  var options = leagues.map(function(x) { return '<option>' + x + '</option>'; }).join('');
  return '<section class="card controls"><label>Campionato<select id="league">' + options + '</select></label><div class="teams"><label>Casa<select id="home"><option>Caricamento...</option></select></label><label>Trasferta<select id="away"><option>Caricamento...</option></select></label></div><button id="predict" class="primary">ANALIZZA PARTITA <span>→</span></button><div id="error" class="error"></div></section>';
}
function loadTeams() {
  var err = document.querySelector('#error');
  if (err) err.textContent = '';
  apiGet('/api/teams?league=' + encodeURIComponent(state.league)).then(function(d) {
    state.teams = Array.isArray(d) ? d : (d.teams || d.results || []);
    if (!state.teams.length) throw new Error('Nessuna squadra trovata per ' + state.league);
    state.home = String(state.home || state.teams[0].id);
    state.away = String(state.away || state.teams[Math.min(1, state.teams.length - 1)].id);
    fillTeams();
  }).catch(function(e) { if (err) err.textContent = e.message; });
}
function fillTeams() {
  ['home','away'].forEach(function(id) {
    var s = document.querySelector('#' + id); if (!s) return;
    s.innerHTML = state.teams.map(function(t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join('');
    s.value = state[id] || state.teams[0].id;
  });
}
function predict() {
  var h = document.querySelector('#home').value;
  var a = document.querySelector('#away').value;
  var err = document.querySelector('#error');
  if (!h || !a || h === a) { err.textContent = 'Scegli due squadre diverse.'; return; }
  state.home = h; state.away = a;
  apiGet('/api/predict?home=' + encodeURIComponent(h) + '&away=' + encodeURIComponent(a)).then(showPrediction).catch(function(e) { err.textContent = e.message; });
}
function showPrediction(d) {
  var h = d.homeTeam || 'Casa'; var a = d.awayTeam || 'Trasferta'; var p = d.result || {}; var m = d.markets || {};
  document.querySelector('#result').innerHTML = '<section class="card result"><div class="match"><strong>' + esc(h) + '</strong><span>VS</span><strong>' + esc(a) + '</strong></div><div class="prob"><div><b>' + pct(p.home) + '</b><span>1 · Casa</span></div><div><b>' + pct(p.draw) + '</b><span>X · Pareggio</span></div><div><b>' + pct(p.away) + '</b><span>2 · Ospite</span></div></div><div class="grid"><article><span>⚽ Gol attesi</span><b>' + Number(d.expectedGoals?.home || 0).toFixed(2) + ' - ' + Number(d.expectedGoals?.away || 0).toFixed(2) + '</b></article><article><span>🔥 Over 2.5</span><b>' + pct(m.over25) + '</b></article><article><span>🎯 Gol/Gol</span><b>' + pct(m.bttsYes) + '</b></article><article><span>📊 Affidabilità</span><b>' + pct(d.dataQuality?.reliability) + '</b></article></div><button id="simulate" class="secondary">🎲 SIMULA 10.000 PARTITE</button><div id="simResult"></div></section>';
  document.querySelector('#simulate').onclick = function() { var b = this; b.disabled = true; b.textContent = 'SIMULAZIONE...'; apiPost('/api/simulate', {homeTeamId:Number(state.home), awayTeamId:Number(state.away), runs:10000}).then(function(s) { document.querySelector('#simResult').innerHTML = '<div class="simulation"><b>Monte Carlo</b><span>Casa ' + pct(s.homeWin) + ' · X ' + pct(s.draw) + ' · Ospite ' + pct(s.awayWin) + ' · Over 2.5 ' + pct(s.over25) + '</span></div>'; }).catch(function(e) { document.querySelector('#simResult').textContent = e.message; }).finally(function() { b.disabled = false; b.textContent = '🎲 SIMULA 10.000 PARTITE'; }); };
}
function today() {
  var box = document.querySelector('#result');
  box.innerHTML = '<section class="card result"><span class="eyebrow">OGGI</span><h3>Ricerca partite...</h3><p>Calendario reale + previsioni automatiche.</p></section>';
  apiGet('/api/today').then(function(d) {
    if (!d.fixtures || !d.fixtures.length) { box.innerHTML = '<section class="card result"><span class="eyebrow">OGGI · ' + esc(d.date) + '</span><h3>Nessuna partita trovata</h3><p>Nessuna gara nelle competizioni supportate oggi.</p></section>'; return; }
    var cards = d.fixtures.map(matchCard).join('');
    box.innerHTML = '<section class="card result"><span class="eyebrow">PARTITE DI OGGI · ' + esc(d.date) + '</span><h3>' + d.matches + ' partite trovate</h3><p>Calendario reale · ' + esc(d.timezone) + '</p><div class="today-list">' + cards + '</div></section>';
  }).catch(function(e) { box.innerHTML = '<section class="card result"><div class="error">' + esc(e.message) + '</div></section>'; });
}
function matchCard(f) {
  var p = f.prediction;
  var head = '<article class="match-card"><div class="match-meta">' + esc(f.league?.name || 'Calcio') + ' · ' + formatTime(f.date) + ' · ' + esc(f.status || 'NS') + '</div><div class="teams-line"><strong>' + esc(f.home?.name || 'Casa') + '</strong><span>VS</span><strong>' + esc(f.away?.name || 'Ospite') + '</strong></div>';
  if (!p) return head + '<div class="quality">⚠️ ' + esc(f.reason || 'Previsione non disponibile') + '</div></article>';
  var r = p.result || {};
  var pick = r.home >= r.draw && r.home >= r.away ? '1' : (r.away >= r.home && r.away >= r.draw ? '2' : 'X');
  return head + '<div class="today-prob"><span>1 <b>' + pct(r.home) + '</b></span><span>X <b>' + pct(r.draw) + '</b></span><span>2 <b>' + pct(r.away) + '</b></span></div><div class="pick">AI: <b>' + pick + '</b> · Gol attesi ' + Number(p.expectedGoals?.home || 0).toFixed(2) + '-' + Number(p.expectedGoals?.away || 0).toFixed(2) + ' · O2.5 ' + pct(p.markets?.over25) + '</div><div class="quality">🎯 Gol/Gol ' + pct(p.markets?.bttsYes) + ' · affidabilità ' + pct(p.reliability) + '</div></article>';
}
function formatTime(v) { try { return new Intl.DateTimeFormat('it-IT', {timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(v)); } catch (_) { return '--:--'; } }
function backtest() {
  var box = document.querySelector('#result'); box.innerHTML = '<section class="card result"><h3>Validazione walk-forward...</h3></section>';
  apiGet('/api/backtest?league=' + encodeURIComponent(state.league) + '&minHistory=3').then(function(d) { box.innerHTML = '<section class="card result"><span class="eyebrow">MODELLO AI</span><h3>Validazione ' + esc(state.league) + '</h3><div class="big">' + pct(d.accuracy) + '</div><p>Accuracy su <b>' + d.evaluated + '</b> partite</p><div class="grid"><article><span>Brier Score</span><b>' + Number(d.brier).toFixed(3) + '</b></article><article><span>Log Loss</span><b>' + Number(d.logLoss).toFixed(3) + '</b></article></div><div class="quality">Validazione walk-forward senza usare il futuro.</div></section>'; }).catch(function(e) { box.innerHTML = '<section class="card result"><div class="error">' + esc(e.message) + '</div></section>'; });
}
function status() {
  var box = document.querySelector('#result'); box.innerHTML = '<section class="card result"><h3>Caricamento dati...</h3></section>';
  apiGet('/api/data/status').then(function(d) { box.innerHTML = '<section class="card result"><span class="eyebrow">DATABASE</span><h3>Dati disponibili</h3><div class="big">' + d.matches + '</div><p>partite storiche · <b>' + d.teamsWithStats + '</b> squadre con statistiche</p><div class="quality">Backend online · D1 · aggiornamento automatico</div></section>'; }).catch(function(e) { box.innerHTML = '<section class="card result"><div class="error">' + esc(e.message) + '</div></section>'; });
}
function refreshCurrent() { if (state.tab === 'today') today(); else if (state.tab === 'analysis') loadTeams(); else if (state.tab === 'model') backtest(); else status(); }
render();
