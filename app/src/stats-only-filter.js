const ONLY_VERIFIED_STATS = true;
const VERIFIED_KEY = 'mp_verified_match_keys_v2';
const VERIFIED_LEAGUES_KEY = 'mp_verified_leagues_v2';

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pairKey(home, away) {
  return `${norm(home)}__${norm(away)}`;
}

function readSet(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch (_) {
    return new Set();
  }
}

function writeSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch (_) {}
}

function cardInfo(card) {
  const teams = [...card.querySelectorAll('.team-name b')].map(x => (x.textContent || '').trim());
  const meta = card.querySelector('.match-meta > span');
  const leagueText = (meta?.textContent || '').replace(/^.*?·\s*/, '').trim();
  return {
    home: teams[0] || '',
    away: teams[1] || '',
    league: leagueText || 'Altra competizione'
  };
}

function hasVerifiedStats(card) {
  const proof = card.querySelector('.match-proof');
  return !!proof && /profili statistici/i.test(proof.textContent || '');
}

function replaceBuild78() {
  document.querySelectorAll('.eyebrow, .app-header small').forEach(el => {
    if (/BUILD 77/.test(el.textContent || '')) {
      el.textContent = el.textContent.replace(/BUILD 77/g, 'BUILD 78');
    }
  });
}

function captureVerifiedCards(cards) {
  const verified = readSet(VERIFIED_KEY);
  const leagues = readSet(VERIFIED_LEAGUES_KEY);

  cards.forEach(card => {
    if (!hasVerifiedStats(card)) return;
    const info = cardInfo(card);
    if (!info.home || !info.away) return;
    verified.add(pairKey(info.home, info.away));
    if (info.league) leagues.add(norm(info.league));
  });

  writeSet(VERIFIED_KEY, verified);
  writeSet(VERIFIED_LEAGUES_KEY, leagues);
  return { verified, leagues };
}

function filterToday(cards) {
  let visible = 0;
  cards.forEach(card => {
    const keep = hasVerifiedStats(card);
    card.style.display = keep ? '' : 'none';
    if (keep) visible++;
  });
  return visible;
}

function updateTodayCounters(visible) {
  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) {
    const cells = heroStats.querySelectorAll(':scope > div');
    if (cells[0]?.querySelector('b')) cells[0].querySelector('b').textContent = String(visible);
    if (cells[0]?.querySelector('small')) cells[0].querySelector('small').textContent = 'Partite con dati';
    if (cells[3]?.querySelector('b')) cells[3].querySelector('b').textContent = String(visible);
    if (cells[3]?.querySelector('small')) cells[3].querySelector('small').textContent = 'Statistiche verificate';
  }

  const progress = document.querySelector('.progress77 b');
  if (progress) progress.textContent = `${visible} con dati verificati`;

  const head = document.querySelector('.today-head');
  if (head) {
    const h2 = head.querySelector('h2');
    const activeNav = document.querySelector('nav button.active small')?.textContent || '';
    const title = activeNav === 'Preferiti' ? 'Preferiti' : 'Partite di oggi';
    if (h2) h2.textContent = `${title} (${visible})`;
    const span = head.querySelector('span');
    if (span) span.textContent = `🔴 Live · ${visible} con dati verificati`;
  }

  const load = document.querySelector('.load-more');
  if (load) {
    const small = load.querySelector('small');
    load.childNodes[0].textContent = 'Solo partite con statistiche verificabili ';
    if (small) small.textContent = `${visible} disponibili`;
  }
}

function hideEmptyAiRows(verified) {
  const rows = [...document.querySelectorAll('.ai-rank')];
  if (!rows.length) return;

  let shown = 0;
  rows.forEach(row => {
    const text = (row.querySelector('b')?.textContent || row.textContent || '').trim();
    const parts = text.split(/\s+vs\s+/i);
    const keep = parts.length === 2 && verified.has(pairKey(parts[0], parts[1]));
    row.style.display = keep ? '' : 'none';
    if (keep) shown++;
  });

  const head = document.querySelector('.ai-board-head small');
  if (head) head.textContent = `${shown} analizzate · solo statistiche verificate`;

  const empty = document.querySelector('.ai-board .empty-panel');
  if (!shown && !empty) {
    const board = document.querySelector('.ai-board');
    if (board) board.insertAdjacentHTML('beforeend', '<div class="empty-panel">Nessuna partita con statistiche verificabili.</div>');
  }
}

function hideUnverifiedLeagues(leagues) {
  const buttons = [...document.querySelectorAll('.analysis-league')];
  if (!buttons.length) return;

  let shown = 0;
  buttons.forEach(button => {
    const name = norm(button.querySelector('b')?.textContent || '');
    const keep = leagues.has(name);
    button.style.display = keep ? '' : 'none';
    if (keep) shown++;
  });

  const page = document.querySelector('.page77');
  const p = page?.querySelector('p');
  if (p && /senza nascondere/i.test(p.textContent || '')) {
    p.textContent = 'Mostro solo i campionati che hanno almeno una partita con statistiche verificabili.';
  }

  const heading = page?.querySelector('h1');
  if (heading && /Quadro dei campionati/i.test(heading.textContent || '')) {
    heading.textContent = `Campionati con dati (${shown})`;
  }
}

function applyStatsOnlyFilter() {
  if (!ONLY_VERIFIED_STATS) return;
  replaceBuild78();

  const cards = [...document.querySelectorAll('.match-card')];
  let verified = readSet(VERIFIED_KEY);
  let leagues = readSet(VERIFIED_LEAGUES_KEY);

  if (cards.length) {
    const captured = captureVerifiedCards(cards);
    verified = captured.verified;
    leagues = captured.leagues;
    updateTodayCounters(filterToday(cards));
  }

  hideEmptyAiRows(verified);
  hideUnverifiedLeagues(leagues);
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    applyStatsOnlyFilter();
  });
}

new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
schedule();
