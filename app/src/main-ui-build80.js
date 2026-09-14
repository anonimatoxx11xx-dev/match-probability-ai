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

// BUILD 80: force the WebView back to the real document top after every UI render.
// The previous version used behavior:'instant', which is not consistently supported
// by Android WebView and could leave the new page visually offset by hundreds of px.
const forceTop=()=>{
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
  window.scrollTo(0,0);
};
try{history.scrollRestoration='manual'}catch(_e){}

const resetScrollOnNavigation=()=>{
  document.addEventListener('click',e=>{
    const target=e.target?.closest?.('[data-tab],[data-league]');
    if(!target)return;
    forceTop();
    requestAnimationFrame(()=>{
      forceTop();
      requestAnimationFrame(forceTop);
      setTimeout(forceTop,0);
      setTimeout(forceTop,80);
    });
  },true);
};
resetScrollOnNavigation();

// Also guard programmatic render() calls: when a section is rebuilt, reset the
// document position on the next frame without touching the Build78/79 engines.
new MutationObserver(()=>{
  if(document.querySelector('#app')?.firstElementChild) requestAnimationFrame(forceTop);
}).observe(document.querySelector('#app'),{childList:true});
