/* BUILD 100 — sporty football UI wrapper. Build78 engine/data untouched. */
import './main-ui-build99.js';
import './style-build100.css';

function relabel(){const r=document.querySelector('#app');if(!r)return;const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode;if(n.nodeValue)n.nodeValue=n.nodeValue.replace(/BUILD (79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99)/g,'BUILD 100')}}
function init(){relabel()}
const obs=new MutationObserver(()=>requestAnimationFrame(init));
function start(){const r=document.querySelector('#app');if(!r||r.dataset.b100==='1')return;r.dataset.b100='1';obs.observe(r,{childList:true,subtree:true,characterData:true});init()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();window.addEventListener('load',start,{once:true});
