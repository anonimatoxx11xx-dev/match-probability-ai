import { Capacitor, CapacitorHttp } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input.url;
    if (!/^https?:\/\//i.test(url)) return originalFetch(input, init);
    const method = String(init.method || 'GET').toUpperCase();
    if (method !== 'GET') return originalFetch(input, init);

    // FotMob current data endpoints used by the APK.
    if (url.includes('www.fotmob.com/api/matches?')) {
      url = url.replace('/api/matches?', '/api/data/matches?');
      if (!url.includes('timezone=')) url += '&timezone=Europe%2FRome';
    }
    if (url.includes('www.fotmob.com/api/matchDetails?')) {
      url = url.replace('/api/matchDetails?', '/api/data/matchDetails?');
    }

    // Use the primary SofaScore API host from the native layer.
    if (url.startsWith('https://www.sofascore.com/api/v1/')) {
      url = url.replace('https://www.sofascore.com/api/v1/', 'https://api.sofascore.com/api/v1/');
    }

    const headers = init.headers || { Accept: 'application/json' };
    const r = await CapacitorHttp.get({ url, headers });
    const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? null);
    return new Response(text, {
      status: Number(r.status || 200),
      headers: new Headers(r.headers || { 'content-type': 'application/json' })
    });
  };
}
