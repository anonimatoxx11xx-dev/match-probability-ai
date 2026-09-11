import { todayMatches as rawTodayMatches } from './provider-engine.js';
const S='https://api.sofascore.com/api/v1';
const cache=new Map();
const get=async u=>{if(cache.has(u))return cache.get(u);const p=(async()=>{try{const r=await fetch(u,{headers:{Accept:'application/json'}});if(!r.ok)return null;return await r.json()}catch{return null}})();cache.set(u,p);return p};
const competition=e=>{const t=e?.tournament||{},u=t?.uniqueTournament||t?.uniqueTournamentInfo;return u?.name||t?.name||u?.slug||t?.slug||e?.season?.name||'Altra competizione'};
const enrichBatch=async rows=>{const out=new Map();for(let i=0;i<rows.length;i+=20){const batch=rows.slice(i,i+20);const vals=await Promise.all(batch.map(x=>get(`${S}/event/${x.eventId}`)));vals.forEach((j,k)=>{const e=j?.event;if(e)out.set(batch[k].eventId,{league:competition(e),country:e?.tournament?.category?.name||'',sofaIdHome:e?.homeTeam?.id||null,sofaIdAway:e?.awayTeam?.id||null})})}return out};
export async function todayMatches(date){const rows=await rawTodayMatches(date);const missing=rows.filter(x=>!x.league||x.league==='Calcio'||x.league==='Altra competizione');const byId=await enrichBatch(missing);return rows.map(x=>{const d=byId.get(x.eventId);return d?{...x,...d}:x}).map(x=>({...x,league:x.league&&x.league!=='Calcio'?x.league:'Altra competizione'}));}
