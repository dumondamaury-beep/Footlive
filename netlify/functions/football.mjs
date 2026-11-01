
const LEAGUES = { l1: 61, ucl: 2, uel: 3 };
const NINJAS_LEAGUES = { l1: "ligue1", ucl: "ucl", uel: "uel" };
const SPORTAPI_LEAGUES = { l1: 9, ucl: 18, uel: 22 };

const SEASON = 2026;
const BASE = "https://v3.football.api-sports.io";
const SPORTAPI_BASE = "https://sportapi.ai/api";

const normalizeTeamName = (name) =>
  String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const TEAM_ALIASES = {
  parissaintgermain: "parissg",
  psg: "parissg",
  staderennais: "rennes",
  asmonaco: "monaco",
  lyon: "olympiquelyonnais"
};

const canonicalTeamName = (name) => {
  const normalized = normalizeTeamName(name);
  return TEAM_ALIASES[normalized] || normalized;
};

export default async (request) => {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const comp = url.searchParams.get("comp");

  if (!Object.hasOwn(LEAGUES, comp) && type !== "live") {
    return Response.json(
      { error: "invalid_competition" },
      { status: 400 }
    );
  }

  try {
    // LISTE DES ÉQUIPES SPORTAPI
    if (type === "teams") {
      const key = process.env.SPORTAPI_KEY;

      if (!key) {
        return Response.json(
          { error: "missing_sportapi_key" },
          { status: 503 }
        );
      }

      const response = await fetch(
        `${SPORTAPI_BASE}/leagues/${SPORTAPI_LEAGUES[comp]}`,
        { headers: { "X-Api-Key": key } }
      );

      const data = await response.json();

      return Response.json(data, { status: response.status });
    }

    // LOGOS : PROXY SÉCURISÉ SPORTAPI
    if (type === "logo") {
      const teamId = url.searchParams.get("team");
      const key = process.env.SPORTAPI_KEY;

      if (!key) {
        return new Response("Clé SportAPI manquante", { status: 503 });
      }

      if (!teamId || !/^\d+$/.test(teamId)) {
        return new Response("Identifiant équipe invalide", { status: 400 });
      }

      const response = await fetch(
        `${SPORTAPI_BASE}/teams/${teamId}/logo`,
        { headers: { "X-Api-Key": key } }
      );

      if (!response.ok) {
        return new Response("Logo indisponible", {
          status: response.status
        });
      }

      return new Response(await response.arrayBuffer(), {
        headers: {
          "Content-Type":
            response.headers.get("content-type") || "image/png",
          "Cache-Control": "public, max-age=604800, s-maxage=604800"
        }
      });
    }

    // CLASSEMENTS : API NINJAS + LOGOS SPORTAPI
    if (type === "standings") {
      const key = process.env.API_NINJAS_KEY;

      if (!key) {
        return Response.json(
          { error: "missing_api_ninjas_key" },
          { status: 503 }
        );
      }

      const response = await fetch(
        `https://api.api-ninjas.com/v1/soccerstandings?league=${NINJAS_LEAGUES[comp]}`,
        { headers: { "X-Api-Key": key } }
      );

      const data = await response.json();

      if (!response.ok) {
        return Response.json(
          { error: "api_ninjas_error", details: data },
          { status: response.status }
        );
      }

      const logoByName = {};
      const sportKey = process.env.SPORTAPI_KEY;

      if (sportKey) {
        try {
          const teamsResponse = await fetch(
            `${SPORTAPI_BASE}/leagues/${SPORTAPI_LEAGUES[comp]}`,
            { headers: { "X-Api-Key": sportKey } }
          );

          const teamsData = await teamsResponse.json();

          if (teamsResponse.ok && Array.isArray(teamsData.teams)) {
            for (const team of teamsData.teams) {
              if (team.name && team.id) {
                const logoUrl =
                  `/.netlify/functions/football?type=logo&team=${team.id}`;

                logoByName[canonicalTeamName(team.name)] = logoUrl;
              }
            }
          }
        } catch (error) {
          console.warn("Récupération des logos impossible:", error);
        }
      }

      const rows = Array.isArray(data) ? data : [];

      const standings = rows.map((x) => ({
        rank: x.league_rank,
        points: x.points,
        goalsDiff: x.goal_difference,
        team: {
          name: x.team?.name,
          code: x.team?.abbreviation,
          logo: logoByName[canonicalTeamName(x.team?.name)] || null
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
        _source: "API Ninjas + SportAPI"
      }, {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400"
        }
      });
    }

    // BUTEURS ET PASSES DÉCISIVES : SPORTAPI
    if (type === "scorers") {
      const key = process.env.SPORTAPI_KEY;

      if (!key) {
        return Response.json(
          { error: "missing_sportapi_key" },
          { status: 503 }
        );
      }

      const leagueId = SPORTAPI_LEAGUES[comp];
      const headers = { "X-Api-Key": key };

      const [scorersResponse, assistsResponse] = await Promise.all([
        fetch(
          `${SPORTAPI_BASE}/leagues/${leagueId}/topscorers?limit=20`,
          { headers }
        ),
        fetch(
          `${SPORTAPI_BASE}/leagues/${leagueId}/topassists?limit=100`,
          { headers }
        )
      ]);

      const scorersData = await scorersResponse.json();

      if (!scorersResponse.ok || !Array.isArray(scorersData.data)) {
        return Response.json({
          error: "sportapi_scorers_error",
          details: scorersData
        }, {
          status: scorersResponse.status || 502
        });
      }

      let assistsData = { data: [] };

      if (assistsResponse.ok) {
        assistsData = await assistsResponse.json();
      }

      const assistsByPlayer = new Map();

      for (const player of assistsData.data || []) {
        const playerKey = `${player.team_id}:${player.player_name}`;
        assistsByPlayer.set(playerKey, player.assists ?? 0);
      }

      const response = scorersData.data.map((player) => {
        const playerKey = `${player.team_id}:${player.player_name}`;

        return {
          player: {
            name: player.player_name,
            photo: ""
          },
          statistics: [{
            team: {
              name: player.team_name,
              logo: player.team_id
                ? `/.netlify/functions/football?type=logo&team=${player.team_id}`
                : null
            },
            goals: {
              total: player.goals ?? 0,
              assists: assistsByPlayer.get(playerKey) ?? 0
            }
          }]
        };
      });

      return Response.json({
        response,
        _source: "SportAPI"
      }, {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600"
        }
      });
    }

    // MATCHS : API-FOOTBALL
    const key = process.env.API_FOOTBALL_KEY;

    if (!key) {
      return Response.json(
        { error: "missing_api_key" },
        { status: 503 }
      );
    }

    let path;

    if (type === "live") {
      path = "/fixtures?live=61-2-3&timezone=Europe/Paris";
    } else {
      const league = LEAGUES[comp];

      if (type === "next") {
        path = `/fixtures?league=${league}&season=${SEASON}&next=10&timezone=Europe/Paris`;
      } else if (type === "results") {
        path = `/fixtures?league=${league}&season=${SEASON}&last=10&timezone=Europe/Paris`;
      } else {
        return Response.json(
          { error: "invalid_type" },
          { status: 400 }
        );
      }
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
      }, {
        status: upstream.status >= 400 ? upstream.status : 502
      });
    }

    return Response.json({
      ...body,
      _quota: quota
    }, {
      headers: {
        "Cache-Control": type === "live"
          ? "public, max-age=1800, s-maxage=1800"
          : "public, max-age=86400, s-maxage=86400"
      }
    });

  } catch (error) {
    console.error("Erreur football:", error);

    return Response.json({
      error: "upstream_unavailable",
      message: "Une API est momentanément indisponible."
    }, { status: 502 });
  }
};
