/* BUILD 80 UI entrypoint. The Build79 UI and Build78-compatible data/analysis engines are not modified. */
import './main-ui-build79.js';
import './style-build80.css';

const upgradeBuildLabel=()=>{
  const root=document.querySelector('#app');
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(n=>{if(n.nodeValue?.includes('BUILD 79'))n.nodeValue=n.nodeValue.replaceAll('BUILD 79','BUILD 80')});
};
new MutationObserver(upgradeBuildLabel).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
upgradeBuildLabel();

const forceTop=()=>{
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
  window.scrollTo(0,0);
};
try{history.scrollRestoration='manual'}catch(_e){}

// BUILD 80 HARD FIX v2: the legacy Build79 template can leave the rendered
// page inside <header>. Move the actual page sections out of header regardless
// of nesting depth. This is UI-only; Build78/79 engines and data are untouched.
let normalizing=false;
const normalizeLayout=()=>{
  if(normalizing)return;
  const app=document.querySelector('#app>.app');
  if(!app)return;
  const header=app.querySelector(':scope > header');
  if(!header)return;

  const sections=[...header.querySelectorAll('.hero,.page,nav')];
  if(!sections.length)return;

  normalizing=true;
  sections.forEach(el=>app.appendChild(el));
  normalizing=false;
  forceTop();
};

const resetScrollOnNavigation=()=>{
  document.addEventListener('click',e=>{
    const target=e.target?.closest?.('[data-tab],[data-league]');
    if(!target)return;
    normalizeLayout();
    forceTop();
    requestAnimationFrame(()=>{
      normalizeLayout();
      forceTop();
      requestAnimationFrame(forceTop);
      setTimeout(()=>{normalizeLayout();forceTop()},0);
      setTimeout(()=>{normalizeLayout();forceTop()},80);
    });
  },true);
};
resetScrollOnNavigation();

const layoutObserver=new MutationObserver(()=>{
  normalizeLayout();
  if(document.querySelector('#app')?.firstElementChild)requestAnimationFrame(forceTop);
});
const observeApp=()=>{
  const root=document.querySelector('#app');
  if(root)layoutObserver.observe(root,{childList:true,subtree:true});
  normalizeLayout();
};
observeApp();