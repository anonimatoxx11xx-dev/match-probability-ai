/* BUILD 93 — fix automatic upward jumps caused by full #app rerenders. UI ONLY. */
import './main-ui-build92.js';

const root=()=>document.querySelector('#app');
let lastY=0;
let restoring=false;
let initialized=false;

function rememberScroll(){
  if(!restoring) lastY=Math.max(0,window.scrollY||window.pageYOffset||0);
}

function restoreAfterRender(y){
  if(!Number.isFinite(y)||y<1)return;
  restoring=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    window.scrollTo(0,y);
    restoring=false;
  }));
}

function installScrollGuard(){
  const app=root();
  if(!app||app.dataset.build93Guard==='1')return;
  app.dataset.build93Guard='1';
  lastY=Math.max(0,window.scrollY||window.pageYOffset||0);
  window.addEventListener('scroll',rememberScroll,{passive:true});

  /* main-ui-build79 render() replaces the entire .app element after every
     analysis result. That DOM replacement is what makes the page jump back
     upward while the user is swiping. Detect replacement of .app and restore
     the user's previous document position. This does NOT create or change a
     scroll container. */
  let current=app.querySelector(':scope > .app');
  const observer=new MutationObserver(()=>{
    const next=app.querySelector(':scope > .app');
    if(next!==current){
      const y=lastY;
      current=next;
      if(y>0)restoreAfterRender(y);
    }
  });
  observer.observe(app,{childList:true});
}

function start(){
  if(initialized)return;
  initialized=true;
  installScrollGuard();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
window.addEventListener('load',start,{once:true});
