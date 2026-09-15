/* BUILD 92 — Today screen source-level stabilization. UI ONLY. Build78 engine/data logic untouched. */
import './main-ui-build81.js';
import './style-build92.css';

function updateBuild92(){
  const root=document.querySelector('#app');
  if(!root)return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(n=>{
    if(n.nodeValue)n.nodeValue=n.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86|87|88|89|90|91)/g,'BUILD 92');
  });
}

/* main-ui-build79 rebuilds #app during data hydration. We deliberately do NOT
   manipulate scrollTop/overflow here. The browser owns scrolling naturally. */
function labelAfterRender(){
  updateBuild92();
  const root=document.querySelector('#app');
  if(!root||root.dataset.build92Observer)return;
  root.dataset.build92Observer='1';
  const observer=new MutationObserver(()=>requestAnimationFrame(updateBuild92));
  observer.observe(root,{childList:true,subtree:true,characterData:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',labelAfterRender,{once:true});
else labelAfterRender();
window.addEventListener('load',updateBuild92,{once:true});
