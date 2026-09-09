import { Capacitor, CapacitorHttp } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch.bind(window);

  const nativeGet = async (url) => {
    const isSofa = /sofascore\.com/i.test(url);
    const isFot = /fotmob\.com/i.test(url);
    const isEspn = /espn\.com/i.test(url);
    const headers = {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
      ...(isSofa ? { Referer: 'https://www.sofascore.com/', Origin: 'https://www.sofascore.com' } : {}),
      ...(isFot ? { Referer: 'https://www.fotmob.com/', Origin: 'https://www.fotmob.com' } : {}),
      ...(isEspn ? { Referer: 'https://www.espn.com/', Origin: 'https://www.espn.com' } : {})
    };
    let last = { status: 0, data: null };
    for (let i = 0; i < 3; i++) {
      try {
        const r = await CapacitorHttp.get({ url, headers });
        last = r;
        if (Number(r.status || 0) >= 200 && Number(r.status || 0) < 300) return r;
        if (Number(r.status || 0) === 404 || Number(r.status || 0) === 401) break;
      } catch (e) {
        last = { status: 0, data: null, error: String(e) };
      }
    }
    return last;
  };

  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input.url;
    const method = String(init.method || 'GET').toUpperCase();
    if (!/^https?:\/\//i.test(url) || method !== 'GET') return originalFetch(input, init);

    if (url.includes('www.fotmob.com/api/matches?')) {
      url = url.replace('/api/matches?', '/api/data/matches?');
      if (!url.includes('timezone=')) url += '&timezone=Europe%2FRome';
    }
    if (url.startsWith('https://www.sofascore.com/api/v1/')) {
      url = url.replace('https://www.sofascore.com/api/v1/', 'https://api.sofascore.com/api/v1/');
    }
    if (url.startsWith('https://www.sofascore.com/api/v1')) {
      url = url.replace('https://www.sofascore.com/api/v1', 'https://api.sofascore.com/api/v1');
    }

    let r = await nativeGet(url);
    if (Number(r.status || 0) >= 400 && url.includes('/api/data/matchDetails?')) {
      r = await nativeGet(url.replace('/api/data/matchDetails?', '/api/matchDetails?'));
    }
    if (Number(r.status || 0) >= 400 && url.includes('/api/matchDetails?')) {
      r = await nativeGet(url.replace('/api/matchDetails?', '/api/data/matchDetails?'));
    }

    const data = r?.data;
    return new Response(typeof data === 'string' ? data : JSON.stringify(data ?? null), {
      status: Number(r?.status || 200),
      headers: new Headers(r?.headers || { 'content-type': 'application/json' })
    });
  };
}
