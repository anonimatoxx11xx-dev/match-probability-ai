const KEY='mp_verified_view_v1';
const esc=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

function read(){try{return JSON.parse(sessionStorage.getItem(KEY)||'[]')}catch{return[]}}
function write(rows){try{sessionStorage.setItem(KEY,JSON.stringify(rows.slice(0,100)))}catch{}}
function capture(){
  const cards=[...document.querySelectorAll('.match-card')];
  if(!cards.length)return;
  const rows=read();
  for(const c of cards){
    const proof=c.querySelector('.match-proof')?.textContent||'';
    if(!/profili statistici/i.test(proof))continue;
    const names=[...c.querySelectorAll('.team-name b')].map(x=>x.textContent.trim());
    if(names.length<2)continue;
    const league=(c.querySelector('.match-meta span')?.textContent||'').replace(/^\s*·\s*/,'').split(' · ').pop().trim();
    const time=[...c.querySelectorAll('.match-meta span')].map(x=>x.textContent).find(x=>x.includes('◷'))?.replace('◷','').trim()||'';
    const probs=[...c.querySelectorAll('.prob-grid b')].map(x=>x.textContent.trim());
    const id=c.id.replace(/^match-/,'');
    const item={id,home:names[0],away:names[1],league,time,probs,proof:proof.trim()};
    const i=rows.findIndex(x=>x.id===id); if(i>=0)rows[i]=item; else rows.push(item);
  }
  write(rows);
}
function fixAI(){
  const board=document.querySelector('.ai-board');
  if(!board)return;
  const ranks=board.querySelectorAll('.ai-rank');
  if(ranks.length)return;
  const rows=read(); if(!rows.length)return;
  const sorted=[...rows].sort((a,b)=>Math.max(...(b.probs.map(x=>parseInt(x)||0))) - Math.max(...(a.probs.map(x=>parseInt(x)||0))));
  const head=board.querySelector('.ai-board-head small'); if(head)head.textContent=`${sorted.length} analizzate · solo statistiche verificate`;
  board.insertAdjacentHTML('beforeend',sorted.map((x,i)=>`<button class="ai-rank" type="button"><span>${i+1}</span><b>${esc(x.home)} vs ${esc(x.away)}</b><strong>${Math.max(...(x.probs.map(v=>parseInt(v)||0)))}%</strong></button>`).join(''));
}
function fixAnalysis(){
  const page=document.querySelector('.page77');
  const h1=page?.querySelector('h1');
  if(!page||!h1||!/^Quadro dei campionati/i.test(h1.textContent))return;
  if(page.querySelector('.analysis-league'))return;
  const rows=read(); if(!rows.length)return;
  const map=new Map(); for(const x of rows){const k=x.league||'Altra competizione';map.set(k,(map.get(k)||0)+1)}
  h1.textContent=`Campionati con dati (${map.size})`;
  const p=page.querySelector('p'); if(p)p.textContent='Mostro solo i campionati che hanno almeno una partita con statistiche verificabili.';
  page.insertAdjacentHTML('beforeend',[...map.entries()].sort((a,b)=>b[1]-a[1]).map(([name,n])=>`<button class="analysis-league" data-league="${esc(name)}"><span>🏆</span><b>${esc(name)}</b><strong>${n}</strong></button>`).join(''));
}
function run(){capture();fixAI();fixAnalysis()}
let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(run,80)}).observe(document.documentElement,{childList:true,subtree:true});run();
