export const SOURCE_REGISTRY=[
{name:'SofaScore',kind:'Live + stats + H2H',mode:'automatic',priority:1},
{name:'FotMob',kind:'Live + stats + H2H',mode:'automatic',priority:2},
{name:'ESPN',kind:'Fixtures + history + match reports',mode:'automatic',priority:3},
{name:'TheSportsDB',kind:'Fixtures + teams + events fallback',mode:'fallback',priority:4},
{name:'Football-Data.co.uk',kind:'Historical results + shots + corners + fouls + cards + odds',mode:'historical',priority:5},
{name:'StatsBomb Open Data',kind:'Research-grade event data / xG context',mode:'historical',priority:6},
{name:'FBref',kind:'Historical team/player context',mode:'research',priority:7},
{name:'Understat',kind:'xG/xGA research',mode:'research',priority:8},
{name:'WhoScored',kind:'Match and tactical statistics',mode:'research',priority:9},
{name:'Transfermarkt',kind:'Injuries + transfers + squad context',mode:'context',priority:10},
{name:'Soccerway / Flashscore',kind:'Fixtures + results cross-check',mode:'cross-check',priority:11},
{name:'365Scores',kind:'Fixtures + live cross-check',mode:'cross-check',priority:12},
{name:'Reddit / football communities',kind:'Qualitative community signals',mode:'community',priority:13},
{name:'Supporter forums',kind:'Qualitative team news / sentiment',mode:'community',priority:14},
{name:'Club / league official sites',kind:'Official injuries, suspensions, lineups and news',mode:'official',priority:15}
];
export const ACTIVE_SOURCE_NAMES=['SofaScore','FotMob','ESPN'];
export const sourceModeLabel=m=>({automatic:'AUTOMATICA',fallback:'FALLBACK',historical:'STORICO',research:'RICERCA',context:'CONTESTO','cross-check':'CROSS-CHECK',community:'COMMUNITY',official:'UFFICIALE'}[m]||String(m||'').toUpperCase());
