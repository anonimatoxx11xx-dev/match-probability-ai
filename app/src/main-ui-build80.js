/* BUILD 80 UI entrypoint. The Build79 UI and Build78-compatible data/analysis engines are not modified. */
import './main-ui-build79.js';
import './style-build80.css';

// Keep the proven Build79 rendering/data path intact while presenting this release as Build80.
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

// When changing sections, always return to the top. Without this, the browser keeps
// the previous scroll position and can leave a large empty area above the new page.
const resetScrollOnNavigation=()=>{
  document.addEventListener('click',e=>{
    const target=e.target?.closest?.('[data-tab],[data-league]');
    if(!target)return;
    requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
  },true);
};
resetScrollOnNavigation();
