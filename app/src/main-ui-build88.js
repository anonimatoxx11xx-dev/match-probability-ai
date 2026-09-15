/* BUILD 88 — interaction/scroll correction layer. UI only; Build78 engine/data logic remains untouched. */
import './main-ui-build81.js';
import './style-build88.css';

function build88Label(){
  const root=document.querySelector('#app');
  if(!root)return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(n=>{if(n.nodeValue)n.nodeValue=n.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86|87)/g,'BUILD 88')});
}

function unlock88(){
  const html=document.documentElement, body=document.body, app=document.querySelector('#app');
  [html,body,app].filter(Boolean).forEach(el=>{
    el.style.removeProperty('overflow');
    el.style.removeProperty('height');
    el.style.setProperty('overflow-y','auto','important');
    el.style.setProperty('overflow-x','hidden','important');
    el.style.setProperty('touch-action','pan-y','important');
    el.style.setProperty('pointer-events','auto','important');
  });
  if(app){
    const root=app.querySelector('.app');
    if(root){
      root.style.setProperty('height','auto','important');
      root.style.setProperty('min-height','100dvh','important');
      root.style.setProperty('overflow','visible','important');
      root.style.setProperty('touch-action','pan-y','important');
      root.style.setProperty('pointer-events','auto','important');
    }
  }
  document.querySelectorAll('#app *').forEach(el=>{
    if(el.getAttribute('aria-hidden')==='true' && !el.classList.contains('modal')) return;
    el.style.removeProperty('touch-action');
  });
}

function enhance88(){build88Label();unlock88();}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance88,{once:true});
else enhance88();
window.addEventListener('load',enhance88,{once:true});
window.addEventListener('pageshow',enhance88);
requestAnimationFrame(enhance88);
setTimeout(enhance88,300);
setTimeout(enhance88,1000);
