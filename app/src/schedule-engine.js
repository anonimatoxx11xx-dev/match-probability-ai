const SOFA='https://api.sofascore.com/api/v1';
const ESPN='https://site.api.espn.com/apis/site/v2/sports/soccer';
const TS='https://www.thesportsdb.com/api/v1/json/123';
const cache=new Map();
const leagues=['eng.1','eng.2','eng.3','eng.4','esp.1','esp.2','ita.1','ita.2','ger.1','ger.2','fra.1','fra.2','ned.1','ned.2','bel.1','tur.1','tur.2','por.1','sco.1','sco.2','gre.1','aut.1','sui.1','den.1','swe.1','nor.1','pol.1','rou.1','cze.1','svk.1','hrv.1','srb.1','mex.1','usa.1','bra.1','arg.1','col.1','ecu.1','per.1','jpn.1','kor.1','sau.1','qat.1','rsa.1','irl.1','chn.1','uefa.champions','uefa.europa','uefa.europa.conf','conmebol.libertadores','conmebol.sudamericana'];
const get=async(url,key)=>{if(cache.has(key))return cache.get(key);const p=fetch(url,{headers:{Accept:'application/json'}}).then(async r=>r.ok?r.json():null).catch(()=>null);cache.set(key,p);return p};
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function sofa(j){return(j?.events||[]).map(e=>{const h=e.homeTeam?.name,a=e.awayTeam?.name;if(!h||!a)return null;const st=String(e.status?.type||'').toLowerCase();if(['canceled','postponed','deleted'].includes(st))return null;return{id:'fixture-sofa-'+e.id,sofaId:String(e.id),home:h,away:a,league:e.tournament?.uniqueTournament?.name||e.tournament?.name||'Calcio',leagueId:e.tournament?.uniqueTournament?.id||e.tournament?.id||0,time:e.startTimestamp?new Date(e.startTimestamp*1000).toISOString():e.startTime||'',status:st,source:'SofaScore'}}).filter(Boolean)}
function espn(j,league){return(j?.events||[]).map(e=>{const c=e.competitions?.[0]?.competitors||[],h=c.find(x=>x.homeAway==='home')||c[0],a=c.find(x=>x.homeAway==='away')||c[1],hn=h?.team?.displayName,an=a?.team?.displayName;if(!hn||!an)return null;return{id:'fixture-espn-'+e.id,espnId:String(e.id),home:hn,away:an,league:e.league?.name||e.season?.displayName||league,leagueId:league,time:e.date||'',status:String(e.status?.type?.name||e.status?.type||'').toLowerCase(),source:'ESPN'}}).filter(Boolean)}
function ts(j){return(j?.events||j?.results||[]).map(e=>{const h=e.strHomeTeam,a=e.strAwayTeam;if(!h||!a)return null;return{id:'fixture-ts-'+e.idEvent,tsId:String(e.idEvent),home:h,away:a,league:e.strLeague||e.strSport||'Calcio',time:e.strTimestamp||e.dateEvent||'',status:String(e.strStatus||'scheduled').toLowerCase(),source:'TheSportsDB'}}).filter(Boolean)}
const norm=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const key=x=>norm(x.home)+'|'+norm(x.away)+'|'+String(x.time||'').slice(0,10);
export async function todayMatches(){
 const d=day();
 const requests=[get(`${SOFA}/sport/football/scheduled-events/${d}`,'sofa:'+d),...leagues.map(l=>get(`${ESPN}/${l}/scoreboard?dates=${d.replace(/-/g,'')}`,'espn:'+l+':'+d)),get(`${TS}/eventsday.php?d=${d}&s=Soccer`,'ts:'+d)];
 const [sj,...rest]=await Promise.all(requests);
 const all=[...sofa(sj),...rest.slice(0,-1).flatMap((j,i)=>espn(j,leagues[i])),...ts(rest.at(-1))];
 const m=new Map();
 for(const x of all){const k=key(x),old=m.get(k);m.set(k,old?{...old,source:[old.source,x.source].filter(Boolean).join(' + '),sofaId:old.sofaId||x.sofaId,espnId:old.espnId||x.espnId,tsId:old.tsId||x.tsId}:x)}
 return[...m.values()].sort((a,b)=>String(a.league).localeCompare(String(b.league),'it')||new Date(a.time)-new Date(b.time));
}
