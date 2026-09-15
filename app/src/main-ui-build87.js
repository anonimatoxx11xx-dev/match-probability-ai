/* BUILD 87 interactive UI correction layer. UI only; Build78 engine/data logic remains untouched. */
import './main-ui-build81.js';
import './style-build87.css';
const logoOverrides={
  'rayo vallecano':2818,
  'espanyol':2814,
  'rcd espanyol':2814,
  'rcd espanyol barcelona':2814
};
const logoCache=new Map();
function build87Label(){const root=document.querySelector('#app');if(!root)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(w.nextNode())nodes.push(w.currentNode);nodes.forEach(n=>{if(n.nodeValue)n.nodeValue=n.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86)/g,'BUILD 87')})}
async function sofaLogo(name){const key=String(name||'').trim().toLowerCase();if(!key)return null;if(logoCache.has(key))return logoCache.get(key);const known=logoOverrides[key];if(known){const u=`https://api.sofascore.com/api/v1/team/${known}/image`;logoCache.set(key,u);return u}const promise=(async()=>{try{const r=await fetch(`https://www.sofascore.com/api/v1/search/all?q=${encodeURIComponent(name)}`);if(!r.ok)return null;const j=await r.json();const rows=j?.results||j?.searchResults||[];const hit=rows.find(x=>String(x?.entity?.type||x?.type||x?.entity?.entityType||'').toLowerCase()==='team'&&x?.entity?.id)||rows.find(x=>x?.entity?.id);const id=hit?.entity?.id||hit?.id;return id?`https://api.sofascore.com/api/v1/team/${id}/image`:null}catch{return null}})();logoCache.set(key,promise);return promise}
async function build87Logos(){const root=document.querySelector('#app');if(!root)return;for(const team of root.querySelectorAll('.match-card .team')){const box=team.querySelector('.crest');if(!box||box.dataset.b87==='1')continue;box.dataset.b87='1';const fallback=box.querySelector('.crest-fallback');if(fallback)fallback.hidden=false;const existing=box.querySelector('img');if(existing){existing.onload=()=>{if(fallback)fallback.hidden=true};existing.onerror=()=>{existing.remove();if(fallback)fallback.hidden=false};continue}const name=team.querySelector('.team-copy b')?.textContent?.trim();const src=await sofaLogo(name);if(!src)continue;const img=document.createElement('img');img.alt=`Logo ${name}`;img.loading='eager';img.onload=()=>{if(fallback)fallback.hidden=true};img.onerror=()=>{img.remove();if(fallback)fallback.hidden=false};img.src=src;box.appendChild(img)}}
function enhance87(){build87Label();build87Logos()}
const obs87=new MutationObserver(()=>requestAnimationFrame(enhance87));obs87.observe(document.documentElement,{childList:true,subtree:true});requestAnimationFrame(enhance87);
