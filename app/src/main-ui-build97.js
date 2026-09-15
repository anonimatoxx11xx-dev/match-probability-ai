/* BUILD 97 — premium match experience. UI ONLY. Build94 scroll fix + Build78 engine/data untouched. */
import './main-ui-build96.js';
import './style-build97.css';

const ROOT='#app';
let active=null;
const clean=s=>(s||'').replace(/\s+/g,' ').trim();
const esc=s=>clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function values(card,selector){return [...card.querySelectorAll(selector)].map(x=>clean(x.textContent)).filter(Boolean)}
function close(){if(active){active.remove();active=null}document.body.classList.remove('b97-open')}
function toast(msg){let t=document.querySelector('.b97-toast');if(!t){t=document.createElement('div');t.className='b97-toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1800)}
function open(card){
  close();
  card.classList.remove('b95-selected');card.querySelector('.b95-detail')?.remove();
  const teams=values(card,'.team-copy b');
  const probs=values(card,'.prob b');
  const markets=values(card,'.market-line>*');
  const form=values(card,'.form');
  const league=clean(card.querySelector('.league,.match-league')?.textContent)||'ANALISI PARTITA';
  const time=clean(card.querySelector('.match-meta,.time')?.textContent)||'';
  const proof=clean(card.querySelector('.proof')?.textContent)||'Dati verificati';
  const nums=probs.map(x=>parseInt(x,10));
  const labels=['1','X','2'];
  const best=Math.max(...nums.filter(Number.isFinite),0);
  active=document.createElement('div');active.className='b97-modal';
  active.innerHTML=`<div class="b97-sheet" role="dialog" aria-modal="true">
    <button class="b97-close" aria-label="Chiudi">×</button>
    <div class="b97-head"><div><span class="b97-kicker">${esc(league)}</span><h2>${esc(teams[0]||'Casa')} <i>VS</i> ${esc(teams[1]||'Ospite')}</h2><p>${esc(time)} ${time?'• ':''}${esc(proof.replace(/^✓\s*/,''))}</p></div><span class="b97-badge">AI ${best?best+'%':'READY'}</span></div>
    <div class="b97-grid">
      <section class="b97-panel b97-ai"><div class="b97-panel-title"><b>AI MATCH SCORE</b><span>1X2</span></div>
        ${labels.map((l,i)=>{const n=Number.isFinite(nums[i])?Math.max(0,Math.min(100,nums[i])):0;return `<div class="b97-prob"><div><span>${l==='1'?'Casa':l==='2'?'Ospite':'Pareggio'}</span><strong>${n}%</strong></div><div class="b97-track"><i style="width:${n}%"></i></div></div>`}).join('')}
      </section>
      <section class="b97-panel"><div class="b97-panel-title"><b>SEGNALI</b><span>DATI</span></div><div class="b97-chips">${(markets.length?markets:['Nessun mercato disponibile']).map(x=>`<span>${esc(x)}</span>`).join('')}</div>${form.length?`<div class="b97-form"><b>FORMA RECENTE</b><div>${form.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:''}</section>
    </div>
    <div class="b97-actions"><button data-a="fav">☆ Preferita</button><button data-a="share">Condividi</button><button data-a="close">Chiudi</button></div>
    <div class="b97-foot">Analisi basata esclusivamente sui dati disponibili nell'app.</div>
  </div>`;
  document.body.appendChild(active);document.body.classList.add('b97-open');
  active.addEventListener('click',e=>{if(e.target===active||e.target.closest('[data-a="close"]')||e.target.closest('.b97-close'))close()});
  active.querySelector('[data-a="fav"]').onclick=()=>{card.querySelector('.fav')?.click();toast('Partita aggiornata nei preferiti')};
  active.querySelector('[data-a="share"]').onclick=async()=>{const msg=`${teams[0]||'Casa'} vs ${teams[1]||'Ospite'} — AI 1X2: ${probs.join(' / ')}`;try{await navigator.clipboard?.writeText(msg);toast('Analisi copiata')}catch{toast(msg)}};
}
function bind(){document.querySelectorAll('.match-card').forEach(card=>{if(card.dataset.b97==='1')return;card.dataset.b97='1';card.addEventListener('click',e=>{if(e.target.closest('button,.fav,a,input'))return;e.stopImmediatePropagation();open(card)},true)})}
function label(){const r=document.querySelector(ROOT);if(!r)return;const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);while(w.nextNode())w.currentNode.nodeValue=w.currentNode.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96)/g,'BUILD 97')}
function init(){bind();label()}
const obs=new MutationObserver(()=>requestAnimationFrame(init));
function start(){const r=document.querySelector(ROOT);if(!r||r.dataset.b97==='1')return;r.dataset.b97='1';obs.observe(r,{childList:true,subtree:true});init()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();window.addEventListener('load',start,{once:true});
