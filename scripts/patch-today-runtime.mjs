import fs from 'node:fs';
const p='api/today.ts';
let s=fs.readFileSync(p,'utf8');
let changed=false;
const oldFilter="(x.events||[]).filter((e:any)=>/Premier League|Serie A|LaLiga|La Liga|Bundesliga|Ligue 1|Champions League/i.test(String(e.uniqueTournament?.name||e.tournament?.name||''))).map";
if(s.includes(oldFilter)){s=s.replace(oldFilter,"(x.events||[]).filter((e:any)=>e.homeTeam?.name&&e.awayTeam?.name).map");changed=true;}
const oldBase="const base=maps.baseline.get(String(lid))||null;";
if(s.includes(oldBase)){const g="const globalBase=(()=>{const z=empty();for(const [,v] of maps.baseline){z.statMatches+=v.statMatches;z.shots+=n(v.shots);z.sot+=n(v.sot);z.corners+=n(v.corners);z.fouls+=n(v.fouls);z.saves+=n(v.saves);z.cards+=n(v.cards)}return z.statMatches?z:null})();const base=maps.baseline.get(String(lid))||globalBase;";s=s.replace(oldBase,g);changed=true;}
const oldCache="res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');";
if(s.includes(oldCache)){s=s.replace(oldCache,"res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');res.setHeader('CDN-Cache-Control','no-store');");changed=true;}
if(changed)fs.writeFileSync(p,s);
console.log(changed?'today.ts patched':'today.ts already patched');
