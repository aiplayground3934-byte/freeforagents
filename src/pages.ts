import { ENDPOINTS, type EndpointDef } from "./endpoints";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------- markdown docs ----------

export function endpointDocMd(ep: EndpointDef, origin: string, all: EndpointDef[]): string {
  const lines: string[] = [];
  lines.push(`# GET ${ep.path}`);
  lines.push("");
  lines.push(ep.summary);
  lines.push("");
  lines.push(
    `Free, zero-auth JSON API served by **FreeForAgents**. No API key, no signup. All responses include \`ok\`, the payload fields shown below, and a \`docs\` URL. CORS is fully open (\`Access-Control-Allow-Origin: *\`).`
  );
  lines.push("");
  lines.push("## Parameters");
  lines.push("");
  if (ep.params.length === 0) {
    lines.push("This endpoint takes no query parameters.");
  } else {
    lines.push("| Name | Type | Required | Description |");
    lines.push("|------|------|----------|-------------|");
    for (const p of ep.params) {
      lines.push(`| \`${p.name}\` | ${p.type} | ${p.required ? "yes" : "no"} | ${p.description} |`);
    }
  }
  lines.push("");
  lines.push("## Example request");
  lines.push("");
  lines.push("```bash");
  lines.push(`curl -s "${origin}${ep.example}"`);
  lines.push("```");
  lines.push("");
  lines.push("## Example response");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify({ ok: true, docs: `${origin}/docs/${ep.name}.md`, ...ep.exampleResponse }, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## See also");
  lines.push("");
  for (const other of all.filter((o) => o.name !== ep.name)) {
    lines.push(`- [\`${other.path}\`](${origin}/docs/${other.name}.md) — ${other.summary}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ---------- llms.txt ----------

export function llmsTxt(origin: string): string {
  const lines: string[] = [];
  lines.push("# FreeForAgents");
  lines.push("");
  lines.push(
    "> Free utility APIs built for humans and AI agents. Every endpoint is zero-auth (no API key, no signup), returns JSON, supports CORS, and has a markdown doc page. Ideal when an agent or script needs a quick UUID, hash, unit conversion, FX rate, random data, holiday calendar, IP lookup, or a tiny JSON proxy."
  );
  lines.push("");
  lines.push(`Base URL: ${origin}`);
  lines.push("");
  lines.push("Machine-readable OpenAPI spec: " + `${origin}/openapi.json`);
  lines.push("");
  lines.push(
    `MCP server (Model Context Protocol, Streamable HTTP): ${origin}/mcp — exposes all endpoints as tools for AI agents. Manifest at ${origin}/mcp.txt.`
  );
  lines.push("");
  lines.push("## Endpoints");
  lines.push("");
  for (const ep of ENDPOINTS) {
    lines.push(`- [\`${ep.path}\`](${origin}/docs/${ep.name}.md): ${ep.summary}`);
  }
  lines.push("");
  lines.push("## Conventions");
  lines.push("");
  lines.push("- Successful responses: `{ \"ok\": true, ...payload, \"docs\": \"<doc url>\" }`.");
  lines.push("- Errors: HTTP 4xx/5xx with `{ \"ok\": false, \"error\": \"message\", \"docs\": \"<doc url>\" }`.");
  lines.push("- Rate limits: none beyond Cloudflare's standard free-tier protections. Please cache results where reasonable.");
  lines.push("");
  return lines.join("\n");
}

// ---------- openapi ----------

export function openApiSpec(origin: string): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const ep of ENDPOINTS) {
    const params = ep.params.map((p) => ({
      name: p.name,
      in: "query",
      required: p.required,
      description: p.description,
      schema: { type: p.type === "integer" ? "integer" : p.type },
    }));
    paths[ep.path] = {
      get: {
        summary: ep.summary,
        description: ep.description,
        parameters: params,
        tags: [ep.name],
        responses: {
          "200": {
            description: "Successful response",
            content: { "application/json": { example: { ok: true, ...ep.exampleResponse } } },
          },
          "400": { description: "Invalid parameters" },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "FreeForAgents",
      version: "1.0.0",
      description:
        "Free, zero-auth utility APIs for humans and AI agents. No API keys, no signup. Docs in markdown at /docs/<endpoint>.md.",
    },
    servers: [{ url: origin }],
    paths,
  };
}

// ---------- robots ----------

export function robotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "# AI crawlers explicitly welcome",
    "User-agent: GPTBot",
    "Allow: /",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    "User-agent: ChatGPT-User",
    "Allow: /",
    "User-agent: ClaudeBot",
    "Allow: /",
    "User-agent: anthropic-ai",
    "Allow: /",
    "User-agent: PerplexityBot",
    "Allow: /",
    "User-agent: Google-Extended",
    "Allow: /",
    "User-agent: Applebot-Extended",
    "Allow: /",
    "User-agent: CCBot",
    "Allow: /",
    "User-agent: Bytespider",
    "Allow: /",
    "User-agent: cohere-ai",
    "Allow: /",
    "",
  ].join("\n");
}

// ---------- minimal markdown -> HTML ----------

function inline(s: string): string {
  let out = esc(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3);
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      html.push(`<pre><code class="language-${esc(lang)}">${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    if (/^\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length > 0) {
        const [head, ...body] = rows;
        html.push("<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>");
        for (const row of body) {
          html.push("<tr>" + row.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
        }
        html.push("</tbody></table>");
      }
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length + 1;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (line.startsWith("> ")) {
      html.push(`<blockquote><p>${inline(line.slice(2))}</p></blockquote>`);
      i++;
      continue;
    }
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      html.push("<ul>" + items.map((it) => `<li>${inline(it)}</li>`).join("") + "</ul>");
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    html.push(`<p>${inline(line)}</p>`);
    i++;
  }
  return html.join("\n");
}

// ---------- shared chrome ----------

const STYLE = `
  :root { --bg:#0b0e14; --fg:#d7dce5; --muted:#8b93a3; --accent:#4ade80; --card:#12161f; --border:#232a36; --code:#1a2030; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--fg); line-height:1.6; padding:2rem 1rem; max-width:56rem; margin:0 auto; }
  a { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }
  h1,h2,h3 { color:#fff; margin:1.5rem 0 .75rem; line-height:1.25; }
  h1 { font-size:1.9rem; } h2 { font-size:1.35rem; border-bottom:1px solid var(--border); padding-bottom:.35rem; }
  p { margin:.6rem 0; }
  code { background:var(--code); border:1px solid var(--border); border-radius:4px; padding:.1rem .35rem; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.88em; color:#a5d6ff; }
  pre { background:var(--code); border:1px solid var(--border); border-radius:8px; padding:1rem; overflow-x:auto; margin:.8rem 0; }
  pre code { background:none; border:none; padding:0; }
  table { border-collapse:collapse; width:100%; margin:.8rem 0; font-size:.92em; }
  th,td { border:1px solid var(--border); padding:.45rem .6rem; text-align:left; vertical-align:top; }
  th { background:var(--card); color:#fff; }
  blockquote { border-left:3px solid var(--accent); padding-left:1rem; color:var(--muted); margin:.8rem 0; }
  ul { padding-left:1.4rem; margin:.6rem 0; }
  .badge { display:inline-block; background:rgba(74,222,128,.12); color:var(--accent); border:1px solid rgba(74,222,128,.3); border-radius:999px; font-size:.78rem; padding:.15rem .7rem; margin-right:.4rem; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:1.1rem 1.3rem; margin:1rem 0; }
  .muted { color:var(--muted); }
  footer { margin-top:3rem; border-top:1px solid var(--border); padding-top:1rem; color:var(--muted); font-size:.85rem; }
`;

function page(title: string, bodyHtml: string, origin: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Free, zero-auth utility APIs for humans and AI agents. No keys, no signup.">
<link rel="icon" href="${origin}/favicon.svg" type="image/svg+xml">
<style>${STYLE}</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebAPI","name":"FreeForAgents","url":"${origin}","description":"Free zero-auth utility APIs: UUID, hashing, unit conversion, FX rates, holidays, random data, IP geolocation and more.","isAccessibleForFree":true}
</script>
</head>
<body>
${bodyHtml}
<footer>FreeForAgents · free forever · <a href="${origin}/llms.txt">llms.txt</a> · <a href="${origin}/openapi.json">OpenAPI</a> · powered by Cloudflare Workers</footer>
</body>
</html>`;
}

// ---------- landing page ----------

export function landingPage(origin: string): string {
  const cards = ENDPOINTS.map((ep) => {
    const params = ep.params
      .map((p) => `<span class="badge">${esc(p.name)}${p.required ? "" : " <span class='muted'>(opt)</span>"}</span>`)
      .join(" ");
    return `<div class="card">
<h3 style="margin-top:0"><a href="${origin}/docs/${ep.name}">${esc(ep.path)}</a></h3>
<p>${esc(ep.summary)}</p>
<p class="muted" style="font-size:.85rem">${params || "<span class=muted>no parameters</span>"}</p>
<pre><code>curl -s "${origin}${esc(ep.example)}"</code></pre>
<p style="font-size:.85rem"><a href="${origin}/docs/${ep.name}">docs</a> · <a href="${origin}/docs/${ep.name}.md">markdown</a> · <a href="${origin}${esc(ep.example)}" target="_blank" rel="noopener">try it →</a></p>
</div>`;
  }).join("\n");

  const body = `
<h1><span style="color:var(--accent)">⚡</span> FreeForAgents</h1>
<p>Utility APIs that are actually free: <strong>no API key, no signup, no rate-limit drama</strong>. Built for developers, scripts, and AI agents. Every response is JSON, CORS is wide open, and every endpoint ships a markdown doc so LLMs can read it natively.</p>
<p>
<span class="badge">$0 / month hosting</span>
<span class="badge">20 endpoints</span>
<span class="badge">CORS: *</span>
<span class="badge"><a href="${origin}/llms.txt" style="color:inherit;text-decoration:none">llms.txt</a></span>
<span class="badge"><a href="${origin}/openapi.json" style="color:inherit;text-decoration:none">OpenAPI 3.1</a></span>
<span class="badge"><a href="${origin}/mcp.txt" style="color:inherit;text-decoration:none">MCP server</a></span>
</p>
<h2>Endpoints</h2>
${cards}
`;
  return page("FreeForAgents — free zero-auth APIs for humans & AI agents", body, origin);
}

// ---------- endpoint doc page ----------

export function endpointDocPage(ep: EndpointDef, origin: string, all: EndpointDef[]): string {
  const md = endpointDocMd(ep, origin, all);
  const nav = `<p style="margin-bottom:1rem"><a href="/">← all endpoints</a> · <a href="${origin}/docs/${ep.name}.md">raw markdown</a></p>`;
  return page(`GET ${ep.path} — FreeForAgents docs`, nav + renderMarkdown(md), origin);
}

// ---------- misc pages ----------

export function notFoundPage(origin: string, pathRequested: string): string {
  const body = `
<h1>404</h1>
<p><code>${esc(pathRequested)}</code> does not exist on FreeForAgents.</p>
<p><a href="/">Browse all endpoints →</a></p>
`;
  return page("404 — FreeForAgents", body, origin);
}

export function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">⚡</text></svg>`;
}
