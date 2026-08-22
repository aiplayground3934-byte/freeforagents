# AGENTS.md — FreeForAgents

Context for AI agents (and humans) working on this repository.

## Project

**FreeForAgents** — a hub of 20 free, zero-auth utility JSON APIs designed for both humans and AI agents. Live at **https://freeforagents.dev**.

- **Repo:** https://github.com/aiplayground3934-byte/freeforagents
- **Hosting:** Cloudflare Workers, free tier (100k req/day). Cost: $0/mo + ~$10/yr domain.
- **Stack:** TypeScript on Cloudflare Workers. No framework, no database. FX rates cached via the Cache API; all other datasets are embedded in `src/data.ts`.

## Architecture

```
src/
├── index.ts      Router: API routes, /docs pages, site pages, MCP passthrough
├── endpoints.ts  Endpoint metadata (params, examples) + handler implementations
├── data.ts       Curated datasets (jokes, facts, quotes, emoji, lorem words)
├── pages.ts      Landing page, doc pages, llms.txt, OpenAPI spec — ALL generated
│                 from the ENDPOINTS array in endpoints.ts (single source of truth)
└── mcp.ts        MCP server at POST /mcp: JSON-RPC 2.0, stateless, 20 tools,
                 each mapped to an existing endpoint's run() function
```

Key conventions:
- **Adding an endpoint:** append to `ENDPOINTS` in `endpoints.ts`. Docs, landing page, llms.txt and OpenAPI regenerate automatically. If it should be an MCP tool too, add a matching entry to `TOOLS` in `mcp.ts`.
- Every successful response is `{ ok: true, docs: "<md doc url>", ...payload }`; errors are `{ ok: false, error }` with proper HTTP status via `ApiError`.
- CORS is wide open on everything. GET only, except `/mcp` which also accepts POST (JSON-RPC).
- The `/json` proxy has SSRF guards: https-only, private/internal hosts blocked, 8s timeout, 500KB limit.

## Endpoints (20)

`/ip`, `/uuid`, `/ulid`, `/hash`, `/base64`, `/convert`, `/time`, `/timestamp`, `/random`, `/dice`, `/password`, `/lorem`, `/emoji`, `/joke`, `/fact`, `/quote`, `/holidays`, `/fx`, `/headers`, `/json`

Agent-discovery surfaces: `/llms.txt`, `/openapi.json`, `/docs/<name>.md` (raw markdown), `/docs/<name>` (HTML), `/robots.txt` (explicitly allows AI crawlers), `/mcp.txt` (MCP manifest).

## Commands

```bash
npm run dev        # wrangler dev on :8787
npm run typecheck  # tsc --noEmit
npm run deploy     # requires wrangler auth — BUT see credentials note re: Analytics Engine
./scripts/deploy.sh  # full local deploy: typecheck + deploy + smoke tests
                     # needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID env vars
```

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys on every push to `main`:
typecheck → wrangler deploy → production smoke tests. Uses repo secrets
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`. Check status with `gh run list`.

## Deployment & credentials

- Deployed via `npx wrangler deploy`; custom domains `freeforagents.dev` (canonical) and `www.freeforagents.dev` (301 → apex) configured in `wrangler.jsonc` (`workers_dev: false`).
- Wrangler OAuth token lives OUTSIDE the repo at `~/Library/Preferences/.wrangler/config/default.toml` (account email: aiplayground3934@gmail.com). Never commit tokens.
- **Analytics Engine binding (`STATS`)** requires an API token with `Workers Scripts Edit` + `Account Analytics Read` + `Zone Workers Routes Edit`; wrangler's OAuth has no AE scope. Deploy with `CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=da4b0c29ca4b88c444140be516510dbe npx wrangler deploy`.
- Git pushes use `gh auth setup-git` credential helper; GitHub account: aiplayground3934-byte.
- Commits use GitHub noreply email for privacy.

## Analytics / traffic checking

Every request writes an Analytics Engine datapoint to dataset `freeforagents_stats`:
- `index1` = route label (endpoint name, `/mcp`, `/docs`, `/`, or `404`)
- `blob1` = `bot` | `human` | `empty` (user-agent classified via BOT_PATTERNS)
- `blob2` = HTTP status
- `blob3` = referer

Query it with `scripts/stats.sh` (needs `CF_ACCOUNT_ID` + `CF_API_TOKEN` env vars):
```bash
./scripts/stats.sh        # requests by endpoint, 24h
./scripts/stats.sh bots   # bot vs human split
./scripts/stats.sh week   # by endpoint, 7 days
./scripts/stats.sh errors # non-200s
./scripts/stats.sh "SELECT ..."  # custom SQL (columns: index1, blob1..3, timestamp)
```
AE SQL endpoint: POST https://api.cloudflare.com/client/v4/accounts/<account_id>/analytics_engine/sql. Retention ~90 days. Data lags a few minutes behind realtime.

## Traffic strategy (why the project exists)

1. Long-tail SEO: every endpoint targets "free X API without key" queries.
2. Agent-native discovery: llms.txt + markdown docs get preferentially crawled/cited by LLM agents.
3. Every API response carries a `"docs"` hint → organic propagation through agent conversations.
4. MCP server listed in registries (mcp.so, Smithery, PulseMCP, mcpservers.org).
5. Launch kit (HN post, Reddit drafts, directory copy) lives in `~/freeforagents-marketing/launch-kit.md`.

## Status / open items

- [x] Site live, all endpoints tested (2026-08-22)
- [x] MCP server live at https://freeforagents.dev/mcp
- [x] GitHub repo public with topics
- [x] PR to public-apis/public-apis: #7017 (awaiting merge)
- [ ] Post Show HN + Reddit drafts (needs account owner)
- [ ] Submit to MCP registries + llmstxt.site + apilist.fun
- [ ] Optional: more endpoints, quarterly dataset refresh

## Maintenance checklist (~15 min/week)

- Check CF dashboard for error spikes; verify `/fx?base=USD` upstream still live.
- Free-tier limits are soft (100k req/day); no action needed unless exceeded.
- Keep dependencies minimal; wrangler is the only meaningful dev dep.

## Rules for agents editing this repo

- Never add secrets, keys, or tokens to any committed file.
- Run `npx tsc --noEmit` before deploying; smoke-test with `wrangler dev` first.
- Keep responses JSON-only and backwards compatible (don't rename existing fields).
- Don't break the `"docs"` hint convention — agents depend on it.
