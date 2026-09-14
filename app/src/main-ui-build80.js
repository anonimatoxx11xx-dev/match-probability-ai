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
