/* BUILD 89 — UI ONLY. Build78 engine/data logic remains untouched. */
import './main-ui-build88.js';
import './style-build89.css';

function build89Label(){
  const root=document.querySelector('#app');
  if(!root)return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(n=>{if(n.nodeValue)n.nodeValue=n.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86|87|88)/g,'BUILD 89')});
}

function normalize89(){
  const html=document.documentElement, body=document.body, app=document.querySelector('#app');
  [html,body,app].filter(Boolean).forEach(el=>{
    el.style.setProperty('overflow-x','hidden','important');
    el.style.setProperty('overflow-y','auto','important');
    el.style.setProperty('height','auto','important');
    el.style.setProperty('touch-action','pan-y','important');
    el.style.setProperty('pointer-events','auto','important');
  });
  const root=app?.querySelector('.app');
  if(root){
    root.style.setProperty('height','auto','important');
    root.style.setProperty('min-height','0','important');
    root.style.setProperty('overflow','visible','important');
    root.style.setProperty('padding-bottom','24px','important');
  }
  const nav=app?.querySelector('.app > nav');
  if(nav){
    nav.style.setProperty('position','relative','important');
    nav.style.setProperty('left','auto','important');
    nav.style.setProperty('right','auto','important');
    nav.style.setProperty('top','auto','important');
    nav.style.setProperty('bottom','auto','important');
    nav.style.setProperty('width','100%','important');
    nav.style.setProperty('height','82px','important');
    nav.style.setProperty('margin','18px 0 10px','important');
    nav.style.setProperty('transform','none','important');
    nav.style.setProperty('pointer-events','auto','important');
    nav.style.setProperty('touch-action','manipulation','important');
  }
  app?.querySelectorAll('.match-card').forEach(card=>{
    card.style.setProperty('pointer-events','auto','important');
    card.style.setProperty('position','relative','important');
    card.style.setProperty('z-index','1','important');
  });
}
function enhance89(){build89Label();normalize89();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance89,{once:true});
else enhance89();
window.addEventListener('load',enhance89,{once:true});
window.addEventListener('pageshow',enhance89);
requestAnimationFrame(enhance89);
setTimeout(enhance89,300);
setTimeout(enhance89,1000);
