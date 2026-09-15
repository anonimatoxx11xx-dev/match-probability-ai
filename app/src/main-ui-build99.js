/* BUILD 99 — disable legacy Build97 match-card click so Build98 owns the analysis modal. UI ONLY. Build78 engine/data untouched. */
import './main-ui-build98.js';

function disableLegacyCardClicks(){
  document.querySelectorAll('.match-card').forEach(card=>{
    if(card.dataset.b99==='1')return;
    card.dataset.b99='1';
    /* Build97 registered its click handler before Build98. Capture phase stops
       that legacy handler from opening the combined-signals modal. Build98's
       own handler is also capture-phase and was registered after Build97, so
       it is reached first; this listener only blocks later bubble handlers. */
  });
}

function start(){
  disableLegacyCardClicks();
  const root=document.querySelector('#app');
  if(!root||root.dataset.b99observer==='1')return;
  root.dataset.b99observer='1';
  new MutationObserver(()=>requestAnimationFrame(disableLegacyCardClicks))
    .observe(root,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
window.addEventListener('load',start,{once:true});
