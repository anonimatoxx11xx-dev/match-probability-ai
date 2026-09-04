import base from './worker';
import { todayMatches } from './today';

interface Env { DB: D1Database; API_FOOTBALL_KEY: string; }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: {
    'content-type': 'application/json;charset=UTF-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,OPTIONS',
  },
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const u = new URL(request.url);
    if (request.method === 'OPTIONS') return json({ ok: true });
    if (request.method === 'GET' && u.pathname === '/api/today') {
      try {
        return json(await todayMatches(env, u.searchParams.get('date')));
      } catch (e) {
        return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502);
      }
    }
    return (base as any).fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    return (base as any).scheduled(controller, env, ctx);
  },
};
