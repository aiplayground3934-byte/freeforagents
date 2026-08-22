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
} from "./pages";
import { handleMcp, mcpManifest } from "./mcp";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

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

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const origin = url.origin;
    let path = url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

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
        const data = (await ep.run({ url, req })) as Record<string, unknown>;
        return jsonRes({ ok: true, docs: `${origin}/docs/${ep.name}.md`, ...data });
      } catch (err) {
        if (err instanceof ApiError) {
          return jsonRes({ ok: false, error: err.message, docs: `${origin}/docs/${ep.name}.md` }, err.status);
        }
        console.error(`error in ${ep.name}:`, err);
        return jsonRes({ ok: false, error: "internal server error", docs: `${origin}/docs/${ep.name}.md` }, 500);
      }
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
  },
};
