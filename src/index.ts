interface Env {
  DB: D1Database;
  API_FOOTBALL_KEY: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });

function poisson(lambda: number, k: number) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function distribution(lambda: number, max = 8) {
  const p: number[] = [];
  for (let k = 0; k <= max; k++) p.push(poisson(lambda, k));
  const s = p.reduce((a, b) => a + b, 0);
  return p.map((x) => x / s);
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

type Stats = {
  goalsFor: number;
  goalsAgainst: number;
  shots: number;
  sot: number;
  corners: number;
  fouls: number;
  saves: number;
  cards: number;
};

function predict(h: Stats, a: Stats) {
  const hg = clamp((h.goalsFor * 0.62 + a.goalsAgainst * 0.38) * 1.10, 0.15, 4.5);
  const ag = clamp((a.goalsFor * 0.62 + h.goalsAgainst * 0.38) * 0.92, 0.10, 4);
  const hd = distribution(hg), ad = distribution(ag);
  let home = 0, draw = 0, away = 0, over15 = 0, over25 = 0, under35 = 0;

  for (let i = 0; i < hd.length; i++) {
    for (let j = 0; j < ad.length; j++) {
      const p = hd[i] * ad[j], t = i + j;
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
      if (t >= 2) over15 += p;
      if (t >= 3) over25 += p;
      if (t <= 3) under35 += p;
    }
  }

  return {
    expectedGoals: { home: hg, away: ag, total: hg + ag },
    result: { home, draw, away },
    markets: { over15, over25, under35 },
    expectedStats: {
      shots: h.shots + a.shots,
      sot: h.sot + a.sot,
      corners: h.corners + a.corners,
      fouls: h.fouls + a.fouls,
      saves: h.saves + a.saves,
      cards: h.cards + a.cards,
    },
    model: "Poisson + historical team averages + home advantage",
  };
}

async function stats(env: Env, id: number): Promise<Stats | null> {
  const r = await env.DB.prepare(
    "SELECT goals_for,goals_against,shots_for,shots_on_target_for,corners_for,fouls_for,saves_for,cards_for FROM team_stats WHERE team_id=?"
  ).bind(id).first<any>();

  if (!r) return null;
  return {
    goalsFor: r.goals_for,
    goalsAgainst: r.goals_against,
    shots: r.shots_for,
    sot: r.shots_on_target_for,
    corners: r.corners_for,
    fouls: r.fouls_for,
    saves: r.saves_for,
    cards: r.cards_for,
  };
}

async function footballApi(env: Env, path: string) {
  if (!env.API_FOOTBALL_KEY) throw new Error("API_FOOTBALL_KEY non configurata");

  const response = await fetch(`https://v3.football.api-sports.io${path}`, {
    method: "GET",
    headers: {
      "x-apisports-key": env.API_FOOTBALL_KEY,
      accept: "application/json",
    },
  });

  const data = await response.json<any>();

  if (!response.ok) {
    throw new Error(`API-Football HTTP ${response.status}`);
  }

  if (data?.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

function samplePoisson(lambda: number) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L && k < 20);
  return k - 1;
}

async function simulate(env: Env, homeId: number, awayId: number, runs: number) {
  const h = await stats(env, homeId), a = await stats(env, awayId);
  if (!h || !a) throw new Error("Statistiche squadra non disponibili");

  const base = predict(h, a);
  let hw = 0, d = 0, aw = 0, o25 = 0;

  for (let n = 0; n < runs; n++) {
    const x = samplePoisson(base.expectedGoals.home);
    const y = samplePoisson(base.expectedGoals.away);
    if (x > y) hw++;
    else if (x === y) d++;
    else aw++;
    if (x + y >= 3) o25++;
  }

  return {
    runs,
    homeWin: hw / runs,
    draw: d / runs,
    awayWin: aw / runs,
    over25: o25 / runs,
    expectedGoals: base.expectedGoals,
  };
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === "OPTIONS") return json({ ok: true });

    const u = new URL(request.url);

    try {
      if (u.pathname === "/api/health") {
        return json({
          ok: true,
          service: "match-probability-ai",
          version: "1.1.0",
        });
      }

      if (u.pathname === "/api/provider/test") {
        const season = Number(u.searchParams.get("season")) || 2026;
        const data = await footballApi(
          env,
          `/leagues?search=Serie%20A&season=${season}`
        );

        const leagues = Array.isArray(data?.response)
          ? data.response.map((item: any) => ({
              leagueId: item?.league?.id ?? null,
              name: item?.league?.name ?? null,
              country: item?.country?.name ?? null,
              season: item?.seasons?.find((s: any) => s.year === season)?.year ?? season,
            }))
          : [];

        return json({
          ok: true,
          provider: "API-Football",
          season,
          results: leagues,
        });
      }

      if (u.pathname === "/api/leagues") {
        const r = await env.DB.prepare(
          "SELECT id,name,country FROM leagues ORDER BY name"
        ).all();
        return json(r.results);
      }

      if (u.pathname === "/api/teams") {
        const league = u.searchParams.get("league");
        const r = league
          ? await env.DB.prepare(
              "SELECT t.id,t.name,l.name league FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.name=? ORDER BY t.name"
            ).bind(league).all()
          : await env.DB.prepare("SELECT id,name FROM teams ORDER BY name").all();
        return json(r.results);
      }

      if (u.pathname === "/api/predict" && request.method === "POST") {
        const b = await request.json() as any;
        const h = await stats(env, Number(b.homeTeamId));
        const a = await stats(env, Number(b.awayTeamId));
        if (!h || !a) return json({ error: "Statistiche squadra non disponibili" }, 404);
        return json(predict(h, a));
      }

      if (u.pathname === "/api/simulate" && request.method === "POST") {
        const b = await request.json() as any;
        const runs = clamp(Number(b.runs) || 10000, 1000, 100000);
        return json(await simulate(env, Number(b.homeTeamId), Number(b.awayTeamId), runs));
      }

      return json({ error: "Endpoint non trovato" }, 404);
    } catch (e: any) {
      return json({ error: e?.message || "Errore interno" }, 500);
    }
  },
};
