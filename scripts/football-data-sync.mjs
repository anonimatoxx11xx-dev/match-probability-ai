const API = 'https://api.football-data.org/v4';
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
if (!API_KEY) throw new Error('FOOTBALL_DATA_API_KEY secret mancante');
const currentSeason = Number(process.env.SEASON || 2026);
const seasons = [...new Set([currentSeason, currentSeason - 1, currentSeason - 2])];
const competitions = [
  { code:'SA',name:'Serie A',country:'Italy',apiFootballLeagueId:135 },{ code:'PL',name:'Premier League',country:'England',apiFootballLeagueId:39 },
  { code:'PD',name:'La Liga',country:'Spain',apiFootballLeagueId:140 },{ code:'BL1',name:'Bundesliga',country:'Germany',apiFootballLeagueId:78 },
  { code:'FL1',name:'Ligue 1',country:'France',apiFootballLeagueId:61 },{ code:'CL',name:'Champions League',country:'Europe',apiFootballLeagueId:2 }
];
const BASE = new URL('../data/api-football/latest.json', import.meta.url); const fs = await import('node:fs/promises');
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const teamKey = s => { const a={ 'fc internazionale milano':'inter','internazionale milano':'inter','inter milano':'inter' }; const t=norm(s).split(' ').filter(x=>!['fc','acf','as','ss','us','ac','bc','cfc','calcio','football','club','1907','1909','1913','1893'].includes(x)); return a[t.join(' ')]||t.join(' '); };
async function api(path){const r=await fetch(`${API}${path}`,{headers:{'X-Auth-Token':API_KEY,accept:'application/json'}});const text=await r.text();let d;try{d=JSON.parse(text)}catch{throw new Error(`football-data HTTP ${r.status}: ${text.slice(0,300)}`)}if(!r.ok)throw new Error(`football-data HTTP ${r.status}: ${JSON.stringify(d)}`);return d;}
let base={generatedAt:null,season:currentSeason,mode:'merged',leagues:[],teams:[],fixtures:[]};try{base=JSON.parse(await fs.readFile(new URL(BASE),'utf8'))}catch{console.error('Snapshot precedente non presente: creo football-data-only.');}
const fixtures=[...(Array.isArray(base.fixtures)?base.fixtures:[])];
const teamsByKey=new Map();
for(const t of (Array.isArray(base.teams)?base.teams:[])){const k=`${t.leagueId}|${teamKey(t.name)}`;const old=teamsByKey.get(k);if(!old||Number(t.apiId)<Number(old.apiId))teamsByKey.set(k,t);}
const existingKeys=new Set(fixtures.map(f=>[String(f.league?.id||''),norm(f.home?.name),norm(f.away?.name),String(f.kickoff||'').slice(0,16)].join('|')));
let imported=0,duplicates=0;
for(const season of seasons){
  for(const comp of competitions){
    const data=await api(`/competitions/${comp.code}/matches?season=${season}&limit=500`);
    for(const m of (Array.isArray(data.matches)?data.matches:[])){
      if(m.status!=='FINISHED'||m.score?.fullTime?.home==null||m.score?.fullTime?.away==null)continue;
      const hn=m.homeTeam?.name,an=m.awayTeam?.name;if(!m.id||!hn||!an)continue;
      const kickoff=m.utcDate||null,key=[String(comp.apiFootballLeagueId),norm(hn),norm(an),String(kickoff||'').slice(0,16)].join('|');
      if(existingKeys.has(key)){duplicates++;continue;}
      const hk=`${comp.apiFootballLeagueId}|${teamKey(hn)}`,ak=`${comp.apiFootballLeagueId}|${teamKey(an)}`;
      let ht=teamsByKey.get(hk),at=teamsByKey.get(ak);
      if(!ht){ht={apiId:100000000+Number(m.homeTeam.id),name:hn,leagueId:comp.apiFootballLeagueId};teamsByKey.set(hk,ht)}
      if(!at){at={apiId:100000000+Number(m.awayTeam.id),name:an,leagueId:comp.apiFootballLeagueId};teamsByKey.set(ak,at)}
      const matchId=200000000+Number(m.id);
      fixtures.push({fixtureId:matchId,kickoff,status:'FT',league:{id:comp.apiFootballLeagueId,name:comp.name,country:comp.country,season},home:{id:ht.apiId,name:ht.name},away:{id:at.apiId,name:at.name},goals:{home:Number(m.score.fullTime.home),away:Number(m.score.fullTime.away)},stats:{home:{shots:null,sot:null,corners:null,fouls:null,saves:null,cards:null},away:{shots:null,sot:null,corners:null,fouls:null,saves:null,cards:null}},source:'football-data.org',sourceMatchId:m.id,sourceSeason:season});
      existingKeys.add(key);imported++;
    }
  }
}
fixtures.sort((a,b)=>String(a.kickoff).localeCompare(String(b.kickoff)));
const snapshot={generatedAt:new Date().toISOString(),season:currentSeason,mode:'merged-api-football-plus-football-data-multi-season',providers:['api-football','football-data.org'],leagues:base.leagues?.length?base.leagues:competitions.map(c=>({id:c.apiFootballLeagueId,name:c.name,country:c.country,localLeague:c.name})),teams:[...teamsByKey.values()],fixtures};
console.error(`football-data seasons=${seasons.join(',')} imported=${imported} duplicates=${duplicates} totalFixtures=${fixtures.length} uniqueTeams=${snapshot.teams.length}`);process.stdout.write(JSON.stringify(snapshot,null,2));