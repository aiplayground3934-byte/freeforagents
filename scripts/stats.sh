#!/usr/bin/env bash
# Query FreeForAgents per-endpoint analytics (Cloudflare Analytics Engine).
#
# One-time setup:
#   1. Create an API token: https://dash.cloudflare.com/profile/api-tokens
#      → Create Token → Custom token
#         Permissions: Account | Workers Observability | Read   (if unavailable,
#         use Account | Account Analytics | Read)
#         Account Resources: your account
#   2. export CF_ACCOUNT_ID=da4b0c29ca4b88c444140be516510dbe
#      export CF_API_TOKEN=<the token>
#
# Usage:
#   ./stats.sh                 # last 24h by endpoint
#   ./stats.sh bots            # bot vs human split, last 24h
#   ./stats.sh week            # last 7 days by endpoint
#   ./stats.sh errors          # non-200 responses, last 24h
#   ./stats.sh "SELECT ..."    # custom SQL against dataset freeforagents_stats

set -euo pipefail

: "${CF_ACCOUNT_ID:?set CF_ACCOUNT_ID}"
: "${CF_API_TOKEN:?set CF_API_TOKEN}"

SQL_URL="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql"
QUERY_DEFAULT="SELECT index1 AS endpoint, COUNT() AS requests, SUM(_sample_interval) AS weighted
FROM freeforagents_stats
WHERE timestamp > NOW() - INTERVAL '24' HOUR AND blob2 = '200'
GROUP BY endpoint ORDER BY requests DESC FORMAT JSON"

case "${1:-}" in
  "")     Q="$QUERY_DEFAULT" ;;
  bots)   Q="SELECT blob1 AS agent_type, COUNT() AS requests FROM freeforagents_stats WHERE timestamp > NOW() - INTERVAL '24' HOUR GROUP BY agent_type ORDER BY requests DESC FORMAT JSON" ;;
  week)   Q="SELECT index1 AS endpoint, COUNT() AS requests FROM freeforagents_stats WHERE timestamp > NOW() - INTERVAL '168' HOUR GROUP BY endpoint ORDER BY requests DESC FORMAT JSON" ;;
  errors) Q="SELECT index1 AS endpoint, blob2 AS status, COUNT() AS n FROM freeforagents_stats WHERE timestamp > NOW() - INTERVAL '24' HOUR AND blob2 != '200' GROUP BY endpoint, status ORDER BY n DESC FORMAT JSON" ;;
  *)      Q="$1" ;;
esac

curl -s "${SQL_URL}" -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: text/plain" --data-binary "$Q"
