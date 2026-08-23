import { ENDPOINTS, ApiError, findEndpoint } from "./endpoints";
import {
  landingPage,
  endpointDocPage,
  endpointDocMd,
  notFoundPage,
  llmsTxt,
  openApiSpec,
  robotsTxt,
  faviconSvg,
  statsPage,
  type StatsRollup,
} from "./pages";
import { handleMcp, mcpManifest } from "./mcp";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const CF_ACCOUNT_ID = "da4b0c29ca4b88c444140be516510dbe";

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=60" : "no-store",
      ...CORS_HEADERS,
    },
  });
}

function htmlRes(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...CORS_HEADERS },
  });
}

function textRes(text: string, contentType: string, status = 200): Response {
  return new Response(text, { status, headers: { "content-type": `${contentType}; charset=utf-8`, ...CORS_HEADERS } });
}

function docsIndexMd(origin: string): string {
  return [
    "# FreeForAgents — API documentation",
    "",
    `Base URL: ${origin}`,
    "",
    "> Free, zero-auth JSON APIs. No API key, no signup. CORS is open on all endpoints.",
    "",
    "## Endpoints",
    "",
    ...ENDPOINTS.map((e) => `- [\`${e.path}\`](${origin}/docs/${e.name}.md) — ${e.summary}`),
    "",
  ].join("\n");
}

interface Env {
  STATS: AnalyticsEngineDataset;
  STATS_STORE?: KVNamespace;
  AE_TOKEN?: string;
}

const BOT_PATTERNS = /bot|crawl|spider|slurp|GPT|Claude|anthropic|Perplexity|Bytespider|CCBot|Applebot|cohere|meta-externalagent|Amazonbot/i;

function classifyAgent(ua: string): string {
  if (!ua) return "empty";
  return BOT_PATTERNS.test(ua) ? "bot" : "human";
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const origin = url.origin;
    let path = url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;

    // Canonical host: 301 www -> apex
    if (url.hostname === "www.freeforagents.dev") {
      const target = new URL(req.url);
      target.hostname = "freeforagents.dev";
      return Response.redirect(target.toString(), 301);
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const res = await handle(req, env, url, origin, path);
    ctx.waitUntil(Promise.resolve(trackSync(env, req, res)));
    return res;
  },

  async scheduled(_ctrl: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(updateRollup(env));
  },
};

// ---------- hourly stats rollup (cron) ----------

async function aeQuery(env: Env, sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.AE_TOKEN}`, "content-type": "text/plain" },
    body: sql,
  });
  if (!res.ok) throw new Error(`AE SQL ${res.status}`);
  const parsed = await res.json();
  return Array.isArray(parsed) ? parsed : [];
}

async function updateRollup(env: Env): Promise<void> {
  if (!env.AE_TOKEN || !env.STATS_STORE) return;
  try {
    const [totals, byEndpoint, byAgent] = await Promise.all([
      aeQuery(env, "SELECT COUNT() AS n FROM freeforagents_stats WHERE timestamp > NOW() - INTERVAL '2160' HOUR FORMAT JSON"),
      aeQuery(env,
        "SELECT index1 AS endpoint, COUNT() AS n FROM freeforagents_stats WHERE timestamp > NOW() - INTERVAL '24' HOUR GROUP BY endpoint ORDER BY n DESC LIMIT 25 FORMAT JSON"
      ),
      aeQuery(env,
        "SELECT blob1 AS kind, COUNT() AS n FROM freeforagents_stats WHERE timestamp > NOW() - INTERVAL '24' HOUR GROUP BY kind ORDER BY n DESC FORMAT JSON"
      ),
    ]);
    const bots: Record<string, number> = {};
    for (const row of byAgent as { kind?: string; n?: number }[]) {
      if (row.kind) bots[row.kind] = Number(row.n ?? 0);
    }
    const rollup: StatsRollup & { last24h: NonNullable<StatsRollup["last24h"]> } = {
      generated_at: new Date().toISOString(),
      total_90d: Number((totals[0] as { n?: number } | undefined)?.n ?? 0),
      last24h: {
        requests: (byEndpoint as { n?: number }[]).reduce((s, r) => s + Number(r.n ?? 0), 0),
        bots,
        endpoints: (byEndpoint as { endpoint?: string; n?: number }[])
          .filter((r) => r.endpoint)
          .map((r) => ({ endpoint: String(r.endpoint), requests: Number(r.n ?? 0) })),
      },
    };
    await env.STATS_STORE.put("rollup", JSON.stringify(rollup), { expirationTtl: 172800 });
  } catch (err) {
    console.error("stats rollup failed:", err);
  }
}

function trackSync(env: Env, req: Request, res: Response): void {
  const url = new URL(req.url);
  let path = url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  let label = path;
  const ep = findEndpoint(path);
  if (ep) label = ep.name;
  else if (path.startsWith("/docs/")) label = "/docs";
  else if (["/", "/llms.txt", "/openapi.json", "/robots.txt", "/mcp", "/mcp.txt"].includes(path)) label = path;
  else label = "404";
  try {
    env.STATS.writeDataPoint({
      indexes: [label.slice(0, 96)],
      blobs: [
        classifyAgent(req.headers.get("user-agent") ?? ""),
        String(res.status),
        (req.headers.get("referer") ?? "").slice(0, 200),
      ],
      doubles: [],
    });
  } catch {
    // analytics must never break a request
  }
}

async function handle(
  req: Request,
  env: Env,
  url: URL,
  origin: string,
  path: string
): Promise<Response> {

    // MCP endpoint accepts POST (JSON-RPC) — handle before the GET-only gate
    if (path === "/mcp") {
      return handleMcp(req);
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return jsonRes({ ok: false, error: "only GET requests are supported", docs: `${origin}/` }, 405);
    }

    // API endpoints
    const ep = findEndpoint(path);
    if (ep) {
      try {
        const out = await ep.run({ url, req });
        if (out instanceof Response) {
          const headers = new Headers(out.headers);
          for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
          return new Response(out.body, { status: out.status, headers });
        }
        return jsonRes({ ok: true, docs: `${origin}/docs/${ep.name}.md`, ...(out as Record<string, unknown>) });
      } catch (err) {
        if (err instanceof ApiError) {
          return jsonRes({ ok: false, error: err.message, docs: `${origin}/docs/${ep.name}.md` }, err.status);
        }
        console.error(`error in ${ep.name}:`, err);
        return jsonRes({ ok: false, error: "internal server error", docs: `${origin}/docs/${ep.name}.md` }, 500);
      }
    }

    // stats pages
    if (path === "/stats" || path === "/stats.json") {
      let rollup: StatsRollup | null = null;
      try {
        if (env.STATS_STORE) {
          const raw = await env.STATS_STORE.get("rollup");
          if (raw) rollup = JSON.parse(raw) as StatsRollup;
        }
      } catch {
        // stats must never break a request
      }
      if (path === "/stats.json") {
        return jsonRes(
          rollup ? { ok: true, ...rollup } : { ok: true, pending: true, message: "first hourly sync has not produced a rollup yet" }
        );
      }
      return htmlRes(statsPage(origin, rollup, Boolean(env.AE_TOKEN)));
    }

    // site pages
    switch (path) {
      case "/":
        return htmlRes(landingPage(origin));
      case "/llms.txt":
        return textRes(llmsTxt(origin), "text/plain");
      case "/openapi.json":
        return jsonRes(openApiSpec(origin));
      case "/robots.txt":
        return textRes(robotsTxt(), "text/plain");
      case "/mcp.txt":
        return textRes(mcpManifest(origin), "text/plain");
      case "/favicon.svg":
        return new Response(faviconSvg(), { headers: { "content-type": "image/svg+xml", ...CORS_HEADERS } });
    }

    // docs
    if (path.startsWith("/docs")) {
      const rest = path.slice("/docs".length);
      if (rest === "" || rest === "/") {
        return textRes(docsIndexMd(origin), "text/markdown");
      }
      if (rest.endsWith(".md")) {
        const target = ENDPOINTS.find((e) => e.name === rest.slice(1, -3));
        if (!target) {
          return textRes(docsIndexMd(origin), "text/markdown", 404);
        }
        return textRes(endpointDocMd(target, origin, ENDPOINTS), "text/markdown");
      }
      const nameOnly = rest.replace(/^\//, "").replace(/\/$/, "");
      const target = ENDPOINTS.find((e) => e.name === nameOnly);
      if (!target) {
        return htmlRes(notFoundPage(origin, url.pathname), 404);
      }
      return htmlRes(endpointDocPage(target, origin, ENDPOINTS));
    }

    // 404
    if (path.startsWith("/api") || path.includes(".")) {
      return jsonRes({ ok: false, error: `no such endpoint: ${url.pathname}`, docs: `${origin}/` }, 404);
    }
    return htmlRes(notFoundPage(origin, url.pathname), 404);
}
