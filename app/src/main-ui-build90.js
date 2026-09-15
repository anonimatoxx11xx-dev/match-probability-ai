/* BUILD 90 — definitive Android WebView scroll/touch fix. UI only; Build78 engine/data logic remains untouched. */
import './main-ui-build89.js';
import './style-build90.css';

function build90Label(){
  const root=document.querySelector('#app');
  if(!root)return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[]; while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(n=>{if(n.nodeValue)n.nodeValue=n.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86|87|88|89)/g,'BUILD 90')});
}

function normalize90(){
  const html=document.documentElement, body=document.body, app=document.querySelector('#app');
  if(html){
    html.style.setProperty('height','auto','important');
    html.style.setProperty('min-height','100%','important');
    html.style.setProperty('overflow-x','hidden','important');
    html.style.setProperty('overflow-y','scroll','important');
    html.style.setProperty('touch-action','pan-y','important');
  }
  if(body){
    body.style.setProperty('height','auto','important');
    body.style.setProperty('min-height','100dvh','important');
    body.style.setProperty('overflow','visible','important');
    body.style.setProperty('touch-action','pan-y','important');
    body.style.setProperty('pointer-events','auto','important');
  }
  if(app){
    app.style.setProperty('height','auto','important');
    app.style.setProperty('min-height','0','important');
    app.style.setProperty('overflow','visible','important');
    app.style.setProperty('touch-action','pan-y','important');
    app.style.setProperty('pointer-events','auto','important');
    const root=app.querySelector('.app');
    if(root){
      root.style.setProperty('height','auto','important');
      root.style.setProperty('min-height','max-content','important');
      root.style.setProperty('overflow','visible','important');
      root.style.setProperty('touch-action','pan-y','important');
      root.style.setProperty('pointer-events','auto','important');
      root.style.setProperty('padding-bottom','220px','important');
    }
    const nav=app.querySelector('.app > nav');
    if(nav){
      nav.style.setProperty('position','fixed','important');
      nav.style.setProperty('left','8px','important');
      nav.style.setProperty('right','8px','important');
      nav.style.setProperty('bottom','max(8px, env(safe-area-inset-bottom, 8px))','important');
      nav.style.setProperty('width','auto','important');
      nav.style.setProperty('height','82px','important');
      nav.style.setProperty('margin','0','important');
      nav.style.setProperty('z-index','9999','important');
      nav.style.setProperty('pointer-events','none','important');
      nav.style.setProperty('touch-action','none','important');
      nav.querySelectorAll('button').forEach(b=>{
        b.style.setProperty('pointer-events','auto','important');
        b.style.setProperty('touch-action','manipulation','important');
      });
    }
  }
}

function enhance90(){build90Label();normalize90();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance90,{once:true});
else enhance90();
window.addEventListener('load',enhance90,{once:true});
window.addEventListener('pageshow',enhance90);
requestAnimationFrame(enhance90);
setTimeout(enhance90,300);
setTimeout(enhance90,1000);
