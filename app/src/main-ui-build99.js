/* BUILD 99 — stop legacy Build97 popup from replacing Build98. UI ONLY. Build78 engine/data untouched. */
import './main-ui-build98.js';

function bindBuild99(){
  document.querySelectorAll('.match-card').forEach(card=>{
    if(card.dataset.b99==='1')return;
    card.dataset.b99='1';
    card.addEventListener('click',e=>{
      if(e.target.closest('button,.fav,a,input'))return;
      e.stopPropagation();
    },true);
  });
}

function labelBuild99(){
  const root=document.querySelector('#app');
  if(!root)return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(w.nextNode()){
    const n=w.currentNode;
    if(n.nodeValue)n.nodeValue=n.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98)/g,'BUILD 99');
  }
}

function initBuild99(){bindBuild99();labelBuild99()}
const observer=new MutationObserver(()=>requestAnimationFrame(initBuild99));
function startBuild99(){
  const root=document.querySelector('#app');
  if(!root||root.dataset.b99observer==='1')return;
  root.dataset.b99observer='1';
  observer.observe(root,{childList:true,subtree:true,characterData:true});
  initBuild99();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startBuild99,{once:true});
else startBuild99();
window.addEventListener('load',startBuild99,{once:true});
