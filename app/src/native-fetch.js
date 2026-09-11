import { Capacitor, CapacitorHttp } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch.bind(window);

  const nativeGet = async (url) => {
    const u = String(url);
    const isSofa = /sofascore\.(com|app)/i.test(u);
    const isFot = /fotmob\.com/i.test(u);
    const isEspn = /espn\.com/i.test(u);
    const isSportsDb = /thesportsdb\.com/i.test(u);
    const headers = {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache'
    };
    if (isSofa) {
      headers.Referer = 'https://www.sofascore.com/';
      headers.Origin = 'https://www.sofascore.com';
      headers['X-Requested-With'] = 'XMLHttpRequest';
      headers['User-Agent'] = 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36';
    } else if (isFot) {
      headers.Referer = 'https://www.fotmob.com/';
      headers.Origin = 'https://www.fotmob.com';
      headers['User-Agent'] = 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36';
    } else if (isSportsDb) {
      headers.Referer = 'https://www.thesportsdb.com/';
      headers['User-Agent'] = 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36';
    }

    let last = { status: 0, data: null };
    const candidates = [u];
    if (isSofa && u.startsWith('https://api.sofascore.com/api/v1/')) {
      candidates.push(u.replace('https://api.sofascore.com/api/v1/', 'https://api.sofascore.app/api/v1/'));
    }
    for (const candidate of candidates) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await CapacitorHttp.get({ url: candidate, headers });
          last = r;
          const code = Number(r?.status || 0);
          if (code >= 200 && code < 300) return r;
          if (code === 429) break;
        } catch (e) {
          last = { status: 0, data: null, error: String(e) };
        }
      }
    }
    return last;
  };

  const parseResponse = (r) => {
    const data = r?.data;
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch { return null; }
    }
    return data ?? null;
  };

  const responseFromData = (data, status = 200) => new Response(
    JSON.stringify(data ?? null),
    { status, headers: { 'content-type': 'application/json' } }
  );

  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input?.url;
    const method = String(init.method || 'GET').toUpperCase();
    if (!url || !/^https?:\/\//i.test(url) || method !== 'GET') return originalFetch(input, init);

    // ESPN's site.web.api host is unreliable from Android/Capacitor.
    // Use the same stable site.api host already used by the provider engine.
    if (/^https:\/\/site\.web\.api\.espn\.com\//i.test(url)) {
      url = url.replace(/^https:\/\/site\.web\.api\.espn\.com\//i, 'https://site.api.espn.com/');
    }

    if (url.includes('www.fotmob.com/api/matches?')) {
      url = url.replace('/api/matches?', '/api/data/matches?');
      if (!url.includes('timezone=')) url += '&timezone=Europe%2FRome';
    }
    if (url.startsWith('https://www.sofascore.com/api/v1/')) {
      url = url.replace('https://www.sofascore.com/api/v1/', 'https://api.sofascore.com/api/v1/');
    }

    // ESPN's generic soccer/all scoreboard is inconsistent on mobile/native clients.
    // Build one merged scoreboard from stable league-specific scoreboards instead.
    if (/site\.api\.espn\.com\/apis\/site\/v2\/sports\/soccer\/all\/scoreboard/i.test(url)) {
      const match = url.match(/[?&]dates=(\d{8})/);
      const date = match?.[1] || '';
      const leagues = ['uefa.champions','eng.1','ita.1','esp.1','ger.1','fra.1','usa.1','bra.1','mex.1','por.1','ned.1','bel.1','sco.1','tur.1','gre.1'];
      const responses = await Promise.all(leagues.map(league => nativeGet(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date}`)));
      const events = [];
      const seen = new Set();
      for (const r of responses) {
        const j = parseResponse(r);
        for (const e of (j?.events || [])) {
          const id = String(e?.id || '');
          if (id && !seen.has(id)) { seen.add(id); events.push(e); }
        }
      }
      if (events.length) {
        return responseFromData({ leagues: [{ name: 'Football' }], events }, 200);
      }
      // If league fan-out is empty, still try ESPN's generic endpoint.
    }

    const r = await nativeGet(url);
    const data = r?.data;
    return new Response(
      typeof data === 'string' ? data : JSON.stringify(data ?? null),
      {
        status: Number(r?.status || 502),
        headers: new Headers(r?.headers || { 'content-type': 'application/json' })
      }
    );
  };
}
