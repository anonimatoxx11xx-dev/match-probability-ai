import { Capacitor, CapacitorHttp } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!/^https?:\/\//i.test(url)) return originalFetch(input, init);
    const method = String(init.method || 'GET').toUpperCase();
    if (method !== 'GET') return originalFetch(input, init);
    const headers = init.headers || { Accept: 'application/json' };
    const r = await CapacitorHttp.get({ url, headers });
    const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? null);
    return new Response(text, {
      status: Number(r.status || 200),
      headers: new Headers(r.headers || { 'content-type': 'application/json' })
    });
  };
}
