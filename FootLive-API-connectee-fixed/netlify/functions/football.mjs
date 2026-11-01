const LEAGUES = { l1: 61, ucl: 2, uel: 3 };
const SEASON = 2026; // saison 2026-2027
const BASE = "https://v3.football.api-sports.io";

export default async (request) => {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return Response.json({ error: "missing_api_key", message: "Ajoute API_FOOTBALL_KEY dans les variables d’environnement Netlify puis redéploie le site." }, { status: 503 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const comp = url.searchParams.get("comp");
  let path;
  if (type === "live") {
    path = "/fixtures?live=61-2-3&timezone=Europe/Paris";
  } else {
    if (!Object.hasOwn(LEAGUES, comp)) return Response.json({ error: "invalid_competition" }, { status: 400 });
    const league = LEAGUES[comp];
    if (type === "standings") path = `/standings?league=${league}&season=${SEASON}`;
    else if (type === "scorers") path = `/players/topscorers?league=${league}&season=${SEASON}`;
    else if (type === "next") path = `/fixtures?league=${league}&season=${SEASON}&next=10&timezone=Europe/Paris`;
    else if (type === "results") path = `/fixtures?league=${league}&season=${SEASON}&last=10&timezone=Europe/Paris`;
    else return Response.json({ error: "invalid_type" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": key } });
    const body = await upstream.json();
    const quota = { remaining: upstream.headers.get("x-ratelimit-requests-remaining"), limit: upstream.headers.get("x-ratelimit-requests-limit") };
    if (!upstream.ok || (body.errors && Object.keys(body.errors).length)) {
      return Response.json({ error: "api_provider_error", message: body.message || JSON.stringify(body.errors), details: body.errors, _quota: quota }, { status: upstream.status >= 400 ? upstream.status : 502 });
    }
    return Response.json({ ...body, _quota: quota }, {
      status: 200,
      headers: { "Cache-Control": type === "live" ? "public, max-age=1800, s-maxage=1800" : "public, max-age=86400, s-maxage=86400" }
    });
  } catch {
    return Response.json({ error: "upstream_unavailable", message: "API-Football est momentanément indisponible." }, { status: 502 });
  }
};
