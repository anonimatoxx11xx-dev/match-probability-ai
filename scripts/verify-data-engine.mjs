import { todayMatches, analyzeMatch, clearProviderCache } from '../app/src/provider-engine.js';

const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fail=(m)=>{console.error(`FAIL: ${m}`);process.exitCode=1};
const assert=(v,m)=>{if(!v)fail(m)};

console.log(`VERIFY DAY ${day}`);
clearProviderCache();
const matches=await todayMatches(day);
console.log(`FIXTURES ${matches.length}`);
assert(matches.length>0,'No real fixtures returned');
assert(matches.every(x=>x.home&&x.away&&x.time&&x.eventId),'Fixture with missing team/time/event id');
assert(new Set(matches.map(x=>x.id)).size===matches.length,'Duplicate fixture ids');
assert(matches.every(x=>x.league&&x.league!=='Calcio'),'A fixture is missing its real competition');

const sample=matches.slice(0,Math.min(5,matches.length));
const analyzed=await Promise.all(sample.map(x=>analyzeMatch(x)));
console.log('SAMPLE ANALYSIS');
for(const x of analyzed){console.log(`${x.home} vs ${x.away} | H2H=${x.h2hCount} | history=${x.H.form.length}/${x.A.form.length} | statRows=${x.verifiedStats}`)}
assert(analyzed.every(x=>x.H.form.length>0&&x.A.form.length>0),'A sampled team has no historical matches');
assert(analyzed.some(x=>x.h2hCount>0),'H2H endpoint returned zero meetings for every sampled fixture');
assert(analyzed.some(x=>x.verifiedStats>0),'No historical match statistics were recovered');

console.log('PASS: daily fixtures, team history, H2H and match statistics are available.');
