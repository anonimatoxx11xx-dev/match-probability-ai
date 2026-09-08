import base from './index';
import { todayMatches } from './today';
import { runBacktest } from './backtest';

interface Env { DB: D1Database; API_FOOTBALL_KEY?: string; }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: {
    'content-type': 'application/json;charset=UTF-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  },
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const u = new URL(request.url);
    if (request.method === 'OPTIONS') return json({ ok: true });
    if (request.method === 'GET' && u.pathname === '/api/today') {
      try { return json(await todayMatches(env, u.searchParams.get('date'))); }
      catch (e) { return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502); }
    }
    if (request.method === 'GET' && u.pathname === '/api/backtest') {
      try {
        const minHistory = Math.max(1, Math.min(20, Number(u.searchParams.get('minHistory') || 3)));
        const league = u.searchParams.get('league');
        const result = await runBacktest(env, minHistory);
        if (league && result.leagues[league]) return json({ ...result, evaluated: result.leagues[league].evaluated, accuracy: result.leagues[league].accuracy, brier: result.leagues[league].brier, logLoss: result.leagues[league].logLoss, leagues: { [league]: result.leagues[league] } });
        return json(result);
      } catch (e) { return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500); }
    }
    return (base as any).fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    return (base as any).scheduled(controller, env, ctx);
  },
};
