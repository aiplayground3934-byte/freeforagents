# ⚡ FreeForAgents

**Free utility APIs built for humans and AI agents.** No API key, no signup, no rate-limit drama.

**Live:** https://freeforagents.dev · [llms.txt](https://freeforagents.dev/llms.txt) · [OpenAPI 3.1](https://freeforagents.dev/openapi.json)

## Why

Agents and scripts constantly need tiny utilities — a UUID, a hash, an FX rate, unit conversion, a holiday calendar. Existing free APIs demand keys, signups, or die silently. FreeForAgents fixes that:

- **Zero auth** — every endpoint is a plain GET
- **JSON everywhere** with CORS wide open (`Access-Control-Allow-Origin: *`)
- **Markdown docs** at `/docs/<endpoint>.md` so LLMs can read them natively
- **`llms.txt` + OpenAPI** for machine discovery
- Runs on Cloudflare Workers free tier — **$0/month**

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /ip` | Caller IP + geolocation |
| `GET /uuid?count=` | RFC 4122 v4 UUIDs |
| `GET /ulid` | Sortable ULIDs |
| `GET /hash?text=&algo=` | SHA-1/256/384/512 hex digest |
| `GET /base64?text=&mode=` | Base64 encode/decode |
| `GET /convert?value=&from=&to=` | Units + temperature conversion |
| `GET /time?tz=` | Time in any IANA timezone |
| `GET /timestamp` | Current Unix time |
| `GET /random?min=&max=&count=` | CSPRNG integers/floats |
| `GET /dice?rolls=&sides=` | Dice rolls |
| `GET /password?length=&count=` | Strong random passwords |
| `GET /lorem?paragraphs=` | Placeholder text |
| `GET /emoji?count=` | Random emoji |
| `GET /joke` `/fact` `/quote` | Curated content |
| `GET /holidays?country=&year=` | Public holidays (US/GB/CA/AU/NZ/IN) |
| `GET /fx?base=` | Daily FX rates (edge-cached) |
| `GET /headers` | Echo request headers |
| `GET /json?url=` | Minimal https-only JSON proxy |

Every response includes a `"docs"` URL hint pointing at its markdown documentation.

## Example

```bash
curl -s "https://freeforagents.dev/convert?value=10&from=kg&to=lb"
```

```json
{
  "ok": true,
  "docs": "https://freeforagents.dev/docs/convert.md",
  "value": 10,
  "from": "kg",
  "to": "lb",
  "result": 22.046226218487757
}
```

## Development

```bash
npm install
npm run dev        # http://localhost:8787
npm run typecheck
npm run deploy     # requires wrangler login
```

## License

MIT
