import { Capacitor, CapacitorHttp } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch.bind(window);

  const normalizeTeam = s => String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/fc|afc|sk|club|calcio|rotterdam/g, '')
    .replace(/[^a-z0-9]/g, '');

  const sameTeam = (a, b) => {
    const x = normalizeTeam(a), y = normalizeTeam(b);
    return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
  };

  const toNum = value => {
    if (value && typeof value === 'object') {
      if (value.value !== undefined) return toNum(value.value);
      if (value.displayValue !== undefined) return toNum(value.displayValue);
    }
    const m = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    const n = m ? Number(m[0]) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  const espnScoreboardCache = new Map();
  const espnSummaryCache = new Map();

  async function nativeJson(url, headers = {}) {
    try {
      const r = await CapacitorHttp.get({
        url,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',
          ...headers
        }
      });
      const status = Number(r.status || 0);
      if (status >= 400) return null;
      if (r.data && typeof r.data === 'object') return r.data;
      return JSON.parse(String(r.data ?? 'null'));
    } catch (_) {
      return null;
    }
  }

  async function espnScoreboard(dateKey) {
    if (!dateKey) return null;
    if (espnScoreboardCache.has(dateKey)) return espnScoreboardCache.get(dateKey);
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${dateKey}`;
    const data = await nativeJson(url);
    espnScoreboardCache.set(dateKey, data);
    return data;
  }

  function espnEventForMatch(scoreboard, homeName, awayName) {
    for (const event of (scoreboard?.events || [])) {
      const c = event?.competitions?.[0];
      const teams = c?.competitors || [];
      if (teams.length < 2) continue;
      const home = teams.find(x => x?.homeAway === 'home') || teams[0];
      const away = teams.find(x => x?.homeAway === 'away') || teams[1];
      const hn = home?.team?.displayName || home?.team?.name || '';
      const an = away?.team?.displayName || away?.team?.name || '';
      if (sameTeam(hn, homeName) && sameTeam(an, awayName)) return event;
    }
    return null;
  }

  async function espnSummary(eventId) {
    if (!eventId) return null;
    if (espnSummaryCache.has(eventId)) return espnSummaryCache.get(eventId);
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(eventId)}`;
    const data = await nativeJson(url);
    espnSummaryCache.set(eventId, data);
    return data;
  }

  function espnRows(summary) {
    const rows = [];
    for (const team of (summary?.boxscore?.teams || [])) {
      const side = team?.homeAway;
      if (side !== 'home' && side !== 'away') continue;
      const values = {};
      for (const s of (team?.statistics || [])) {
        const key = String(s?.name || s?.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const value = toNum(s?.displayValue ?? s?.value);
        if (value === null) continue;
        values[key] = value;
      }
      rows.push({ side, values });
    }
    if (rows.length < 2) return [];

    const home = rows.find(x => x.side === 'home')?.values || {};
    const away = rows.find(x => x.side === 'away')?.values || {};
    const pair = (keys, title) => {
      const h = keys.map(k => home[k]).find(v => v !== undefined);
      const a = keys.map(k => away[k]).find(v => v !== undefined);
      return h !== undefined && a !== undefined ? { title, stats: [h, a] } : null;
    };

    return [
      pair(['shotsontarget', 'shotson', 'shotsongoal'], 'Shots on target'),
      pair(['shots', 'totalshots', 'shotattempts'], 'Total shots'),
      pair(['corners', 'cornerkicks'], 'Corners'),
      pair(['fouls', 'totalfouls'], 'Fouls'),
      pair(['yellowcards', 'yellowcard', 'yellow'], 'Yellow cards'),
      pair(['offsides', 'offside'], 'Offsides'),
      pair(['bigchances', 'bigchance'], 'Big chances'),
      pair(['expectedgoals', 'expectedgoal', 'xg'], 'Expected goals (xG)')
    ].filter(Boolean);
  }

  async function augmentFotmobStats(payload) {
    try {
      const existing = payload?.content?.stats?.Periods?.All?.stats;
      const general = payload?.general || {};
      const homeName = general?.homeTeam?.name || payload?.header?.teams?.[0]?.name || '';
      const awayName = general?.awayTeam?.name || payload?.header?.teams?.[1]?.name || '';
      const iso = general?.matchTimeUTCDate || general?.matchTimeUTC || payload?.header?.status?.utcTime || '';
      const dateMatch = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
      if (!homeName || !awayName || !dateMatch) return payload;
      if (general?.finished === false || payload?.header?.status?.finished === false) return payload;

      const dateKey = `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`;
      const scoreboard = await espnScoreboard(dateKey);
      const event = espnEventForMatch(scoreboard, homeName, awayName);
      if (!event?.id) return payload;
      const rows = espnRows(await espnSummary(event.id));
      if (!rows.length) return payload;

      const current = Array.isArray(existing) ? [...existing] : [];
      const seen = new Set(current.flatMap(g => {
        if (Array.isArray(g?.stats)) return g.stats.map(s => String(s?.title || s?.key || '').toLowerCase());
        return [String(g?.title || g?.key || '').toLowerCase()];
      }));
      for (const row of rows) {
        const marker = String(row.title || '').toLowerCase();
        if (!seen.has(marker)) {
          current.push(row);
          seen.add(marker);
        }
      }

      return {
        ...payload,
        content: {
          ...(payload.content || {}),
          stats: {
            ...(payload.content?.stats || {}),
            Periods: {
              ...(payload.content?.stats?.Periods || {}),
              All: {
                ...(payload.content?.stats?.Periods?.All || {}),
                stats: current
              }
            }
          }
        },
        _multiSource: {
          ...(payload._multiSource || {}),
          stats: ['FotMob', 'ESPN']
        }
      };
    } catch (_) {
      return payload;
    }
  }

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

    let data = r.data;
    const isMatchDetails = url.includes('/api/data/matchDetails?') || url.includes('/api/matchDetails?');
    if (isMatchDetails && Number(r.status || 0) < 400) {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        data = await augmentFotmobStats(parsed);
      } catch (_) {}
    }

    const text = typeof data === 'string' ? data : JSON.stringify(data ?? null);
    return new Response(text, {
      status: Number(r.status || 200),
      headers: new Headers(r.headers || { 'content-type': 'application/json' })
    });
  };
}
