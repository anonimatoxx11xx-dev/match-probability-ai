/* BUILD 94 — source-level fix for scroll jumps during Build79 render(). UI ONLY. */

/* IMPORTANT:
   Build79 render() replaces #app.innerHTML after every async match analysis.
   Build93 watched the DOM after the replacement, but on Android WebView the
   browser can emit the scroll event caused by that replacement before the
   MutationObserver callback runs. That overwrites the saved position with 0.

   Build94 therefore hooks the exact innerHTML write BEFORE Build79 executes.
   The scroll position is captured synchronously at the moment render() starts,
   then restored immediately and on subsequent animation frames. No overflow,
   scroll container, engine or data logic is changed.
*/

const nativeDescriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
const nativeSetter=nativeDescriptor?.set;
const nativeGetter=nativeDescriptor?.get;

function readScroll(){
  const a=Number(window.scrollY||0);
  const b=Number(window.pageYOffset||0);
  const d=Number(document.documentElement?.scrollTop||0);
  const body=Number(document.body?.scrollTop||0);
  return Math.max(0,a,b,d,body);
}

function restoreScroll(y){
  if(!Number.isFinite(y)||y<1)return;
  const apply=()=>{
    window.scrollTo(0,y);
    if(document.documentElement)document.documentElement.scrollTop=y;
    if(document.body)document.body.scrollTop=y;
  };
  apply();
  requestAnimationFrame(apply);
  requestAnimationFrame(()=>requestAnimationFrame(apply));
  setTimeout(apply,80);
  setTimeout(apply,180);
}

if(nativeSetter){
  Object.defineProperty(Element.prototype,'innerHTML',{
    configurable:nativeDescriptor.configurable,
    enumerable:nativeDescriptor.enumerable,
    get:nativeGetter,
    set(value){
      const isApp=this?.id==='app';
      const y=isApp?readScroll():0;
      nativeSetter.call(this,value);
      if(isApp&&y>0)restoreScroll(y);
    }
  });
}

/* Load Build79 only AFTER the hook is installed, so its initial build and all
   later render() calls pass through the source-level guard above. */
import('./main-ui-build79.js');

window.addEventListener('load',()=>{
  const root=document.querySelector('#app');
  if(root)root.querySelectorAll('.eyebrow,.brand small').forEach(n=>{
    n.textContent=n.textContent.replace(/BUILD 79/g,'BUILD 94');
  });
},{once:true});
