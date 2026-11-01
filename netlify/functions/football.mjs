const LEAGUES = { l1: 61, ucl: 2, uel: 3 };
const NINJAS_LEAGUES = { l1: "ligue1", ucl: "ucl", uel: "uel" };
const SEASON = 2026;
const BASE = "https://v3.football.api-sports.io";

export default async (request) => {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const comp = url.searchParams.get("comp");

  if (!Object.hasOwn(LEAGUES, comp) && type !== "live") {
    return Response.json({ error: "invalid_competition" }, { status: 400 });
  }

  try {
    if (type === "standings") {
      const key = process.env.API_NINJAS_KEY;
      if (!key) return Response.json({ error: "missing_api_ninjas_key" }, { status: 503 });

      const response = await fetch(
        `https://api.api-ninjas.com/v1/soccerstandings?league=${NINJAS_LEAGUES[comp]}`,
        { headers: { "X-Api-Key": key } }
      );
      const data = await response.json();

      if (!response.ok) {
        return Response.json({ error: "api_ninjas_error", details: data }, { status: response.status });
      }

      const rows = Array.isArray(data) ? data : [];
      const standings = rows.map((x) => ({
        rank: x.league_rank,
        points: x.points,
        goalsDiff: x.goal_difference,
        team: {
          name: x.team?.name,
          code: x.team?.abbreviation,
          logo: null
        },
        all: {
          played: x.games_played,
          win: x.wins,
          draw: x.draws,
          lose: x.losses
        }
      }));

      return Response.json({
        response: [{
          league: {
            standings: [standings]
          }
        }],
        _source: "API Ninjas"
      }, {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" }
      });
    }

    const key = process.env.API_FOOTBALL_KEY;
    if (!key) return Response.json({ error: "missing_api_key" }, { status: 503 });

    let path;
    if (type === "live") {
      path = "/fixtures?live=61-2-3&timezone=Europe/Paris";
    } else {
      const league = LEAGUES[comp];
      if (type === "scorers") path = `/players/topscorers?league=${league}&season=${SEASON}`;
      else if (type === "next") path = `/fixtures?league=${league}&season=${SEASON}&next=10&timezone=Europe/Paris`;
      else if (type === "results") path = `/fixtures?league=${league}&season=${SEASON}&last=10&timezone=Europe/Paris`;
      else return Response.json({ error: "invalid_type" }, { status: 400 });
    }

    const upstream = await fetch(`${BASE}${path}`, {
      headers: { "x-apisports-key": key }
    });
    const body = await upstream.json();
    const quota = {
      remaining: upstream.headers.get("x-ratelimit-requests-remaining"),
      limit: upstream.headers.get("x-ratelimit-requests-limit")
    };

    if (!upstream.ok || (body.errors && Object.keys(body.errors).length)) {
      return Response.json({
        error: "api_provider_error",
        message: body.message || JSON.stringify(body.errors),
        details: body.errors,
        _quota: quota
      }, { status: upstream.status >= 400 ? upstream.status : 502 });
    }

    return Response.json({ ...body, _quota: quota }, {
      headers: {
        "Cache-Control": type === "live"
          ? "public, max-age=1800, s-maxage=1800"
          : "public, max-age=86400, s-maxage=86400"
      }
    });
  } catch {
    return Response.json({
      error: "upstream_unavailable",
      message: "Une API est momentanément indisponible."
    }, { status: 502 });
  }
};
