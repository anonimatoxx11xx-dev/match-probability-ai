import base from './index';
import { todayMatches } from './today';
import { runBacktest } from './backtest';
import { runMLBacktest } from './ml';

interface Env { DB: D1Database; API_FOOTBALL_KEY?: string; }
const json=(data:unknown,status=200,cacheSeconds=0)=>new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json;charset=UTF-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS',...(cacheSeconds?{'cache-control':`public, max-age=${cacheSeconds}`}: {})}});
let todayMemory:{key:string;at:number;data:any}|null=null;

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext){
    const u=new URL(request.url);
    if(request.method==='OPTIONS')return json({ok:true});
    if(request.method==='GET'&&u.pathname==='/api/today'){
      try{
        const key=u.searchParams.get('date')||'today';
        const now=Date.now();
        if(todayMemory&&todayMemory.key===key&&now-todayMemory.at<60000)return json(todayMemory.data,200,60);
        const data=await todayMatches(env,u.searchParams.get('date'));
        todayMemory={key,at:now,data};
        return json(data,200,60);
      }catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},502)}
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
  async scheduled(controller:ScheduledController,env:Env,ctx:ExecutionContext){return (base as any).scheduled(controller,env,ctx)}
};
