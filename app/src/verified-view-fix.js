const VERIFIED_KEY='mp_verified_match_keys_v3';
const VERIFIED_LEAGUES_KEY='mp_verified_leagues_v3';
const esc=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const norm=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const key=(h,a)=>`${norm(h)}__${norm(a)}`;
function setRead(k){try{const v=JSON.parse(localStorage.getItem(k)||'[]');return new Set(Array.isArray(v)?v:[])}catch{return new Set()}}
function setWrite(k,s){try{localStorage.setItem(k,JSON.stringify([...s]))}catch{}}
function verifiedRows(){
  const rows=[];for(const c of document.querySelectorAll('.match-card')){
    const proof=c.querySelector('.match-proof')?.textContent||'';if(!/profili statistici/i.test(proof))continue;
    const n=[...c.querySelectorAll('.team-name b')].map(x=>x.textContent.trim());if(n.length<2)continue;
    const meta=c.querySelector('.match-meta > span')?.textContent||'';
    const league=meta.replace(/^.*?·\s*/,'').trim()||'Altra competizione';
    rows.push({home:n[0],away:n[1],league});
  }return rows;
}
function capture(){const ks=setRead(VERIFIED_KEY),ls=setRead(VERIFIED_LEAGUES_KEY);for(const r of verifiedRows()){ks.add(key(r.home,r.away));ls.add(norm(r.league))}setWrite(VERIFIED_KEY,ks);setWrite(VERIFIED_LEAGUES_KEY,ls);return{ks,ls}}
function fixToday(){
  const cards=[...document.querySelectorAll('.match-card')];if(!cards.length)return;
  let visible=0;for(const c of cards){const keep=/profili statistici/i.test(c.querySelector('.match-proof')?.textContent||'');c.style.display=keep?'':'none';if(keep)visible++}
  const h=document.querySelector('.today-head h2');if(h)h.textContent=`Partite di oggi (${visible})`;
  const p=document.querySelector('.progress77 b');if(p)p.textContent=`${visible} con dati verificati`;
  const stats=document.querySelector('.hero-stats');if(stats){const cells=stats.querySelectorAll(':scope > div');if(cells[0]?.querySelector('b'))cells[0].querySelector('b').textContent=String(visible);if(cells[0]?.querySelector('small'))cells[0].querySelector('small').textContent='Partite con dati';if(cells[3]?.querySelector('b'))cells[3].querySelector('b').textContent=String(visible);if(cells[3]?.querySelector('small'))cells[3].querySelector('small').textContent='Statistiche verificate'}
}
function fixAI(ks){
  const rows=[...document.querySelectorAll('.ai-rank')];if(!rows.length)return;let shown=0;
  for(const r of rows){const text=r.querySelector('b')?.textContent||'';const parts=text.split(/\s+vs\s+/i);const keep=parts.length===2&&ks.has(key(parts[0],parts[1]));r.style.display=keep?'':'none';if(keep){shown++;const n=r.querySelector('span');if(n)n.textContent=String(shown)}}
  const head=document.querySelector('.ai-board-head small');if(head)head.textContent=`${shown} analizzate · solo statistiche verificate`;
}
function fixAnalysis(ls){
  const page=document.querySelector('.page77');if(!page)return;const buttons=[...page.querySelectorAll('.analysis-league')];if(!buttons.length)return;let shown=0;
  for(const b of buttons){const name=norm(b.querySelector('b')?.textContent||'');const keep=ls.has(name);b.style.display=keep?'':'none';if(keep)shown++}
  const h=page.querySelector('h1');if(h&&(/Quadro dei campionati|Campionati con dati/i.test(h.textContent||'')))h.textContent=`Campionati con dati (${shown})`;
  const p=page.querySelector('p');if(p)p.textContent='Mostro solo i campionati che hanno almeno una partita con statistiche verificabili.';
}
function run(){
  document.querySelectorAll('.eyebrow,.app-header small').forEach(e=>{if(/BUILD 77/.test(e.textContent||''))e.textContent=e.textContent.replace(/BUILD 77/g,'BUILD 78')});
  const captured=capture();fixToday();fixAI(captured.ks);fixAnalysis(captured.ls);
}
let timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(run,120)}
window.addEventListener('mp:verified-ready',schedule);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
run();
