/* BUILD 91 — Today screen stabilization. UI only; Build78 engine/data logic remains untouched. */
import './main-ui-build90.js';
import './style-build91.css';

let lastY=0;
let restoring=false;
let allowJumpTop=false;

function update91Label(){
  const root=document.querySelector('#app');
  if(!root)return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(n=>{if(n.nodeValue)n.nodeValue=n.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86|87|88|89|90)/g,'BUILD 91')});
}

function scrollTop91(){
  try{window.scrollTo({top:0,left:0,behavior:'instant'});}catch{window.scrollTo(0,0)}
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
}

function restore91(){
  if(allowJumpTop){allowJumpTop=false;lastY=0;scrollTop91();return;}
  if(restoring||lastY<8)return;
  restoring=true;
  requestAnimationFrame(()=>{
    const y=Math.max(0,lastY);
    try{window.scrollTo({top:y,left:0,behavior:'instant'});}catch{window.scrollTo(0,y)}
    document.documentElement.scrollTop=y;
    document.body.scrollTop=y;
    restoring=false;
  });
}

function stabilize91(){
  const html=document.documentElement,body=document.body,app=document.querySelector('#app'),root=app?.querySelector('.app');
  [html,body,app,root].filter(Boolean).forEach(el=>{
    el.style.setProperty('overflow-x','hidden','important');
    el.style.setProperty('overflow-y','visible','important');
    el.style.setProperty('height','auto','important');
    el.style.setProperty('max-height','none','important');
    el.style.setProperty('touch-action','pan-y','important');
    el.style.setProperty('pointer-events','auto','important');
  });
  if(html)html.style.setProperty('overflow-y','auto','important');
  if(root){
    root.style.setProperty('min-height','max-content','important');
    root.style.setProperty('padding-bottom','180px','important');
  }
  const nav=root?.querySelector(':scope > nav');
  if(nav){
    nav.style.setProperty('position','fixed','important');
    nav.style.setProperty('left','8px','important');
    nav.style.setProperty('right','8px','important');
    nav.style.setProperty('bottom','56px','important');
    nav.style.setProperty('width','auto','important');
    nav.style.setProperty('height','82px','important');
    nav.style.setProperty('margin','0','important');
    nav.style.setProperty('z-index','99999','important');
    nav.style.setProperty('pointer-events','none','important');
    nav.style.setProperty('touch-action','none','important');
    nav.querySelectorAll('button').forEach(b=>{
      b.style.setProperty('pointer-events','auto','important');
      b.style.setProperty('touch-action','manipulation','important');
    });
  }
}

window.addEventListener('scroll',()=>{if(!restoring)lastY=window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0},{passive:true});

document.addEventListener('click',e=>{
  const target=e.target?.closest?.('[data-tab]');
  if(target){allowJumpTop=true;}
},{capture:true});

const observer=new MutationObserver(()=>{update91Label();stabilize91();restore91();});

function start91(){
  update91Label();
  stabilize91();
  lastY=window.scrollY||0;
  const app=document.querySelector('#app');
  if(app)observer.observe(app,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start91,{once:true});
else start91();
window.addEventListener('load',()=>{update91Label();stabilize91();restore91()},{once:true});
window.addEventListener('pageshow',()=>{stabilize91();restore91()});
requestAnimationFrame(()=>{stabilize91();restore91()});
setTimeout(()=>{stabilize91();restore91()},250);
setTimeout(()=>{stabilize91();restore91()},800);
