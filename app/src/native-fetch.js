import { Capacitor, CapacitorHttp } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch.bind(window);
  const nativeGet = async (url) => {
    const u=String(url); const isSofa=/sofascore\.(com|app)/i.test(u), isFot=/fotmob\.com/i.test(u), isEspn=/espn\.com/i.test(u), isSportsDb=/thesportsdb\.com/i.test(u);
    const headers={Accept:'application/json, text/plain, */*','Accept-Language':'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7','Cache-Control':'no-cache',Pragma:'no-cache','User-Agent':'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'};
    if(isSofa){headers.Referer='https://www.sofascore.com/';headers.Origin='https://www.sofascore.com';headers['X-Requested-With']='XMLHttpRequest'}else if(isFot){headers.Referer='https://www.fotmob.com/';headers.Origin='https://www.fotmob.com'}else if(isEspn)headers.Referer='https://www.espn.com/';else if(isSportsDb)headers.Referer='https://www.thesportsdb.com/';
    let last={status:0,data:null}; const candidates=[u]; if(isSofa&&u.startsWith('https://api.sofascore.com/api/v1/'))candidates.push(u.replace('https://api.sofascore.com/api/v1/','https://api.sofascore.app/api/v1/'));
    for(const candidate of candidates)for(let attempt=0;attempt<2;attempt++){try{const r=await CapacitorHttp.get({url:candidate,headers});last=r;const status=Number(r?.status||0);if(status>=200&&status<300)return r;if(status===429)break}catch(e){last={status:0,data:null,error:String(e)}}}
    return last;
  };
  window.fetch=async(input,init={})=>{let url=typeof input==='string'?input:input?.url;const method=String(init.method||'GET').toUpperCase();if(!url||!/^https?:\/\//i.test(url)||method!=='GET')return originalFetch(input,init);if(url.includes('www.fotmob.com/api/matches?'))url=url.replace('/api/matches?','/api/data/matches?');if(url.startsWith('https://www.sofascore.com/api/v1/'))url=url.replace('https://www.sofascore.com/api/v1/','https://api.sofascore.com/api/v1/');const r=await nativeGet(url);const data=r?.data;return new Response(typeof data==='string'?data:JSON.stringify(data??null),{status:Number(r?.status||502),headers:new Headers(r?.headers||{'content-type':'application/json'})})};
}
