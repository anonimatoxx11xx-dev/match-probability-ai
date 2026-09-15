/* BUILD 80 UI entrypoint. Build78 engine/data and Build79 UI logic remain untouched. */
import './main-ui-build79.js';
import './style-build80.css';

const LEAGUE_META={
  'LaLiga':{flag:'🇪🇸',name:'LaLiga'},
  'Scottish Premiership':{flag:'🏴',name:'Scottish Premiership'},
  'Premier League':{flag:'🏴',name:'Premier League'},
  'Eredivisie':{flag:'🇳🇱',name:'Eredivisie'},
  'Serie A':{flag:'🇮🇹',name:'Serie A'},
  'Serie B':{flag:'🇮🇹',name:'Serie B'},
  'Bundesliga':{flag:'🇩🇪',name:'Bundesliga'},
  'Ligue 1':{flag:'🇫🇷',name:'Ligue 1'},
  'La Liga':{flag:'🇪🇸',name:'LaLiga'},
  'Primeira Liga':{flag:'🇵🇹',name:'Primeira Liga'},
  'Liga Portugal':{flag:'🇵🇹',name:'Liga Portugal'},
  'Regular Season':{flag:'🏟️',name:'Regular Season'}
};

const metaFor=name=>LEAGUE_META[String(name||'').trim()]||{flag:'⚽',name:String(name||'Altra competizione')};

const upgradeBuildLabel=()=>{
  const root=document.querySelector('#app');
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(n=>{if(n.nodeValue?.includes('BUILD 79'))n.nodeValue=n.nodeValue.replaceAll('BUILD 79','BUILD 80')});
};

const polishLeagues=()=>{
  const root=document.querySelector('#app');
  if(!root)return;
  root.querySelectorAll('.league-tabs button[data-league]').forEach(btn=>{
    const raw=btn.dataset.league||btn.textContent.replace(/^\S+\s*/,'').trim();
    const m=metaFor(raw);
    btn.textContent=`${m.flag} ${m.name}`;
  });
  root.querySelectorAll('.panel-list button[data-league]').forEach(btn=>{
    const key=btn.dataset.league||'';
    const m=metaFor(key);
    const span=btn.querySelector('span');
    const b=btn.querySelector('b');
    if(span)span.textContent=m.flag;
    if(b)b.textContent=m.name;
  });
};

new MutationObserver(()=>{upgradeBuildLabel();polishLeagues()}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
upgradeBuildLabel();
polishLeagues();

const forceTop=()=>{
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
  window.scrollTo(0,0);
};
try{history.scrollRestoration='manual'}catch(_e){}

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
  polishLeagues();
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
      setTimeout(()=>{normalizeLayout();forceTop();polishLeagues()},0);
      setTimeout(()=>{normalizeLayout();forceTop();polishLeagues()},80);
    });
  },true);
};
resetScrollOnNavigation();

const layoutObserver=new MutationObserver(()=>{
  normalizeLayout();
  polishLeagues();
  if(document.querySelector('#app')?.firstElementChild)requestAnimationFrame(forceTop);
});
const observeApp=()=>{
  const root=document.querySelector('#app');
  if(root)layoutObserver.observe(root,{childList:true,subtree:true});
  normalizeLayout();
  polishLeagues();
};
observeApp();
