import { Capacitor, CapacitorHttp } from '@capacitor/core';
if (Capacitor.isNativePlatform()) {
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    let url=typeof input==='string'?input:input.url;
    const method=String(init.method||'GET').toUpperCase();
    if(!/^https?:\/\//i.test(url)||method!=='GET')return originalFetch(input,init);
    if(url.includes('www.fotmob.com/api/matches?')){url=url.replace('/api/matches?','/api/data/matches?');if(!url.includes('timezone='))url+='&timezone=Europe%2FRome';}
    if(url.startsWith('https://www.sofascore.com/api/v1/'))url=url.replace('https://www.sofascore.com/api/v1/','https://api.sofascore.com/api/v1/');
    const headers={Accept:'application/json','User-Agent':'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',Referer:'https://www.fotmob.com/'};
    let r=await CapacitorHttp.get({url,headers});
    if(Number(r.status||0)>=400&&url.includes('/api/data/matchDetails?'))r=await CapacitorHttp.get({url:url.replace('/api/data/matchDetails?','/api/matchDetails?'),headers});
    if(Number(r.status||0)>=400&&url.includes('/api/matchDetails?'))r=await CapacitorHttp.get({url:url.replace('/api/matchDetails?','/api/data/matchDetails?'),headers});
    const data=r.data;
    return new Response(typeof data==='string'?data:JSON.stringify(data??null),{status:Number(r.status||200),headers:new Headers(r.headers||{'content-type':'application/json'})});
  };
}
