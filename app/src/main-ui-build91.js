/* BUILD 91 — single-scroll Today screen fix. UI only; Build78 engine/data logic untouched. */
import './main-ui-build90.js';
import './style-build91.css';

function label91(){
  const root=document.querySelector('#app'); if(!root)return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const a=[];
  while(w.nextNode())a.push(w.currentNode);
  a.forEach(n=>{if(n.nodeValue)n.nodeValue=n.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86|87|88|89|90)/g,'BUILD 91')});
}
function fix91(){
  const app=document.querySelector('#app'), root=app?.querySelector('.app');
  if(!app||!root)return;
  app.style.setProperty('overflow-y','auto','important');
  app.style.setProperty('overflow-x','hidden','important');
  app.style.setProperty('height','100dvh','important');
  app.style.setProperty('position','fixed','important');
  app.style.setProperty('inset','0','important');
  app.style.setProperty('touch-action','pan-y','important');
  root.style.setProperty('height','auto','important');
  root.style.setProperty('min-height','100%','important');
  root.style.setProperty('max-height','none','important');
  root.style.setProperty('overflow','visible','important');
  root.style.setProperty('padding-bottom','160px','important');
  const nav=root.querySelector(':scope > nav');
  if(nav){
    nav.style.setProperty('position','fixed','important');
    nav.style.setProperty('left','8px','important'); nav.style.setProperty('right','8px','important');
    nav.style.setProperty('bottom','max(8px,env(safe-area-inset-bottom,8px))','important');
    nav.style.setProperty('width','auto','important'); nav.style.setProperty('height','82px','important');
    nav.style.setProperty('margin','0','important'); nav.style.setProperty('z-index','99999','important');
    nav.style.setProperty('pointer-events','none','important'); nav.style.setProperty('touch-action','none','important');
    nav.querySelectorAll('button').forEach(b=>{b.style.setProperty('pointer-events','auto','important');b.style.setProperty('touch-action','manipulation','important')});
  }
}
function run91(){label91();fix91()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run91,{once:true});else run91();
window.addEventListener('load',run91,{once:true});
window.addEventListener('pageshow',run91);
requestAnimationFrame(run91);setTimeout(run91,250);setTimeout(run91,800);
