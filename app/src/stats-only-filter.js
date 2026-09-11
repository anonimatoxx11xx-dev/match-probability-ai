const ONLY_VERIFIED_STATS = true;

function hasVerifiedStats(card) {
  const proof = card.querySelector('.match-proof');
  return !!proof && /profili statistici/i.test(proof.textContent || '');
}

function applyStatsOnlyFilter() {
  if (!ONLY_VERIFIED_STATS) return;
  const cards = [...document.querySelectorAll('.match-card')];
  if (!cards.length) return;

  let visible = 0;
  cards.forEach(card => {
    const keep = hasVerifiedStats(card);
    card.style.display = keep ? '' : 'none';
    if (keep) visible++;
  });

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

  document.querySelectorAll('.eyebrow, .app-header small').forEach(el => {
    if (/BUILD 77/.test(el.textContent || '')) el.textContent = el.textContent.replace(/BUILD 77/g, 'BUILD 78');
  });
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
