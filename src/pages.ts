import { ENDPOINTS, type EndpointDef } from "./endpoints";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------- endpoint presentation metadata ----------

const EP_ICON: Record<string, string> = {
  uuid: "🆔", ulid: "🔖", password: "🔑", random: "🎰", dice: "🎲",
  hash: "🔐", base64: "🔄", headers: "📡", json: "📦",
  convert: "📐", time: "🕐", timestamp: "⏱️",
  ip: "📍", holidays: "🗓️", fx: "💱", dns: "🌐",
  qr: "🔳", avatar: "🧑",
  lorem: "📝", emoji: "😀", joke: "😄", fact: "💡", quote: "❝",
};

const CATEGORY_ORDER = ["ids", "encode", "convert", "world", "media", "content"] as const;

const CATEGORIES: Record<string, { label: string; blurb: string; members: string[] }> = {
  ids:     { label: "Identity & Randomness", blurb: "UUIDs, ULIDs, passwords, secure randomness", members: ["uuid", "ulid", "password", "random", "dice"] },
  encode:  { label: "Encode & Inspect", blurb: "Hashing, Base64, request introspection, JSON proxy", members: ["hash", "base64", "headers", "json"] },
  convert: { label: "Convert & Time", blurb: "Units, temperature, timezones, timestamps", members: ["convert", "time", "timestamp"] },
  world:   { label: "World Data", blurb: "IP geolocation, FX rates, DNS records, public holidays", members: ["ip", "fx", "dns", "holidays"] },
  media:   { label: "Images & QR", blurb: "QR codes and generated avatars as SVG", members: ["qr", "avatar"] },
  content: { label: "Content", blurb: "Placeholder text, emoji, jokes, facts, quotes", members: ["lorem", "emoji", "joke", "fact", "quote"] },
};

function categoryOf(name: string): string {
  for (const key of CATEGORY_ORDER) {
    if (CATEGORIES[key].members.includes(name)) return key;
  }
  return "ids";
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

// ---------- design system ----------

const STYLE = `
:root{
  --bg:#05070d; --bg2:#090d17; --fg:#dbe2f0; --muted:#8a94ab; --dim:#5b6579;
  --accent:#22d3ee; --accent2:#818cf8; --accent3:#34d399;
  --card:rgba(255,255,255,.03); --card2:rgba(255,255,255,.05);
  --border:rgba(148,163,199,.14); --border-hi:rgba(103,232,249,.45);
  --code:#0d1322; --radius:14px;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;
  background:var(--bg);color:var(--fg);line-height:1.65;-webkit-font-smoothing:antialiased;
}
::selection{background:rgba(34,211,238,.28)}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:none;filter:brightness(1.2)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
code,kbd,pre{font-family:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace}
.wrap{max-width:72rem;margin:0 auto;padding:0 1.25rem}

/* ---- background fx ---- */
.bg-fx{position:fixed;inset:0;z-index:-1;overflow:hidden;background:
  radial-gradient(60rem 32rem at 85% -10%,rgba(129,140,248,.16),transparent 60%),
  radial-gradient(50rem 30rem at 0% 0%,rgba(34,211,238,.13),transparent 60%),
  radial-gradient(46rem 26rem at 55% 115%,rgba(52,211,153,.10),transparent 60%),var(--bg)}
.bg-grid{position:fixed;inset:0;z-index:-1;background-image:
  linear-gradient(rgba(148,163,199,.05) 1px,transparent 1px),
  linear-gradient(90deg,rgba(148,163,199,.05) 1px,transparent 1px);
  background-size:44px 44px;mask-image:radial-gradient(ellipse 90% 60% at 50% 0%,black 30%,transparent 75%)}

/* ---- nav ---- */
.nav{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);background:rgba(5,7,13,.72);border-bottom:1px solid var(--border)}
.nav-inner{display:flex;align-items:center;gap:1.4rem;height:60px;max-width:72rem;margin:0 auto;padding:0 1.25rem}
.logo{display:flex;align-items:center;gap:.55rem;font-weight:800;font-size:1.06rem;color:#fff;letter-spacing:-.02em}
.logo-bolt{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;font-size:.95rem;
  background:linear-gradient(135deg,rgba(34,211,238,.22),rgba(129,140,248,.22));border:1px solid rgba(103,232,249,.35)}
.logo em{font-style:normal;background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.nav-links{display:flex;gap:1.15rem;margin-left:auto;font-size:.9rem;color:var(--muted)}
.nav-links a{color:var(--muted)} .nav-links a:hover{color:#fff}
.gh-btn{display:inline-flex;align-items:center;gap:.45rem;border:1px solid var(--border);border-radius:999px;
  padding:.38rem .95rem;font-size:.86rem;color:var(--fg)!important;background:var(--card)}
.gh-btn:hover{border-color:var(--border-hi);filter:none}
@media(max-width:740px){.nav-links a:not(.gh-btn){display:none}}

/* ---- hero ---- */
.hero{padding:4.4rem 0 2.6rem;text-align:left}
.hero-kicker{display:inline-flex;align-items:center;gap:.5rem;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--accent);border:1px solid rgba(34,211,238,.3);background:rgba(34,211,238,.07);border-radius:999px;padding:.3rem .9rem;margin-bottom:1.3rem}
.hero h1{font-size:clamp(2.2rem,5.4vw,3.6rem);line-height:1.08;letter-spacing:-.035em;color:#fff;font-weight:850;max-width:46rem}
.hero h1 .grad{background:linear-gradient(92deg,var(--accent) 0%,var(--accent2) 55%,var(--accent3) 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.hero-sub{margin-top:1.15rem;font-size:1.12rem;color:var(--muted);max-width:42rem}
.hero-cta{display:flex;flex-wrap:wrap;gap:.8rem;margin-top:1.8rem}
.btn{display:inline-flex;align-items:center;gap:.5rem;border-radius:11px;padding:.72rem 1.35rem;font-weight:650;font-size:.94rem;
  cursor:pointer;border:1px solid transparent;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
.btn-primary{background:linear-gradient(92deg,#0ea5c9,#6366f1);color:#fff;box-shadow:0 8px 28px -8px rgba(56,189,248,.45)}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 12px 34px -8px rgba(99,102,241,.55);filter:none}
.btn-ghost{border-color:var(--border);color:var(--fg)!important;background:var(--card)}
.btn-ghost:hover{border-color:var(--border-hi);filter:none;transform:translateY(-1px)}
.chips{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:1.7rem}
.chip{font-size:.78rem;color:var(--muted);border:1px solid var(--border);background:var(--card);border-radius:999px;padding:.28rem .8rem}
.chip b{color:var(--accent3);font-weight:700}
.hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:2.5rem;align-items:center}
@media(max-width:900px){.hero-grid{grid-template-columns:1fr}}

/* ---- terminal demo ---- */
.term{border:1px solid var(--border);border-radius:var(--radius);background:rgba(9,13,23,.85);
  box-shadow:0 30px 80px -30px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.02) inset;overflow:hidden}
.term-bar{display:flex;align-items:center;gap:.45rem;padding:.65rem .95rem;border-bottom:1px solid var(--border);background:var(--card)}
.dot{width:11px;height:11px;border-radius:50%}
.term-title{margin-left:auto;margin-right:auto;font-size:.74rem;color:var(--dim);letter-spacing:.04em}
.term-body{position:relative;min-height:196px}
.slide{position:absolute;inset:0;padding:1.1rem 1.2rem;font-size:.83rem;line-height:1.75;opacity:0;transition:opacity .5s ease;pointer-events:none}
.slide.on{opacity:1;pointer-events:auto;position:relative}
.cmd{color:var(--accent3)}
.cmd::before{content:"$ ";color:var(--dim)}
.out{color:var(--muted);white-space:pre-wrap;word-break:break-all}
.out .k{color:#93c5fd}.out .v{color:#fbbf24}.out .b{color:#a78bfa}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.slide:not(.on){opacity:1}}

/* ---- sections ---- */
.section{padding:3.2rem 0}
.sec-head{display:flex;align-items:baseline;gap:1rem;margin-bottom:.4rem}
.sec-head h2{font-size:1.7rem;color:#fff;letter-spacing:-.02em}
.sec-head .count{font-size:.78rem;color:var(--accent);border:1px solid rgba(34,211,238,.3);border-radius:999px;padding:.12rem .7rem}
.sec-blurb{color:var(--muted);margin-bottom:1.6rem;max-width:44rem}
.cat-head{display:flex;align-items:baseline;gap:.7rem;margin:2.2rem 0 1rem}
.cat-head:first-of-type{margin-top:0}
.cat-head h3{font-size:1.08rem;color:#fff}
.cat-head small{color:var(--dim);font-size:.82rem}

/* ---- endpoint cards ---- */
.ep-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(305px,1fr));gap:1rem}
.ep-card{position:relative;display:flex;flex-direction:column;gap:.55rem;background:var(--card);border:1px solid var(--border);
  border-radius:var(--radius);padding:1.15rem 1.2rem;transition:border-color .18s ease,transform .18s ease,background .18s ease;animation:rise .5s ease both}
.ep-card:hover{border-color:var(--border-hi);transform:translateY(-3px);background:var(--card2)}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1}}
.ep-card:nth-child(-n+8){animation-delay:.03s}
.ep-top{display:flex;align-items:center;gap:.65rem}
.ep-icon{width:36px;height:36px;display:grid;place-items:center;font-size:1.05rem;border-radius:10px;
  background:linear-gradient(135deg,rgba(34,211,238,.14),rgba(129,140,248,.14));border:1px solid var(--border)}
.method{font-size:.66rem;font-weight:800;letter-spacing:.06em;color:var(--accent3);border:1px solid rgba(52,211,153,.35);
  background:rgba(52,211,153,.08);border-radius:6px;padding:.1rem .45rem}
.ep-path{font-family:ui-monospace,Menlo,monospace;font-weight:700;font-size:.98rem;color:#fff}
.ep-path:hover{color:var(--accent)}
.ep-sum{font-size:.88rem;color:var(--muted);flex-grow:1}
.ep-params{display:flex;flex-wrap:wrap;gap:.35rem}
.pbadge{font-size:.7rem;color:var(--dim);border:1px solid var(--border);border-radius:6px;padding:.08rem .5rem;font-family:ui-monospace,Menlo,monospace}
.pbadge.req{color:#fbbf24;border-color:rgba(251,191,36,.3)}
.ep-foot{display:flex;gap:.9rem;font-size:.8rem;margin-top:.15rem;align-items:center}
.ep-foot .try{margin-left:auto;cursor:pointer;border:none;background:none;color:var(--accent);font-size:.82rem;font-weight:650;padding:0}
.ep-foot .try:hover{filter:brightness(1.25)}

/* ---- search ---- */
.search-row{display:flex;gap:.8rem;margin-bottom:1.4rem;flex-wrap:wrap}
.search{flex:1;min-width:240px;display:flex;align-items:center;gap:.6rem;background:var(--card);border:1px solid var(--border);
  border-radius:12px;padding:.62rem .95rem}
.search input{flex:1;background:none;border:none;color:var(--fg);font-size:.95rem;outline:none}
.search input::placeholder{color:var(--dim)}
.no-results{display:none;color:var(--muted);text-align:center;padding:2.5rem 0;border:1px dashed var(--border);border-radius:var(--radius)}

/* ---- playground ---- */
.pg{border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg,rgba(17,24,39,.6),rgba(9,13,23,.6));
  box-shadow:0 30px 80px -40px rgba(0,0,0,.7);overflow:hidden}
.pg-head{display:flex;align-items:center;gap:.9rem;padding:1rem 1.3rem;border-bottom:1px solid var(--border);background:var(--card);flex-wrap:wrap}
.pg-head h3{font-size:1rem;color:#fff}
.pg-live{display:inline-flex;align-items:center;gap:.4rem;font-size:.72rem;color:var(--accent3)}
.pg-live::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent3);box-shadow:0 0 8px var(--accent3);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.pg-body{display:grid;grid-template-columns:minmax(260px,380px) 1fr;min-height:340px}
@media(max-width:820px){.pg-body{grid-template-columns:1fr}}
.pg-form{padding:1.25rem;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:.9rem}
.field label{display:block;font-size:.76rem;color:var(--muted);margin-bottom:.32rem;font-family:ui-monospace,Menlo,monospace}
.field label .req-star{color:#fbbf24}
.field input,.field select{width:100%;background:var(--code);border:1px solid var(--border);border-radius:9px;color:var(--fg);
  padding:.55rem .75rem;font-size:.9rem;outline:none;font-family:inherit}
.field input:focus{border-color:var(--border-hi)}
.field select option{background:var(--bg2)}
.run-btn{margin-top:auto;background:linear-gradient(92deg,#0ea5c9,#6366f1);border:none;color:#fff;font-weight:700;font-size:.92rem;
  border-radius:10px;padding:.7rem;cursor:pointer;transition:transform .15s ease}
.run-btn:hover{transform:translateY(-1px)}
.pg-out{display:flex;flex-direction:column;min-width:0}
.urlbar{display:flex;align-items:center;gap:.6rem;padding:.8rem 1.1rem;border-bottom:1px solid var(--border);background:rgba(13,19,34,.5)}
.urlbar code{flex:1;overflow-x:auto;white-space:nowrap;font-size:.8rem;color:var(--accent)}
.copy-btn{border:1px solid var(--border);background:var(--card);color:var(--muted);border-radius:7px;font-size:.72rem;
  padding:.28rem .65rem;cursor:pointer;font-family:inherit}
.copy-btn:hover{color:#fff;border-color:var(--border-hi)}
.resp-meta{display:flex;gap:.8rem;align-items:center;padding:.55rem 1.1rem;font-size:.75rem;color:var(--muted);border-bottom:1px solid var(--border)}
.status-pill{font-weight:700;border-radius:999px;padding:.1rem .6rem;font-size:.72rem}
.status-ok{color:var(--accent3);background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.35)}
.status-err{color:#f87171;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.35)}
.tabs{display:flex;gap:.3rem;padding:.6rem 1.1rem;border-bottom:1px solid var(--border)}
.tab{border:1px solid transparent;background:none;color:var(--dim);font-size:.78rem;font-weight:650;border-radius:8px;
  padding:.3rem .8rem;cursor:pointer;font-family:ui-monospace,Menlo,monospace}
.tab.on{color:#fff;background:var(--card2);border-color:var(--border)}
.pane{display:none;padding:1.1rem;overflow:auto;flex:1;max-height:420px}
.pane.on{display:block}
.pane pre{white-space:pre-wrap;word-break:break-word;font-size:.84rem;line-height:1.7;color:var(--fg)}
.j-k{color:#93c5fd}.j-s{color:#86efac}.j-n{color:#fbbf24}.j-b{color:#c4b5fd}.j-x{color:#94a3b8}

/* ---- doc pages ---- */
.doc{max-width:52rem;margin:0 auto;padding:2.6rem 1.25rem 1rem}
.crumb{font-size:.86rem;color:var(--muted);margin-bottom:1.4rem}
.crumb a{color:var(--muted)} .crumb a:hover{color:#fff}
.doc-hero{border:1px solid var(--border);border-radius:16px;background:linear-gradient(180deg,rgba(17,24,39,.55),rgba(9,13,23,.55));padding:1.6rem 1.7rem;margin-bottom:1.6rem}
.doc-hero h1{display:flex;align-items:center;gap:.7rem;font-size:1.55rem;color:#fff;letter-spacing:-.02em;flex-wrap:wrap}
.doc-hero h1 code{font-size:1.35rem;color:#fff;background:none;border:none;padding:0}
.doc-hero .sum{color:var(--muted);margin-top:.55rem}
.doc-actions{display:flex;gap:.7rem;margin-top:1.15rem;flex-wrap:wrap}
.doc-body h2{font-size:1.3rem;color:#fff;margin:1.9rem 0 .8rem;padding-bottom:.4rem;border-bottom:1px solid var(--border)}
.doc-body h3{font-size:1.08rem;color:#fff;margin:1.4rem 0 .5rem}
.doc-body p{margin:.7rem 0;color:var(--fg)}
.doc-body ul{padding-left:1.4rem;margin:.7rem 0}
.doc-body li{margin:.25rem 0}
.doc-body code{background:var(--code);border:1px solid var(--border);border-radius:5px;padding:.08rem .4rem;font-size:.87em;color:#93c5fd}
.doc-body pre{background:var(--code);border:1px solid var(--border);border-radius:11px;padding:1rem 1.15rem;overflow-x:auto;margin:.9rem 0}
.doc-body pre code{background:none;border:none;padding:0;color:var(--fg)}
.doc-body table{border-collapse:collapse;width:100%;margin:.9rem 0;font-size:.89em}
.doc-body th,.doc-body td{border:1px solid var(--border);padding:.5rem .7rem;text-align:left}
.doc-body th{background:var(--card2);color:#fff}
.doc-body blockquote{border-left:3px solid var(--accent);padding:.2rem 0 .2rem 1rem;color:var(--muted);margin:.9rem 0}

/* ---- 404 ---- */
.nf{text-align:center;padding:6rem 1rem}
.nf h1{font-size:clamp(4rem,12vw,7rem);font-weight:850;letter-spacing:-.04em;
  background:linear-gradient(92deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.nf p{color:var(--muted);margin:.6rem 0 1.6rem}

/* ---- stats page ---- */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin:1.6rem 0}
.stat-card{border:1px solid var(--border);border-radius:var(--radius);background:var(--card);padding:1.3rem 1.4rem}
.stat-card .num{font-size:clamp(1.8rem,4vw,2.6rem);font-weight:850;letter-spacing:-.02em;line-height:1.15;
  background:linear-gradient(92deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.stat-card .lbl{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-top:.35rem}
.bar{display:flex;height:10px;border-radius:999px;overflow:hidden;border:1px solid var(--border);margin:.9rem 0 .4rem;max-width:26rem}
.bar span{display:block;height:100%}
.legend{display:flex;gap:1.2rem;font-size:.82rem;color:var(--muted)}
.legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:.4rem}
.notice{border:1px dashed rgba(251,191,36,.4);background:rgba(251,191,36,.06);color:#fbbf24;
  border-radius:11px;padding:.8rem 1.1rem;font-size:.88rem;margin:1.2rem 0}

/* ---- footer ---- */
footer{border-top:1px solid var(--border);margin-top:3rem;background:rgba(9,13,23,.5)}
.foot-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:2rem;padding:2.6rem 0}
@media(max-width:760px){.foot-grid{grid-template-columns:1fr 1fr}}
.foot-brand p{color:var(--muted);font-size:.86rem;margin-top:.6rem;max-width:22rem}
.foot-col h4{font-size:.78rem;text-transform:uppercase;letter-spacing:.09em;color:var(--dim);margin-bottom:.8rem}
.foot-col a{display:block;color:var(--muted);font-size:.88rem;margin:.4rem 0}
.foot-col a:hover{color:#fff}
.foot-base{border-top:1px solid var(--border);padding:1.1rem 0;display:flex;justify-content:space-between;gap:1rem;
  flex-wrap:wrap;color:var(--dim);font-size:.8rem}
`;

// ---------- client script (no template literals: safe to embed) ----------

const CLIENT_JS = String.raw`
(function(){
"use strict";
function $(id){return document.getElementById(id);}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
var ORIGIN=location.origin;

/* ---- copy buttons ---- */
document.addEventListener("click",function(e){
  var b=e.target.closest("[data-copy]");
  if(!b)return;
  var t=b.getAttribute("data-copy-text")||"";if(!t)return;
  function done(){var o=b.textContent;b.textContent="Copied!";setTimeout(function(){b.textContent=o;},1200);}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,done);}
  else done();
});

/* ---- hero terminal rotator ---- */
var slides=document.querySelectorAll(".term .slide");
if(slides.length>1){
  var idx=0;setInterval(function(){
    slides[idx].classList.remove("on");idx=(idx+1)%slides.length;slides[idx].classList.add("on");
  },3600);
}

/* ---- json highlighting ---- */
function hl(json){
  var e=esc(json);
  return e.replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,function(m,str,colon,bool){
    if(str!==undefined)return colon?'<span class="j-k">'+str+"</span>"+colon:'<span class="j-s">'+str+"</span>";
    if(bool!==undefined)return '<span class="j-b">'+bool+"</span>";
    if(m==="null")return '<span class="j-x">null</span>';
    return '<span class="j-n">'+m+"</span>";
  });
}

/* ---- snippet builders ---- */
function snipCurl(u){return 'curl -s "'+u+'"';}
function snipJs(u){return 'const res = await fetch("'+u+'");\nconst data = await res.json();\nconsole.log(data);';}
function snipPy(u,q){
  if(!q)return 'import requests\n\nprint(requests.get("'+u+'").json())';
  var lines=["import requests","","r = requests.get(","    \""+u.split("?")[0]+"\",","    params={"];
  q.forEach(function(p,i){lines.push("        \""+p[0]+"\": \""+p[1]+"\""+(i<q.length-1?",":""));});
  lines.push("    },",")","print(r.json())");
  return lines.join("\n");
}

/* ---- generic tabs ---- */
document.querySelectorAll("[data-tabs]").forEach(function(box){
  var tabs=box.querySelectorAll(".tab"),panes=box.querySelectorAll(".pane");
  tabs.forEach(function(t,i){
    t.addEventListener("click",function(){
      tabs.forEach(function(x){x.classList.remove("on");});panes.forEach(function(p){p.classList.remove("on");});
      t.classList.add("on");panes[i].classList.add("on");
    });
  });
});

/* ---- search filter ---- */
var search=$("ep-search");
if(search){
  search.addEventListener("input",function(){
    var q=search.value.trim().toLowerCase(),any=false;
    document.querySelectorAll(".ep-card").forEach(function(c){
      var hit=!q||c.getAttribute("data-search").indexOf(q)!==-1;
      c.style.display=hit?"":"none";if(hit)any=true;
    });
    document.querySelectorAll("[data-cat]").forEach(function(g){
      var vis=Array.prototype.some.call(g.querySelectorAll(".ep-card"),function(c){return c.style.display!=="none";});
      g.style.display=vis?"":"none";
    });
    var nr=$("no-results");if(nr)nr.style.display=any?"none":"block";
  });
}

/* ---- playground ---- */
var pgEl=$("playground");
if(pgEl&&typeof EPS!=="undefined"){
  var byName={};EPS.forEach(function(e){byName[e.name]=e;});
  var sel=$("pg-select"),fields=$("pg-fields"),urlCode=$("pg-url"),runBtn=$("pg-run"),
      respMeta=$("pg-meta"),respPane=$("pg-resp"),tabsBox=$("pg-tabs"),
      paneCurl=$("pane-curl"),paneJs=$("pane-js"),panePy=$("pane-py"),paneJson=$("pane-json");

  function parseExample(ex){
    var qi=ex.indexOf("?"),out={};
    if(qi===-1)return out;
    ex.slice(qi+1).split("&").forEach(function(kv){
      var p=kv.split("=");out[decodeURIComponent(p[0])]=decodeURIComponent((p[1]||"").replace(/\+/g," "));
    });
    return out;
  }
  function currentValues(){
    var v={};fields.querySelectorAll("input").forEach(function(i){v[i.getAttribute("data-p")]=i.value;});return v;
  }
  function buildQuery(ep,v){
    var parts=[];
    ep.params.forEach(function(p){var val=(v[p.name]||"").trim();if(val!=="")parts.push([p.name,val]);});
    return parts;
  }
  function buildUrl(ep,v){
    var q=buildQuery(ep,v);
    return ORIGIN+ep.path+(q.length?"?"+q.map(function(p){return encodeURIComponent(p[0])+"="+encodeURIComponent(p[1]);}).join("&"):"");
  }
  function refresh(){
    var ep=byName[sel.value],v=currentValues(),u=buildUrl(ep,v),q=buildQuery(ep,v);
    urlCode.textContent=u;
    var bar=document.querySelector(".urlbar");
    if(bar)bar.setAttribute("data-copy-text",u);
    paneCurl.innerHTML='<pre>'+hl(snipCurl(u))+'</pre>';
    paneJs.innerHTML='<pre>'+hl(snipJs(u))+'</pre>';
    panePy.innerHTML='<pre>'+hl(snipPy(u,q))+'</pre>';
  }
  function buildFields(ep){
    fields.innerHTML="";
    var pre=parseExample(ep.example);
    ep.params.forEach(function(p){
      var d=document.createElement("div");d.className="field";
      var l=document.createElement("label");
      l.innerHTML=p.name+(p.required?' <span class="req-star">*</span>':"")+" · "+p.type;
      var inp=document.createElement("input");
      inp.setAttribute("data-p",p.name);
      inp.value=pre[p.name]!==undefined?pre[p.name]:"";
      inp.placeholder=p.description;
      if(p.type==="integer"||p.type==="number")inp.setAttribute("inputmode","decimal");
      inp.addEventListener("input",refresh);
      d.appendChild(l);d.appendChild(inp);fields.appendChild(d);
    });
    if(ep.params.length===0)fields.innerHTML='<p style="color:var(--dim);font-size:.85rem">This endpoint takes no parameters — just hit Run.</p>';
  }
  function setStatus(ok,text,ms){
    respMeta.innerHTML='<span class="status-pill '+(ok?"status-ok":"status-err")+'">'+text+"</span>"+
      (ms!=null?'<span>'+ms+" ms</span>":"")+'<span style="margin-left:auto">'+new Date().toLocaleTimeString()+"</span>";
  }
  function run(){
    var ep=byName[sel.value],u=buildUrl(ep,currentValues());
    var t0=performance.now();
    setStatus(true,"running…",null);
    fetch(u,{signal:AbortSignal.timeout?AbortSignal.timeout(15000):undefined})
      .then(function(r){
        var ms=Math.round(performance.now()-t0);
        return r.text().then(function(txt){
          var ok=r.ok;setStatus(ok,r.status+" "+(r.statusText||""),ms);
          try{respPane.innerHTML="<pre>"+hl(JSON.stringify(JSON.parse(txt),null,2))+"</pre>";}
          catch(_){respPane.innerHTML="<pre>"+esc(txt)+"</pre>";}
        });
      })
      .catch(function(err){
        setStatus(false,"network error",null);
        respPane.innerHTML="<pre>"+esc(String(err&&err.message||err))+"</pre>";
      });
  }
  function load(name,autorun){
    if(byName[name]){sel.value=name;}
    buildFields(byName[sel.value]);refresh();
    if(autorun)run();
  }
  sel.addEventListener("change",function(){load(sel.value,false);});
  runBtn.addEventListener("click",run);

  /* deep-link: /#playground/<endpoint> */
  var m=/^#playground(?:\/([\w-]+))?/.exec(location.hash||"");
  var target=m&&m[1]&&byName[m[1]]?m[1]:null;

  load(target||"uuid",true);

  if(target)setTimeout(function(){pgEl.scrollIntoView({behavior:"smooth"});},60);

  /* card "try it" buttons */
  document.querySelectorAll("[data-try]").forEach(function(b){
    b.addEventListener("click",function(){
      load(b.getAttribute("data-try"),true);
      pgEl.scrollIntoView({behavior:"smooth"});
    });
  });
}
})();
`;

// ---------- shared chrome ----------

function navHtml(origin: string): string {
  return `<nav class="nav"><div class="nav-inner">
<a class="logo" href="/"><span class="logo-bolt">⚡</span>Free<em>For</em>Agents</a>
<div class="nav-links">
<a href="#endpoints">Endpoints</a>
<a href="#playground">Playground</a>
<a href="${origin}/openapi.json">OpenAPI</a>
<a href="${origin}/llms.txt">llms.txt</a>
<a href="${origin}/mcp.txt">MCP</a>
<a class="gh-btn" href="https://github.com/aiplayground3934-byte/freeforagents" rel="noopener" target="_blank">
<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
GitHub</a>
</div>
</div></nav>`;
}

function footerHtml(origin: string): string {
  return `<footer><div class="wrap">
<div class="foot-grid">
<div class="foot-brand">
<a class="logo" href="/"><span class="logo-bolt">⚡</span>Free<em>For</em>Agents</a>
<p>Free utility APIs built for humans and AI agents. No API key, no signup, no rate-limit drama.</p>
</div>
<div class="foot-col"><h4>Product</h4>
<a href="#endpoints">All endpoints</a>
<a href="#playground">Live playground</a>
<a href="${origin}/openapi.json">OpenAPI spec</a>
<a href="${origin}/stats">Usage stats</a>
</div>
<div class="foot-col"><h4>For agents</h4>
<a href="${origin}/llms.txt">llms.txt</a>
<a href="${origin}/mcp">MCP server</a>
<a href="${origin}/mcp.txt">MCP manifest</a>
<a href="${origin}/docs">Markdown docs</a>
</div>
<div class="foot-col"><h4>Project</h4>
<a href="https://github.com/aiplayground3934-byte/freeforagents" rel="noopener" target="_blank">GitHub</a>
<a href="${origin}/robots.txt">robots.txt</a>
</div>
</div>
<div class="foot-base"><span>FreeForAgents · free forever</span><span>No cookies · No tracking · Powered by Cloudflare Workers</span></div>
</div></footer>`;
}

function page(title: string, bodyHtml: string, origin: string, extraData = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Free, zero-auth utility APIs for humans and AI agents. No keys, no signup. UUID, hashing, FX rates, holidays, unit conversion and more.">
<meta name="theme-color" content="#05070d">
<link rel="icon" href="${origin}/favicon.svg" type="image/svg+xml">
<style>${STYLE}</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebAPI","name":"FreeForAgents","url":"${origin}","description":"Free zero-auth utility APIs: UUID, hashing, unit conversion, FX rates, holidays, random data, IP geolocation and more.","isAccessibleForFree":true}
</script>
</head>
<body>
<div class="bg-fx"></div><div class="bg-grid"></div>
${navHtml(origin)}
${bodyHtml}
${footerHtml(origin)}
<script>var EPS=${extraData || "[]"};
${CLIENT_JS}</script>
</body>
</html>`;
}

function epsJson(): string {
  const slim = ENDPOINTS.map((e) => ({
    name: e.name,
    path: e.path,
    summary: e.summary,
    example: e.example,
    params: e.params.map((p) => ({ name: p.name, type: p.type, required: p.required })),
  }));
  return `JSON.parse(${JSON.stringify(JSON.stringify(slim)).replace(/</g, "\\u003c")})`;
}

// ---------- landing page ----------

export function landingPage(origin: string): string {
  // grouped cards
  const sections = CATEGORY_ORDER.map((key) => {
    const cat = CATEGORIES[key];
    const cards = cat.members
      .map((name) => ENDPOINTS.find((e) => e.name === name))
      .filter((e): e is EndpointDef => Boolean(e))
      .map((ep) => {
        const params = ep.params
          .map(
            (p) =>
              `<span class="pbadge${p.required ? " req" : ""}">${esc(p.name)}${p.required ? " *" : ""}</span>`
          )
          .join(" ");
        const searchText = esc(`${ep.path} ${ep.summary} ${ep.name} ${cat.label}`.toLowerCase());
        return `<article class="ep-card" data-search="${searchText}">
<div class="ep-top"><span class="ep-icon">${EP_ICON[ep.name] ?? "⚡"}</span><span class="method">GET</span>
<a class="ep-path" href="${origin}/docs/${ep.name}" title="View docs">${esc(ep.path)}</a></div>
<p class="ep-sum">${esc(ep.summary)}</p>
<div class="ep-params">${params || '<span class="pbadge">no parameters</span>'}</div>
<div class="ep-foot">
<a href="${origin}/docs/${ep.name}">Docs</a>
<a href="${origin}${esc(ep.example)}" target="_blank" rel="noopener">Raw JSON ↗</a>
<button class="try" data-try="${esc(ep.name)}" type="button">Try it →</button>
</div>
</article>`;
      })
      .join("\n");
    return `<section data-cat="${key}">
<div class="cat-head"><h3>${cat.label}</h3><small>${esc(cat.blurb)} · ${cat.members.length} endpoints</small></div>
<div class="ep-grid">${cards}</div>
</section>`;
  }).join("\n");

  const total = ENDPOINTS.length;
  const body = `
<header class="hero wrap">
<div class="hero-grid">
<div>
<span class="hero-kicker">⚡ Zero-auth APIs for humans &amp; AI agents</span>
<h1>Utility APIs that are actually&nbsp;<span class="grad">free</span>.</h1>
<p class="hero-sub">No API key. No signup. No rate-limit drama. ${total} production-grade endpoints returning clean JSON with CORS wide open — and markdown docs your LLM can read natively.</p>
<div class="hero-cta">
<a class="btn btn-primary" href="#playground">Try the playground</a>
<a class="btn btn-ghost" href="#endpoints">Browse ${total} endpoints</a>
</div>
<div class="chips">
<span class="chip"><b>$0</b>/month forever</span>
<span class="chip"><b>${total}</b> endpoints</span>
<span class="chip"><b>0</b> auth</span>
<span class="chip">CORS <b>*</b></span>
<a class="chip" href="${origin}/llms.txt">🤖 <b>llms.txt</b></a>
<a class="chip" href="${origin}/openapi.json"><b>OpenAPI 3.1</b></a>
<a class="chip" href="${origin}/mcp.txt">🔌 <b>MCP server</b></a>
</div>
</div>
<div class="term" aria-label="live demo">
<div class="term-bar">
<span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span>
<span class="term-title">bash — freeforagents.dev</span>
</div>
<div class="term-body">
<div class="slide on"><span class="cmd">curl -s "${origin}/convert?value=10&amp;from=kg&amp;to=lb"</span>
<span class="out">{
  <span class="k">"ok"</span>: <span class="b">true</span>,
  <span class="k">"value"</span>: <span class="v">10</span>,
  <span class="k">"from"</span>: <span class="v">"kg"</span>, <span class="k">"to"</span>: <span class="v">"lb"</span>,
  <span class="k">"result"</span>: <span class="v">22.046226218487757</span>
}</span></div>
<div class="slide"><span class="cmd">curl -s "${origin}/uuid?count=2"</span>
<span class="out">{
  <span class="k">"ok"</span>: <span class="b">true</span>,
  <span class="k">"uuids"</span>: [
    <span class="v">"3f6b5c1e-8e2a-4c7d-9a1b-2f4e6d8c0a3b"</span>,
    <span class="v">"7d1e9f2a-4b8c-4a3d-b6e0-1c5a8f3d7e2b"</span>
  ]
}</span></div>
<div class="slide"><span class="cmd">curl -s "${origin}/fx?base=USD"</span>
<span class="out">{
  <span class="k">"ok"</span>: <span class="b">true</span>,
  <span class="k">"base"</span>: <span class="v">"USD"</span>,
  <span class="k">"rates"</span>: { <span class="k">"EUR"</span>: <span class="v">0.92</span>, <span class="k">"GBP"</span>: <span class="v">0.79</span>, <span class="k">"JPY"</span>: <span class="v">149.3</span>, … }
}</span></div>
</div>
</div>
</div>
</header>

<section class="section wrap" id="playground" aria-label="API playground">
<div class="sec-head"><h2>Playground</h2><span class="count">live</span></div>
<p class="sec-blurb">Pick an endpoint, tweak parameters, hit run. Real requests against production — this is exactly what your code will get back.</p>
<div class="pg">
<div class="pg-head">
<h3>Request builder</h3><span class="pg-live">LIVE API</span>
</div>
<div class="pg-body">
<div class="pg-form">
<div class="field"><label for="pg-select">endpoint</label>
<select id="pg-select">
${ENDPOINTS.map((e) => `<option value="${esc(e.name)}">${esc(e.path)} — ${esc(e.summary.slice(0, 46))}${e.summary.length > 46 ? "…" : ""}</option>`).join("\n")}
</select></div>
<div id="pg-fields"></div>
<button id="pg-run" class="run-btn" type="button">▶ Run request</button>
</div>
<div class="pg-out">
<div class="urlbar" data-copy><button class="copy-btn" type="button">Copy</button><code id="pg-url"></code></div>
<div class="resp-meta" id="pg-meta"><span style="color:var(--dim)">response will appear here</span></div>
<div data-tabs>
<div class="tabs" role="tablist">
<button class="tab on" type="button">JSON</button>
<button class="tab" type="button">cURL</button>
<button class="tab" type="button">Python</button>
<button class="tab" type="button">JavaScript</button>
</div>
<div class="pane on" id="pane-json"><div id="pg-resp" aria-live="polite"></div></div>
<div class="pane" id="pane-curl"></div>
<div class="pane" id="pane-py"></div>
<div class="pane" id="pane-js"></div>
</div>
</div>
</div>
</div>
</section>

<section class="section wrap" id="endpoints" aria-label="all endpoints">
<div class="sec-head"><h2>Endpoints</h2><span class="count">${total}</span></div>
<p class="sec-blurb">Every endpoint is a plain GET. Click any path for full docs, or “Try it” to load it into the playground above.</p>
<div class="search-row">
<label class="search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="color:var(--dim)"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
<input id="ep-search" type="search" placeholder="Search endpoints… (e.g. uuid, convert, fx)" aria-label="Search endpoints"></label>
</div>
<div id="no-results" class="no-results">No endpoints match your search. Try “random”, “time”, or browse the categories.</div>
${sections}
</section>

<section class="section wrap" aria-label="for agents">
<div class="sec-head"><h2>Built for agents too</h2></div>
<p class="sec-blurb">If you're an LLM or building for one: everything is machine-discoverable. Point your agent at any of these surfaces — no key required.</p>
<div class="ep-grid">
<article class="ep-card"><div class="ep-top"><span class="ep-icon">🔌</span><span class="method">MCP</span><span class="ep-path">/mcp</span></div>
<p class="ep-sum">Model Context Protocol server exposing all ${total} endpoints as tools over Streamable HTTP.</p>
<div class="ep-foot"><a href="${origin}/mcp.txt">Manifest</a><a href="${origin}/mcp">Connect →</a></div></article>
<article class="ep-card"><div class="ep-top"><span class="ep-icon">🤖</span><span class="method">TXT</span><span class="ep-path">/llms.txt</span></div>
<p class="ep-sum">Standard llms.txt index so agents discover and cite every capability in one fetch.</p>
<div class="ep-foot"><a href="${origin}/llms.txt">Read →</a></div></article>
<article class="ep-card"><div class="ep-top"><span class="ep-icon">📄</span><span class="method">MD</span><span class="ep-path">/docs/*.md</span></div>
<p class="ep-sum">Every endpoint ships raw markdown documentation, linked from each API response's <code>docs</code> field.</p>
<div class="ep-foot"><a href="${origin}/docs">Index</a><a href="${origin}/docs/uuid.md">Example →</a></div></article>
<article class="ep-card"><div class="ep-top"><span class="ep-icon">📘</span><span class="method">SPEC</span><span class="ep-path">/openapi.json</span></div>
<p class="ep-sum">Full OpenAPI 3.1 spec — drop into any SDK generator or API client instantly.</p>
<div class="ep-foot"><a href="${origin}/openapi.json">Download →</a></div></article>
</div>
</section>`;

  return page("FreeForAgents — free zero-auth APIs for humans & AI agents", body, origin, epsJson());
}

// ---------- endpoint doc page ----------

function snippetTabsHtml(url: string, queryPairs: [string, string][]): string {
  const curl = `curl -s "${url}"`;
  const js = `const res = await fetch("${url}");\nconst data = await res.json();\nconsole.log(data);`;
  let py: string;
  if (queryPairs.length === 0) {
    py = `import requests\n\nprint(requests.get("${url}").json())`;
  } else {
    const base = url.split("?")[0];
    const rows = queryPairs.map(([k, v], i) => `    "${k}": "${v}"${i < queryPairs.length - 1 ? "," : ""}`).join("\n");
    py = `import requests\n\nr = requests.get(\n    "${base}",\n    params={\n${rows}\n    },\n)\nprint(r.json())`;
  }
  return `<div class="pg" data-tabs style="margin:1.2rem 0">
<div class="tabs" role="tablist">
<button class="tab on" type="button">cURL</button>
<button class="tab" type="button">JavaScript</button>
<button class="tab" type="button">Python</button>
</div>
<div class="pane on"><pre>${esc(curl)}</pre></div>
<div class="pane"><pre>${esc(js)}</pre></div>
<div class="pane"><pre>${esc(py)}</pre></div>
</div>`;
}

function exampleQueryPairs(ep: EndpointDef): [string, string][] {
  const qi = ep.example.indexOf("?");
  if (qi === -1) return [];
  return ep.example
    .slice(qi + 1)
    .split("&")
    .map((kv) => {
      const [k, v = ""] = kv.split("=");
      return [decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, " "))] as [string, string];
    });
}

export function endpointDocPage(ep: EndpointDef, origin: string, _all: EndpointDef[]): string {
  const pairs = exampleQueryPairs(ep);
  const fullUrl = `${origin}${ep.example}`;
  const body = `
<main class="doc">
<p class="crumb"><a href="/">← All endpoints</a> / ${esc(ep.name)}</p>
<div class="doc-hero">
<h1><span class="ep-icon">${EP_ICON[ep.name] ?? "⚡"}</span><code>GET ${esc(ep.path)}</code></h1>
<p class="sum">${esc(ep.summary)}</p>
<div class="doc-actions">
<a class="btn btn-primary" style="padding:.5rem 1.1rem;font-size:.86rem" href="${origin}/#playground/${esc(ep.name)}">Open in playground →</a>
<a class="btn btn-ghost" style="padding:.5rem 1.1rem;font-size:.86rem" href="${origin}/docs/${esc(ep.name)}.md">Raw markdown</a>
<a class="btn btn-ghost" style="padding:.5rem 1.1rem;font-size:.86rem" href="${fullUrl}" target="_blank" rel="noopener">Run it ↗</a>
</div>
${snippetTabsHtml(fullUrl, pairs)}
</div>
<div class="doc-body">
${renderMarkdown(endpointDocMd(ep, origin, _all))}
</div>
</main>`;
  return page(`GET ${ep.path} — FreeForAgents`, body, origin, epsJson());
}

// ---------- misc pages ----------

export function notFoundPage(origin: string, pathRequested: string): string {
  const popular = ["uuid", "convert", "fx", "password"]
    .map((n) => ENDPOINTS.find((e) => e.name === n))
    .filter((e): e is EndpointDef => Boolean(e))
    .map(
      (e) =>
        `<a class="chip" href="${origin}/docs/${e.name}">${EP_ICON[e.name] ?? "⚡"} <b>${esc(e.path)}</b></a>`
    )
    .join(" ");
  const body = `
<main class="nf">
<h1>404</h1>
<p><code style="color:#f87171">${esc(pathRequested)}</code> isn't an endpoint on FreeForAgents.</p>
<div class="hero-cta" style="justify-content:center"><a class="btn btn-primary" href="/">Browse all endpoints</a></div>
<p style="margin-top:2rem;color:var(--dim);font-size:.85rem">Popular right now:</p>
<div class="chips" style="justify-content:center">${popular}</div>
</main>`;
  return page("404 — FreeForAgents", body, origin);
}

export function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#22d3ee"/><stop offset=".55" stop-color="#818cf8"/><stop offset="1" stop-color="#34d399"/>
</linearGradient></defs>
<rect x="2" y="2" width="60" height="60" rx="14" fill="#0b1120"/>
<path d="M35 8 16 37h11l-3 19 20-30H32z" fill="url(#g)"/>
</svg>`;
}

// ---------- stats page ----------

export interface StatsRollup {
  generated_at?: string;
  total_90d?: number;
  last24h?: { requests: number; bots?: Record<string, number>; endpoints?: { endpoint: string; requests: number }[] };
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function statsPage(origin: string, rollup: StatsRollup | null, tokenConfigured: boolean): string {
  const has = Boolean(rollup?.generated_at);
  const total = rollup?.total_90d ?? 0;
  const day = rollup?.last24h ?? { requests: 0 };
  const bots = rollup?.last24h?.bots ?? {};
  const botCount = (bots.bot ?? 0) + (bots.human ?? 0);
  const botPct = botCount > 0 ? Math.round(((bots.bot ?? 0) / botCount) * 100) : null;

  const rows = (rollup?.last24h?.endpoints ?? [])
    .slice(0, 15)
    .map(
      (e) =>
        `<tr><td><a href="${origin}/docs/${esc(e.endpoint)}">${esc(e.endpoint)}</a></td><td style="text-align:right">${e.requests.toLocaleString()}</td></tr>`
    )
    .join("\n");

  const notice = !tokenConfigured
    ? `<div class="notice">⚙️ Stats sync isn't configured yet — set the <code>AE_TOKEN</code> worker secret (Account Analytics Read token) and the hourly rollup will populate automatically.</div>`
    : !has
      ? `<div class="notice">⏳ Waiting for the first hourly sync. Numbers appear within the hour.</div>`
      : "";

  const body = `
<main class="doc" style="max-width:56rem">
<p class="crumb"><a href="/">← Home</a> / live usage</p>
<div class="sec-head"><h2>Usage stats</h2><span class="count">public</span></div>
<p class="sec-blurb">Real traffic across freeforagents.dev, aggregated hourly from edge analytics. No cookies, no tracking — just counts.</p>
${notice}
<div class="stat-grid">
<div class="stat-card"><div class="num">${has ? fmtNum(total) : "—"}</div><div class="lbl">requests · last 90 days</div></div>
<div class="stat-card"><div class="num">${has ? fmtNum(day.requests) : "—"}</div><div class="lbl">requests · last 24 hours</div></div>
<div class="stat-card"><div class="num">${botPct === null ? "—" : `${botPct}%`}</div><div class="lbl">agent / bot share · 24h</div></div>
<div class="stat-card"><div class="num">${ENDPOINTS.length + 23}</div><div class="lbl">API endpoints + MCP tools</div></div>
</div>
${
  botPct !== null
    ? `<div class="bar"><span style="width:${botPct}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></span><span style="flex:1;background:rgba(148,163,199,.18)"></span></div>
<div class="legend"><span><i style="background:var(--accent)"></i>agents &amp; bots ${fmtNum(bots.bot ?? 0)}</span><span><i style="background:#94a3b8"></i>humans ${fmtNum(bots.human ?? 0)}</span></div>`
    : ""
}
${rows ? `<div class="cat-head" style="margin-top:2.4rem"><h3>Top endpoints · last 24h</h3></div>
<table class="doc-body" style="width:100%;border-collapse:collapse;font-size:.9em">
<thead><tr><th style="text-align:left;padding:.5rem .7rem;border-bottom:1px solid var(--border)">Endpoint</th><th style="text-align:right;padding:.5rem .7rem;border-bottom:1px solid var(--border)">Requests</th></tr></thead>
<tbody>${rows}</tbody></table>` : ""}
<p class="muted" style="font-size:.85rem;margin-top:2rem">Machine-readable: <a href="${origin}/stats.json">${origin}/stats.json</a> · updated hourly</p>
</main>`;
  return page("Usage stats — FreeForAgents", body, origin);
}
