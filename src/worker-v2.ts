import base from './index';
import { todayMatches } from './today';
import { runBacktest } from './backtest';
import { runMLBacktest } from './ml';

interface Env {
  DB: D1Database;
  API_FOOTBALL_KEY?: string;
  PREDICTIONS_KV?: KVNamespace;
}

const json=(data:unknown,status=200,cacheSeconds=0,extra:Record<string,string>={})=>new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json;charset=UTF-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS',...(cacheSeconds?{'cache-control':`public, max-age=${cacheSeconds}`}:{}),...extra}});
let todayMemory:{key:string;at:number;data:any}|null=null;
let todayInflight:Promise<any>|null=null;

function romeDate(){
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  return `${p.find(x=>x.type==='year')?.value}-${p.find(x=>x.type==='month')?.value}-${p.find(x=>x.type==='day')?.value}`;
}

function cacheKey(date:string){return `predictions:v1:${date}`;}

async function getTodayCached(env:Env,date:string){
  if(!env.PREDICTIONS_KV)return null;
  try{
    const raw=await env.PREDICTIONS_KV.get(cacheKey(date));
    return raw?JSON.parse(raw):null;
  }catch(_){return null;}
}

async function buildToday(env:Env,date:string){
  if(todayInflight)return todayInflight;
  todayInflight=todayMatches(env,date).finally(()=>{todayInflight=null});
  return todayInflight;
}

async function putTodayCached(env:Env,date:string,data:any){
  if(!env.PREDICTIONS_KV)return;
  try{
    // Keep the daily snapshot available through the following day.
    await env.PREDICTIONS_KV.put(cacheKey(date),JSON.stringify(data),{expirationTtl:172800});
  }catch(_){
    // KV failure must never make the prediction endpoint unavailable.
  }
}

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext){
    const u=new URL(request.url);
    if(request.method==='OPTIONS')return json({ok:true});

    if(request.method==='GET'&&u.pathname==='/api/today'){
      try{
        const date=u.searchParams.get('date')||romeDate();
        const key=date;
        const now=Date.now();

        // Fast isolate-local cache: zero D1 and zero KV on repeated requests.
        if(todayMemory&&todayMemory.key===key&&now-todayMemory.at<60000){
          return json(todayMemory.data,200,60,{'x-predictions-cache':'memory'});
        }

        // Persistent global cache: normal app opens stop touching D1.
        const cached=await getTodayCached(env,date);
        if(cached){
          todayMemory={key,at:now,data:cached};
          return json(cached,200,60,{'x-predictions-cache':'kv'});
        }

        // Only a cache miss reaches D1/API sources.
        const data=await buildToday(env,date);
        todayMemory={key,at:now,data};
        ctx.waitUntil(putTodayCached(env,date,data));
        return json(data,200,60,{'x-predictions-cache':'miss'});
      }catch(e){
        return json({ok:false,error:e instanceof Error?e.message:String(e)},502);
      }
    }

    if(request.method==='GET'&&u.pathname==='/api/backtest'){
      try{
        const minHistory=Math.max(1,Math.min(20,Number(u.searchParams.get('minHistory')||3)));
        const league=u.searchParams.get('league')||'Serie A';
        const poisson=await runBacktest(env,league,minHistory);
        const ml=await runMLBacktest(env,league,minHistory);
        return json({league,minHistory,poisson,ml,best:ml.evaluated>0&&(!poisson.evaluated||ml.accuracy>poisson.accuracy)?'ml':'poisson'});
      }catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},500)}
    }

    if(request.method==='GET'&&(u.pathname==='/api/ml/backtest'||u.pathname==='/api/ml-backtest')){
      try{
        const league=u.searchParams.get('league')||'Serie A';
        const minHistory=Math.max(1,Math.min(20,Number(u.searchParams.get('minHistory')||3)));
        return json(await runMLBacktest(env,league,minHistory));
      }catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},500)}
    }

    return (base as any).fetch(request,env,ctx);
  },

  async scheduled(controller:ScheduledController,env:Env,ctx:ExecutionContext){
    // First keep the existing historical sync. Then calculate today's
    // predictions once and persist the finished snapshot in KV.
    await (base as any).scheduled(controller,env,ctx);
    try{
      const date=romeDate();
      const data=await buildToday(env,date);
      await putTodayCached(env,date,data);
      todayMemory={key:date,at:Date.now(),data};
    }catch(_){
      // The scheduled sync must not be marked failed only because prediction
      // enrichment/API data is temporarily unavailable.
    }
  }
};
