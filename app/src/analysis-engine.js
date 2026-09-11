const S='https://api.sofascore.com/api/v1';
const F='https://www.fotmob.com';
const cache=new Map();
const norm=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(fc|afc|sk|club|cf|fk|sc|ac|as|sv|bk|kv)\b/g,'').replace(/[^a-z0-9]/g,'');
const same=(a,b)=>{const x=norm(a),y=norm(b);return!!x&&!!y&&(x===y||x.includes(y)||y.includes(x))};
const n=x=>{if(x&&typeof x==='object')x=x.current??x.normaltime??x.displayValue??x.value??x.score;if(typeof x==='string'&&x.includes('/'))x=x.split('/')[0];const m=String(x??'').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null};
const get=async u=>{if(cache.has(u))return cache.get(u);const p=(async()=>{try{const r=await fetch(u,{headers:{Accept:'application/json'}});if(!r.ok)return null;return await r.json()}catch{return null}})();cache.set(u,p);return p};
const finished=e=>['finished','ended','afterpenalties','afterextra'].includes(String(e?.status?.type||'').toLowerCase());
function historyRows(events,name){return(events||[]).filter(finished).map(e=>{const h=e?.homeTeam?.name,a=e?.awayTeam?.name,hg=n(e?.homeScore),ag=n(e?.awayScore);if(!h||!a||hg==null||ag==null)return null;const home=same(h,name),away=same(a,name);if(!home&&!away)return null;return{id:'sofa-'+e.id,eventId:String(e.id),team:name,opp:home?a:h,home,gf:home?hg:ag,ga:home?ag:hg,time:e.startTimestamp?new Date(e.startTimestamp*1000).toISOString():e.startTime||'',sofaEvent:e}}).filter(Boolean)}
async function teamHistory(name,id){if(!id)return[];const pages=await Promise.all(Array.from({length:5},(_,p)=>get(`${S}/team/${id}/events/last/${p}`)));const map=new Map();for(const r of pages.flatMap(x=>historyRows(x?.events,name)))if(!map.has(r.eventId))map.set(r.eventId,r);return[...map.values()].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,18)}
async function searchId(name){const j=await get(`${S}/search/all?q=${encodeURIComponent(name)}`);const rows=(j?.results||[]).filter(x=>String(x.entity?.type||'').toLowerCase()==='team');const hit=rows.find(x=>same(x.entity?.name,name))||rows[0];return hit?.entity?.id||null}
async function h2h(eventId,home,away){if(!eventId)return[];const j=await get(`${S}/event/${eventId}/h2h/events`);return historyRows(j?.events||[],home).filter(x=>same(x.opp,away)).map(x=>({...x,h2h:true}))}
function statKey(v){const t=String(v||'').toLowerCase().replace(/[_-]/g,' ');if(/total shots|shot attempts|^shots$/.test(t))return'shots';if(/shot.*target|on target|on goal/.test(t))return'shotsOnTarget';if(/corner/.test(t))return'corners';if(/foul/.test(t))return'fouls';if(/yellow|booking|caution/.test(t))return'yellow';if(/offside/.test(t))return'offsides';if(/throw.?in/.test(t))return'throwIns';if(/save/.test(t))return'saves';return null}
async function eventStats(row,team){const j=await get(`${S}/event/${row.eventId}/statistics`);const groups=(j?.statistics||[]).find(x=>String(x.period).toUpperCase()==='ALL')?.groups||[];const h=j?.event?.homeTeam?.name||row.sofaEvent?.homeTeam?.name||'',a=j?.event?.awayTeam?.name||row.sofaEvent?.awayTeam?.name||'',data={};for(const g of groups)for(const r of g.statisticsItems||[]){const k=statKey(r.key||r.name||r.title),hv=n(r.homeValue??r.home),av=n(r.awayValue??r.away);if(k&&hv!=null&&av!=null)data[k]=same(h,team)?hv:same(a,team)?av:null}return data}
export async function analyzeMatch(match){
 const homeId=match.sofaIdHome||await searchId(match.home),awayId=match.sofaIdAway||await searchId(match.away);
 const [hf,af,hh]=await Promise.all([teamHistory(match.home,homeId),teamHistory(match.away,awayId),h2h(match.eventId,match.home,match.away)]);
 const h2hRows=hh.slice(0,10);
 const homeRows=[...h2hRows,...hf.filter(x=>!h2hRows.some(y=>y.eventId===x.eventId))].slice(0,12);
 const awayRows=[...h2hRows.map(x=>({...x,team:match.away,opp:match.home,home:!x.home,gf:x.ga,ga:x.gf})),...af.filter(x=>!h2hRows.some(y=>y.eventId===x.eventId))].slice(0,12);
 const statTargets=[...new Map([...h2hRows,...hf.slice(0,4),...af.slice(0,4)].map(x=>[x.eventId,x])).values()].slice(0,8);
 const statHome=await Promise.all(statTargets.map(x=>eventStats(x,match.home)));
 const statMap=new Map(statTargets.map((x,i)=>[x.eventId,statHome[i]]));
 const hs=homeRows.map(x=>({...x,data:statMap.get(x.eventId)||{}}));
 const as=awayRows.map(x=>({...x,data:statMap.get(x.eventId)||{}}));
 const verified=[...statMap.values()].filter(x=>Object.keys(x).length).length;
 return {...match,homeData:{sofaId:homeId},awayData:{sofaId:awayId},H:{form:homeRows,stats:hs},A:{form:awayRows,stats:as},h2h:h2hRows,h2hCount:h2hRows.length,verifiedStats:verified,loading:false};
}
export function clearAnalysisCache(){cache.clear()}
