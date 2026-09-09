import { Capacitor, CapacitorHttp } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input.url;
    if (!/^https?:\/\//i.test(url)) return originalFetch(input, init);
    const method = String(init.method || 'GET').toUpperCase();
    if (method !== 'GET') return originalFetch(input, init);

    const requestedUrl = url;

    // FotMob current daily endpoint.
    if (url.includes('www.fotmob.com/api/matches?')) {
      url = url.replace('/api/matches?', '/api/data/matches?');
      if (!url.includes('timezone=')) url += '&timezone=Europe%2FRome';
    }

    // Match details are more reliable through the legacy route on Android;
    // retry the current /api/data route if the legacy route is unavailable.
    if (url.includes('www.fotmob.com/api/data/matchDetails?')) {
      url = url.replace('/api/data/matchDetails?', '/api/matchDetails?');
    }

    // Use the primary SofaScore API host from the native layer.
    if (url.startsWith('https://www.sofascore.com/api/v1/')) {
      url = url.replace('https://www.sofascore.com/api/v1/', 'https://api.sofascore.com/api/v1/');
    }

    const headers = {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',
      Referer: 'https://www.fotmob.com/'
    };

    let r = await CapacitorHttp.get({ url, headers });

    // If legacy FotMob matchDetails fails, retry the current data route.
    if (Number(r.status || 0) >= 400 && url.includes('www.fotmob.com/api/matchDetails?')) {
      const retryUrl = url.replace('/api/matchDetails?', '/api/data/matchDetails?');
      r = await CapacitorHttp.get({ url: retryUrl, headers });
    }

    // If a direct data-route request failed, retry the legacy route.
    if (Number(r.status || 0) >= 400 && requestedUrl.includes('www.fotmob.com/api/data/matchDetails?')) {
      const retryUrl = requestedUrl.replace('/api/data/matchDetails?', '/api/matchDetails?');
      r = await CapacitorHttp.get({ url: retryUrl, headers });
    }

    const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? null);
    return new Response(text, {
      status: Number(r.status || 200),
      headers: new Headers(r.headers || { 'content-type': 'application/json' })
    });
  };
}
