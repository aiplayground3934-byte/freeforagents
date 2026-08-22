import { ENDPOINTS, ApiError, findEndpoint } from "./endpoints";

// Minimal stateless MCP (Model Context Protocol) server over Streamable HTTP.
// Exposes every FreeForAgents endpoint as an MCP tool at POST /mcp.

interface ToolDef {
  name: string;
  title: string;
  description: string;
  endpoint: string;
  inputSchema: Record<string, unknown>;
}

const int = (desc: string, min?: number, max?: number) => ({
  type: "integer" as const,
  description: desc,
  ...(min !== undefined ? { minimum: min } : {}),
  ...(max !== undefined ? { maximum: max } : {}),
});

export const TOOLS: ToolDef[] = [
  { name: "ip_lookup", title: "IP Lookup", description: "Get your public IP address and geolocation (country, city, coordinates, timezone, ASN). Takes no arguments.", endpoint: "/ip", inputSchema: { type: "object", properties: {} } },
  {
    name: "uuid_generate", title: "UUID Generator", description: "Generate one or more cryptographically random RFC 4122 v4 UUIDs.",
    endpoint: "/uuid",
    inputSchema: { type: "object", properties: { count: int("How many UUIDs (1-100)", 1, 100) } },
  },
  { name: "ulid_generate", title: "ULID Generator", description: "Generate ULIDs — lexicographically sortable unique identifiers.", endpoint: "/ulid", inputSchema: { type: "object", properties: { count: int("How many ULIDs (1-100)", 1, 100) } } },
  {
    name: "hash_text", title: "Hash Text", description: "Compute the SHA hex digest of text.",
    endpoint: "/hash",
    inputSchema: { type: "object", properties: { text: { type: "string", description: "Text to hash" }, algo: { type: "string", enum: ["sha-1", "sha-256", "sha-384", "sha-512"], description: "Hash algorithm (default sha-256)" } }, required: ["text"] },
  },
  {
    name: "base64", title: "Base64 Encode/Decode", description: "Encode text to Base64 or decode Base64 to UTF-8 text.",
    endpoint: "/base64",
    inputSchema: { type: "object", properties: { text: { type: "string" }, mode: { type: "string", enum: ["encode", "decode"], description: "Default encode" } }, required: ["text"] },
  },
  {
    name: "convert_units", title: "Unit Converter", description: "Convert values between units of length, mass, volume, area, data size, speed, time and temperature. Examples: kg->lb, mi->km, c->f, gb->mib.",
    endpoint: "/convert",
    inputSchema: { type: "object", properties: { value: { type: "number" }, from: { type: "string" }, to: { type: "string" } }, required: ["value", "from", "to"] },
  },
  { name: "current_time", title: "Current Time", description: "Current time in any IANA timezone, e.g. America/New_York.", endpoint: "/time", inputSchema: { type: "object", properties: { tz: { type: "string", description: "IANA timezone (default UTC)" } } } },
  { name: "unix_timestamp", title: "Unix Timestamp", description: "Current Unix epoch seconds, milliseconds and ISO 8601 time.", endpoint: "/timestamp", inputSchema: { type: "object", properties: {} } },
  {
    name: "random_numbers", title: "Random Numbers", description: "Cryptographically secure random integers or floats in [min, max].",
    endpoint: "/random",
    inputSchema: { type: "object", properties: { min: { type: "number" }, max: { type: "number" }, count: int("How many numbers (1-1000)", 1, 1000), decimals: { type: "boolean", description: "Return floats (default false)" } } },
  },
  {
    name: "roll_dice", title: "Roll Dice", description: "Roll dice with any number of sides.",
    endpoint: "/dice",
    inputSchema: { type: "object", properties: { rolls: int("Number of dice (1-20)", 1, 20), sides: int("Sides per die (2-1000)", 2, 1000) } },
  },
  {
    name: "generate_password", title: "Password Generator", description: "Generate strong random passwords containing upper/lowercase letters, digits and symbols.",
    endpoint: "/password",
    inputSchema: { type: "object", properties: { length: int("Length (8-128)", 8, 128), count: int("How many passwords (1-10)", 1, 10) } },
  },
  { name: "lorem_ipsum", title: "Lorem Ipsum", description: "Generate lorem ipsum placeholder paragraphs.", endpoint: "/lorem", inputSchema: { type: "object", properties: { paragraphs: int("(1-10)", 1, 10) } } },
  { name: "random_emoji", title: "Random Emoji", description: "Random emoji characters with names.", endpoint: "/emoji", inputSchema: { type: "object", properties: { count: int("(1-50)", 1, 50) } } },
  { name: "random_joke", title: "Random Joke", description: "A clean programming joke.", endpoint: "/joke", inputSchema: { type: "object", properties: {} } },
  { name: "random_fact", title: "Random Fact", description: "A fun verified fact.", endpoint: "/fact", inputSchema: { type: "object", properties: {} } },
  { name: "random_quote", title: "Random Quote", description: "An inspirational quote with author.", endpoint: "/quote", inputSchema: { type: "object", properties: {} } },
  {
    name: "public_holidays", title: "Public Holidays", description: "List public holidays for a country and year. Supported countries: US, GB, CA, AU, NZ, IN.",
    endpoint: "/holidays",
    inputSchema: { type: "object", properties: { country: { type: "string", description: "ISO code (default US)" }, year: int("Calendar year (2000-2100)", 2000, 2100) } },
  },
  { name: "fx_rates", title: "FX Rates", description: "Latest foreign exchange rates against a base currency, e.g. USD, EUR, JPY.", endpoint: "/fx", inputSchema: { type: "object", properties: { base: { type: "string", description: "3-letter currency code (default USD)" } } } },
  { name: "request_headers", title: "Request Headers Echo", description: "Echo back all HTTP headers of this MCP request as seen by the server.", endpoint: "/headers", inputSchema: { type: "object", properties: {} } },
  { name: "fetch_json", title: "Fetch JSON", description: "Fetch an https:// URL and return its parsed JSON body. https only, private hosts blocked, 8s timeout, 500KB limit.", endpoint: "/json", inputSchema: { type: "object", properties: { url: { type: "string", description: "The https:// URL to fetch" } }, required: ["url"] } },
];

function jsonRpc(id: unknown, result: unknown): unknown {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: unknown, code: number, message: string): unknown {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function callTool(name: string, args: Record<string, unknown>, req: Request): Promise<{ ok: boolean; body: string }> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, body: `unknown tool '${name}'` };
  const ep = findEndpoint(tool.endpoint);
  if (!ep) return { ok: false, body: "endpoint unavailable" };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(args ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = new URL(`https://mcp.local${tool.endpoint}?${qs.toString()}`);
  try {
    const data = await ep.run({ url, req });
    return { ok: true, body: JSON.stringify({ ok: true, ...(data as Record<string, unknown>) }, null, 2) };
  } catch (err) {
    if (err instanceof ApiError) return { ok: true, body: JSON.stringify({ ok: false, error: err.message }) };
    throw err;
  }
}

export async function handleMcp(req: Request): Promise<Response> {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version, authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method === "GET") {
    return new Response("SSE streaming not supported; use POST", { status: 405, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: cors });
  }

  let message: { id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    message = await req.json();
  } catch {
    return Response.json(jsonRpcError(null, -32700, "parse error"), { headers: cors });
  }
  const { id, method, params } = message;

  // Notifications have no id — acknowledge without body
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      return Response.json(
        jsonRpc(id, {
          protocolVersion: (params?.protocolVersion as string) ?? "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: "freeforagents",
            title: "FreeForAgents",
            version: "1.0.0",
            description: "Free zero-auth utility APIs: UUIDs, hashing, unit conversion, FX rates, holidays, random data, IP lookup, JSON proxy.",
            websiteUrl: "https://freeforagents.dev",
          },
        }),
        { headers: cors }
      );
    case "notifications/initialized":
      return new Response(null, { status: 202, headers: cors });
    case "ping":
      return Response.json(jsonRpc(id, {}), { headers: cors });
    case "tools/list":
      return Response.json(
        jsonRpc(id, {
          tools: TOOLS.map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        }),
        { headers: cors }
      );
    case "tools/call": {
      const name = params?.name as string;
      const args = (params?.arguments ?? {}) as Record<string, unknown>;
      const res = await callTool(name, args, req);
      if (!res.ok) {
        return Response.json(jsonRpcError(id, -32602, res.body), { headers: cors });
      }
      if (isNotification) return new Response(null, { status: 202, headers: cors });
      return Response.json(
        jsonRpc(id, {
          content: [{ type: "text", text: res.body }],
        }),
        { headers: cors }
      );
    }
    default:
      if (isNotification) return new Response(null, { status: 202, headers: cors });
      return Response.json(jsonRpcError(id, -32601, `method not found: ${method}`), { headers: cors });
  }
}

export function mcpManifest(origin: string): string {
  // Simple human/agent-readable manifest linked from llms.txt
  return [
    "# FreeForAgents MCP Server",
    "",
    `Transport: Streamable HTTP`,
    `URL: ${origin}/mcp`,
    "",
    "Stateless JSON-RPC 2.0 endpoint implementing MCP methods:",
    "initialize, ping, tools/list, tools/call.",
    "",
    "## Tools",
    "",
    ...TOOLS.map((t) => `- \`${t.name}\` — ${t.description}`),
    "",
    "## Example (initialize)",
    "",
    "```bash",
    `curl -s ${origin}/mcp -H 'Content-Type: application/json' \\`,
    "  -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-06-18\"}}'",
    "```",
    "",
  ].join("\n");
}
