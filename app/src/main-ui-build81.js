/* BUILD 82 interactive UI layer. Build78 engine/data logic remains untouched. */
import './main-ui-build80.js';
import './style-build81.css';

const appRoot = () => document.querySelector('#app');
let toastTimer = null;

function toast(message) {
  let element = document.querySelector('.b81-toast');
  if (!element) {
    element = document.createElement('div');
    element.className = 'b81-toast';
    document.body.appendChild(element);
  }
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 1700);
}

function closeOverlay() {
  document.querySelector('.b81-overlay')?.remove();
}

function openSearch() {
  closeOverlay();
  const overlay = document.createElement('div');
  overlay.className = 'b81-overlay';
  overlay.innerHTML = `
    <div class="b81-modal">
      <div class="b81-modal-head"><b>🔎 Cerca partite</b><button class="b81-close" type="button">×</button></div>
      <input class="b81-search" autocomplete="off" placeholder="Cerca squadra o campionato…">
      <div class="b81-result">Scrivi per filtrare le partite di oggi.</div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('.b81-search');
  const result = overlay.querySelector('.b81-result');
  const filter = () => {
    const query = input.value.trim().toLowerCase();
    const cards = [...document.querySelectorAll('.match-card')];
    let visible = 0;
    cards.forEach((card) => {
      const match = !query || card.textContent.toLowerCase().includes(query);
      card.classList.toggle('b81-hidden', !match);
      if (match) visible += 1;
    });
    result.innerHTML = query ? `<b>${visible}</b> partite trovate per “${query}”.` : 'Scrivi per filtrare le partite di oggi.';
  };
  input.addEventListener('input', filter);
  overlay.querySelector('.b81-close').addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeOverlay(); });
  setTimeout(() => input.focus(), 40);
}

function openSettings() {
  closeOverlay();
  const compact = localStorage.getItem('mp_compact') === '1';
  const overlay = document.createElement('div');
  overlay.className = 'b81-overlay';
  overlay.innerHTML = `
    <div class="b81-modal">
      <div class="b81-modal-head"><b>⚙ Impostazioni vista</b><button class="b81-close" type="button">×</button></div>
      <div class="b81-setting"><span><b>Vista compatta</b><br><small>Più partite visibili sullo schermo</small></span><button class="b81-toggle ${compact ? 'on' : ''}" data-compact type="button"></button></div>
      <div class="b81-setting"><span><b>Animazioni</b><br><small>Transizioni e feedback touch</small></span><button class="b81-toggle on" data-motion type="button"></button></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.b81-close').addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeOverlay(); });
  overlay.querySelector('[data-compact]').addEventListener('click', (event) => {
    const enabled = !document.body.classList.contains('b81-compact');
    document.body.classList.toggle('b81-compact', enabled);
    localStorage.setItem('mp_compact', enabled ? '1' : '0');
    event.currentTarget.classList.toggle('on', enabled);
    toast(enabled ? 'Vista compatta attiva' : 'Vista standard attiva');
  });
  overlay.querySelector('[data-motion]').addEventListener('click', (event) => {
    const enabled = event.currentTarget.classList.toggle('on');
    document.documentElement.style.setProperty('--b81-motion', enabled ? '1' : '0');
    toast(enabled ? 'Animazioni attive' : 'Animazioni ridotte');
  });
}

function expandCard(card) {
  const existing = card.querySelector('.b81-expand');
  if (existing) { existing.remove(); card.classList.remove('b81-open'); return; }
  const probabilities = [...card.querySelectorAll('.prob b')].map((node) => node.textContent.trim());
  const markets = [...card.querySelectorAll('.market-line button')].slice(0, 3).map((node) => node.textContent.trim());
  const panel = document.createElement('div');
  panel.className = 'b81-expand';
  panel.innerHTML = `
    <div><b>${probabilities[0] || '—'}</b><small>Casa · 1</small></div>
    <div><b>${probabilities[1] || '—'}</b><small>Pareggio · X</small></div>
    <div><b>${probabilities[2] || '—'}</b><small>Ospite · 2</small></div>
    <div class="b81-expand-wide"><b>Segnali verificati</b><small>${markets.join(' · ') || 'Dati disponibili nella scheda'}</small></div>`;
  card.appendChild(panel);
  card.classList.add('b81-open');
  toast('Analisi rapida aperta');
}

function moveDashboardControls() {
  const root = appRoot();
  const hero = root?.querySelector('.hero');
  if (!hero || hero.dataset.b81Layout === '1') return;
  hero.dataset.b81Layout = '1';
  const leagueTabs = hero.querySelector('.league-tabs');
  const viewTabs = hero.querySelector('.view-tabs');
  if (leagueTabs) hero.after(leagueTabs);
  if (viewTabs) (leagueTabs || hero).after(viewTabs);
  root.querySelector('nav')?.classList.add('b81-bottom-nav');
}

function updateBuildLabel() {
  const root = appRoot();
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    if (node.nodeValue?.includes('BUILD 80')) node.nodeValue = node.nodeValue.replaceAll('BUILD 80', 'BUILD 82');
    if (node.nodeValue?.includes('BUILD 81')) node.nodeValue = node.nodeValue.replaceAll('BUILD 81', 'BUILD 82');
  });
}

function enhance() {
  const root = appRoot();
  if (!root) return;
  document.body.classList.add('b82-ui');
  updateBuildLabel();
  moveDashboardControls();
  if (localStorage.getItem('mp_compact') === '1') document.body.classList.add('b81-compact');

  const searchButton = root.querySelector('.header-icons button:nth-child(1)');
  if (searchButton && !searchButton.dataset.b81) {
    searchButton.dataset.b81 = '1'; searchButton.setAttribute('aria-label', 'Cerca');
    searchButton.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); openSearch(); });
  }
  const settingsButton = root.querySelector('.header-icons button:nth-child(3)');
  if (settingsButton && !settingsButton.dataset.b81) {
    settingsButton.dataset.b81 = '1'; settingsButton.setAttribute('aria-label', 'Impostazioni');
    settingsButton.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); openSettings(); });
  }
  root.querySelectorAll('.match-card').forEach((card) => {
    if (card.dataset.b81) return;
    card.dataset.b81 = '1'; card.setAttribute('role', 'button'); card.setAttribute('aria-expanded', 'false');
    card.addEventListener('click', (event) => {
      if (event.target.closest('button,.market-line')) return;
      expandCard(card); card.setAttribute('aria-expanded', card.classList.contains('b81-open') ? 'true' : 'false');
    });
  });
  root.querySelectorAll('.hero-stats div').forEach((stat) => {
    if (stat.dataset.b81) return;
    stat.dataset.b81 = '1';
    stat.addEventListener('click', () => {
      const label = stat.querySelector('small')?.textContent || 'Dato';
      const value = stat.querySelector('b')?.textContent || '—';
      toast(`${label} · ${value}`);
    });
  });
}

const observer = new MutationObserver(() => requestAnimationFrame(enhance));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeOverlay();
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && document.activeElement?.tagName !== 'INPUT') { event.preventDefault(); openSearch(); }
});
requestAnimationFrame(enhance);
