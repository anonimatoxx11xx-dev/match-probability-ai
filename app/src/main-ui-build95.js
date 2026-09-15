/* BUILD 95 — interactive premium UI layer. Build94 scroll fix and Build78 engine remain untouched. */
import './main-ui-build94.js';
import './style-build95.css';

const ROOT='#app';
let activeCard=null;
let searchOpen=false;
let observerStarted=false;

function text(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}
function showToast(msg){let t=document.querySelector('.b95-toast');if(!t){t=document.createElement('div');t.className='b95-toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('show'),1700)}
function relabel(){const root=document.querySelector(ROOT);if(!root)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(w.nextNode())nodes.push(w.currentNode);nodes.forEach(n=>{if(n.nodeValue)n.nodeValue=n.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94)/g,'BUILD 95')})}
function enhanceCards(){document.querySelectorAll('.match-card').forEach(card=>{
  if(card.dataset.b95Enhanced==='1')return;
  card.dataset.b95Enhanced='1';
  card.addEventListener('click',e=>{
    if(e.target.closest('button'))return;
    if(activeCard&&activeCard!==card){activeCard.classList.remove('b95-selected');activeCard.querySelector('.b95-detail')?.remove()}
    if(card.classList.toggle('b95-selected')){
      activeCard=card;
      const teams=[...card.querySelectorAll('.team-copy b')].map(text).filter(Boolean);
      const ai=[...card.querySelectorAll('.prob b')].map(text);
      const proof=text(card.querySelector('.proof'))||'Dati verificati';
      const detail=document.createElement('div');detail.className='b95-detail';detail.innerHTML=`<div><small>Squadra casa</small><b>${teams[0]||'—'}</b></div><div><small>Squadra ospite</small><b>${teams[1]||'—'}</b></div><div><small>Probabilità 1X2</small><b>${ai.length?ai.join(' · '):'—'}</b></div><div><small>Qualità dati</small><b>${proof.replace(/^✓\s*/,'')}</b></div><div class="wide"><small>Interazione</small><b>Tocca un mercato per filtrare l’analisi. ★ salva la partita.</b></div>`;
      card.appendChild(detail);
    }else{activeCard=null}
  });
});}
function enhanceStats(){document.querySelectorAll('.hero-stats>div').forEach((x,i)=>{if(x.dataset.b95==='1')return;x.dataset.b95='1';x.addEventListener('click',()=>{const labels=['Partite di oggi','Mercati disponibili','Fonti attive','Partite analizzate'];showToast(labels[i]||'Dati aggiornati')})})}
function enhanceNav(){document.querySelectorAll('nav button').forEach(b=>{if(b.dataset.b95==='1')return;b.dataset.b95='1';b.addEventListener('click',()=>setTimeout(()=>{relabel();enhanceAll()},0))})}
function openSearch(){if(searchOpen)return;searchOpen=true;const box=document.createElement('div');box.className='b95-search';box.innerHTML='<input aria-label="Cerca partita" placeholder="Cerca squadra o partita…" autocomplete="off">';document.body.appendChild(box);const input=box.querySelector('input');input.focus();input.addEventListener('input',()=>{const q=input.value.toLowerCase().trim();document.querySelectorAll('.match-card').forEach(c=>{c.hidden=!!q&&!text(c).toLowerCase().includes(q)})});input.addEventListener('keydown',e=>{if(e.key==='Escape')closeSearch()})}
function closeSearch(){document.querySelector('.b95-search')?.remove();searchOpen=false;document.querySelectorAll('.match-card').forEach(c=>c.hidden=false)}
function enhanceHeader(){const search=[...document.querySelectorAll('.header-icons button')].find(b=>text(b)==='⌕');if(search&&!search.dataset.b95){search.dataset.b95='1';search.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();searchOpen?closeSearch():openSearch()},{capture:true})}}
function enhanceAll(){relabel();enhanceCards();enhanceStats();enhanceNav();enhanceHeader()}
function start(){if(observerStarted)return;observerStarted=true;const root=document.querySelector(ROOT);if(!root)return;const observer=new MutationObserver(()=>requestAnimationFrame(enhanceAll));observer.observe(root,{childList:true,subtree:true});enhanceAll();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('load',()=>{start();enhanceAll()},{once:true});
