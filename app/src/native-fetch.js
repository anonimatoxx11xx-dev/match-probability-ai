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

    // Keep the current /api/data/matchDetails route as the primary path.
    // If Android receives an error, retry the legacy route as a fallback.
    const isFotmobDataDetails = url.includes('www.fotmob.com/api/data/matchDetails?');

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

    // FotMob has both current data and older public routes in the wild.
    // Try the alternate route only after the primary request fails.
    if (Number(r.status || 0) >= 400 && isFotmobDataDetails) {
      const retryUrl = url.replace('/api/data/matchDetails?', '/api/matchDetails?');
      r = await CapacitorHttp.get({ url: retryUrl, headers });
    }

    // If the caller ever requests the legacy route directly, retry current data route.
    if (Number(r.status || 0) >= 400 && requestedUrl.includes('www.fotmob.com/api/matchDetails?')) {
      const retryUrl = requestedUrl.replace('/api/matchDetails?', '/api/data/matchDetails?');
      r = await CapacitorHttp.get({ url: retryUrl, headers });
    }

    const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? null);
    return new Response(text, {
      status: Number(r.status || 200),
      headers: new Headers(r.headers || { 'content-type': 'application/json' })
    });
  };
}
