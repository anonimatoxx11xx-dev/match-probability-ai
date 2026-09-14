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

// BUILD 80 HARD FIX: Build79 renders the page body inside <header> because the
// legacy template is missing the closing header tag. Normalize that UI-only DOM
// structure after every render. Build78/79 engines and data are untouched.
let normalizing=false;
const normalizeLayout=()=>{
  if(normalizing)return;
  const app=document.querySelector('#app>.app');
  const header=app?.querySelector(':scope > header');
  if(!app||!header)return;
  const move=[...header.children].filter(el=>!el.classList.contains('brand')&&!el.classList.contains('header-icons'));
  if(!move.length)return;
  normalizing=true;
  move.forEach(el=>app.appendChild(el));
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
      setTimeout(forceTop,0);
      setTimeout(forceTop,80);
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
  if(root)layoutObserver.observe(root,{childList:true,subtree:false});
  normalizeLayout();
};
observeApp();