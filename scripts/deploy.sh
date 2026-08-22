#!/usr/bin/env bash
# Local deployment script for FreeForAgents.
#
# Usage:
#   ./scripts/deploy.sh              # typecheck + deploy + smoke test
#
# Required env (Analytics Engine bindings are not deployable via wrangler OAuth):
#   CLOUDFLARE_API_TOKEN    token with Workers Scripts Edit, Account Analytics Read,
#                           Zone Workers Routes Edit (create at dash.cloudflare.com/profile/api-tokens)
#   CLOUDFLARE_ACCOUNT_ID   da4b0c29ca4b88c444140be516510dbe
#
# Tip: keep them in ~/.cloudflare/freeforagents.env and `source` it first.

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "✘ Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID first."
  echo "  e.g.:  source ~/.cloudflare/freeforagents.env && ./scripts/deploy.sh"
  exit 1
fi

echo "▸ Typecheck"
npx tsc --noEmit

echo "▸ Deploying"
npx wrangler deploy

echo "▸ Smoke tests"
BASE="${SMOKE_BASE_URL:-https://freeforagents.dev}"
fail=0
for path in "/" "/llms.txt" "/openapi.json" "/robots.txt" "/uuid" "/joke" "/docs/ip.md"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$BASE$path")
  if [[ "$code" == "200" ]]; then echo "  ✓ $path ($code)"; else echo "  ✘ $path ($code)"; fail=1; fi
done
mcp=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -X POST "$BASE/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
if [[ "$mcp" == "200" ]]; then echo "  ✓ POST /mcp ($mcp)"; else echo "  ✘ POST /mcp ($mcp)"; fail=1; fi

if [[ $fail -ne 0 ]]; then
  echo "✘ Smoke tests failed — check https://dash.cloudflare.com → Workers → freeforagents → Logs"
  exit 1
fi
echo "✔ Deployed and verified: $BASE"
