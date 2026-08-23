#!/usr/bin/env bash
# One-time setup for the public stats feature (/stats, /stats.json):
#   1. Creates the STATS_STORE KV namespace
#   2. Prints the wrangler.jsonc block to paste (and the AE_TOKEN secret command)
#
# Uses the same credentials as deploy.sh:
#   export CLOUDFLARE_ACCOUNT_ID=da4b0c29ca4b88c444140be516510dbe
#   export CLOUDFLARE_API_TOKEN=<token with Workers KV Edit>

set -euo pipefail

: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"

echo "→ Creating KV namespace STATS_STORE…"
RESP=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"title":"freeforagents_STATS_STORE"}')

ID=$(printf '%s' "$RESP" | /usr/bin/python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("result",{}).get("id",""))' 2>/dev/null || true)

if [ -z "$ID" ]; then
  echo "✘ Could not create namespace (may already exist). Response:"
  printf '%s\n' "$RESP"
  echo "List existing namespaces:"
  echo "  curl -s -H \"Authorization: Bearer \$CLOUDFLARE_API_TOKEN\" \\"
  echo "    https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces"
  exit 1
fi

echo "✔ Created namespace id: $ID"
echo
echo "Paste into wrangler.jsonc (replace the commented kv_namespaces block):"
echo
echo "  \"kv_namespaces\": ["
echo "    { \"binding\": \"STATS_STORE\", \"id\": \"$ID\" }"
echo "  ],"
echo
echo "Then configure the analytics read token used by the hourly rollup:"
echo "  CLOUDFLARE_API_TOKEN=<Account-Analytics-Read-token> npx wrangler secret put AE_TOKEN"
echo
echo "Finally deploy: npm run typecheck && npm run deploy"
