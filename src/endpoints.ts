import { JOKES, FACTS, QUOTES, EMOJI, LOREM_WORDS } from "./data";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface Param {
  name: string;
  type: "string" | "integer" | "number" | "boolean";
  required: boolean;
  description: string;
}

export interface Ctx {
  url: URL;
  req: Request;
}

export interface EndpointDef {
  name: string;
  path: string;
  summary: string;
  description: string;
  params: Param[];
  example: string;
  exampleResponse: Record<string, unknown>;
  run: (ctx: Ctx) => unknown | Promise<unknown>;
}

// ---------- helpers ----------

function randInt(min: number, max: number): number {
  const range = max - min + 1;
  if (range <= 0) throw new ApiError("max must be greater than or equal to min");
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return min + (buf[0] % range);
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function intParam(url: URL, name: string, def: number, min: number, max: number): number {
  const raw = url.searchParams.get(name);
  if (raw === null) return def;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new ApiError(`'${name}' must be an integer`);
  if (n < min || n > max) throw new ApiError(`'${name}' must be between ${min} and ${max}`);
  return n;
}

function numParam(url: URL, name: string, def: number): number {
  const raw = url.searchParams.get(name);
  if (raw === null) return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new ApiError(`'${name}' must be a number`);
  return n;
}

function strParam(url: URL, name: string, required: boolean, def?: string): string {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") {
    if (required) throw new ApiError(`missing required query parameter '${name}'`);
    return def ?? "";
  }
  return raw;
}

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function ulid(): string {
  let time = Date.now();
  let timePart = "";
  for (let i = 0; i < 10; i++) {
    timePart = ULID_ALPHABET[time % 32] + timePart;
    time = Math.floor(time / 32);
  }
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let randomness = 0n;
  for (const b of bytes) randomness = (randomness << 8n) | BigInt(b);
  let randPart = "";
  for (let i = 0; i < 16; i++) {
    randPart = ULID_ALPHABET[Number(randomness % 32n)] + randPart;
    randomness /= 32n;
  }
  return timePart + randPart;
}

async function hashHex(algo: string, text: string): Promise<string> {
  const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- unit conversion ----------

type UnitTable = Record<string, number>;

const UNIT_CATEGORIES: { category: string; base: string; units: UnitTable }[] = [
  {
    category: "length", base: "m",
    units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852 },
  },
  {
    category: "mass", base: "kg",
    units: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237, st: 6.35029318 },
  },
  {
    category: "volume", base: "l",
    units: { ml: 0.001, l: 1, m3: 1000, tsp: 0.00492892159375, tbsp: 0.01478676478125, floz: 0.0295735295625, cup: 0.2365882365, pt: 0.473176473, qt: 0.946352946, gal: 3.785411784 },
  },
  {
    category: "area", base: "m2",
    units: { m2: 1, km2: 1e6, ha: 10000, ft2: 0.09290304, ac: 4046.8564224, mi2: 2589988.110336 },
  },
  {
    category: "data", base: "b",
    units: { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776 },
  },
  {
    category: "speed", base: "mps",
    units: { mps: 1, kmh: 1 / 3.6, mph: 0.44704, kn: 0.514444, fps: 0.3048 },
  },
  {
    category: "time", base: "s",
    units: { ms: 0.001, s: 1, min: 60, h: 3600, d: 86400, wk: 604800 },
  },
];

const UNIT_ALIASES: Record<string, string> = {
  celsius: "c", fahrenheit: "f", kelvin: "k",
  meter: "m", meters: "m", metre: "m", metres: "m",
  kilometer: "km", kilometers: "km", kilometre: "km", kilometres: "km",
  centimeter: "cm", centimeters: "cm", millimeter: "mm", millimeters: "mm",
  inch: "in", inches: "in", foot: "ft", feet: "ft", yard: "yd", yards: "yd",
  mile: "mi", miles: "mi", milesnautical: "nmi",
  gram: "g", grams: "g", kilogram: "kg", kilograms: "kg", pound: "lb", pounds: "lb", lbs: "lb",
  ounce: "oz", ounces: "oz", stone: "st", tonne: "t", ton: "t", tonnes: "t",
  liter: "l", liters: "l", litre: "l", litres: "l", milliliter: "ml", millilitre: "ml",
  gallon: "gal", gallons: "gal", quart: "qt", quarts: "qt", pint: "pt", pints: "pt",
  byte: "b", bytes: "b", kilobyte: "kb", megabyte: "mb", gigabyte: "gb", terabyte: "tb",
  kibibyte: "kib", mebibyte: "mib", gibibyte: "gib", tebibyte: "tib",
  second: "s", seconds: "s", minute: "min", minutes: "min", hour: "h", hours: "h",
  day: "d", days: "d", week: "wk", weeks: "wk",
};

function normalizeUnit(u: string): string {
  return UNIT_ALIASES[u.toLowerCase().replace(/\s|\./g, "")] ?? u.toLowerCase();
}

function convert(value: number, fromRaw: string, toRaw: string): number {
  const from = normalizeUnit(fromRaw);
  const to = normalizeUnit(toRaw);

  const tempNames = new Set(["c", "f", "k"]);
  if (tempNames.has(from) && tempNames.has(to)) {
    const celsius = from === "c" ? value : from === "f" ? ((value - 32) * 5) / 9 : value - 273.15;
    return to === "c" ? celsius : to === "f" ? (celsius * 9) / 5 + 32 : celsius + 273.15;
  }

  for (const cat of UNIT_CATEGORIES) {
    if (cat.units[from] !== undefined && cat.units[to] !== undefined) {
      return (value * cat.units[from]) / cat.units[to];
    }
  }
  throw new ApiError(
    `unknown or incompatible units '${fromRaw}' and '${toRaw}'. Supported categories: temperature (c/f/k), ` +
      UNIT_CATEGORIES.map((c) => `${c.category} (${Object.keys(c.units).join("/")})`).join(", ")
  );
}

// ---------- holidays ----------

function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month, last.getUTCDate() - offset));
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Holiday { date: string; name: string }

function computeHolidays(country: string, year: number): Holiday[] {
  const easter = easterSunday(year);
  const fixed = (month: number, day: number, name: string): Holiday => ({
    date: fmtDate(new Date(Date.UTC(year, month - 1, day))), name,
  });
  const dated = (d: Date, name: string): Holiday => ({ date: fmtDate(d), name });

  switch (country.toUpperCase()) {
    case "US":
      return [
        fixed(1, 1, "New Year's Day"),
        dated(nthWeekday(year, 0, 1, 3), "Martin Luther King Jr. Day"),
        dated(nthWeekday(year, 1, 1, 3), "Presidents' Day"),
        dated(lastWeekday(year, 4, 1), "Memorial Day"),
        fixed(6, 19, "Juneteenth"),
        fixed(7, 4, "Independence Day"),
        dated(nthWeekday(year, 8, 1, 1), "Labor Day"),
        dated(nthWeekday(year, 9, 1, 2), "Columbus Day"),
        dated(nthWeekday(year, 10, 4, 4), "Thanksgiving Day"),
        fixed(11, 11, "Veterans Day"),
        fixed(12, 25, "Christmas Day"),
      ];
    case "GB":
      return [
        fixed(1, 1, "New Year's Day"),
        dated(addDays(easter, -2), "Good Friday"),
        dated(addDays(easter, 1), "Easter Monday"),
        dated(nthWeekday(year, 4, 1, 1), "Early May Bank Holiday"),
        dated(lastWeekday(year, 4, 1), "Spring Bank Holiday"),
        dated(lastWeekday(year, 7, 1), "Summer Bank Holiday"),
        fixed(12, 25, "Christmas Day"),
        fixed(12, 26, "Boxing Day"),
      ];
    case "CA":
      return [
        fixed(1, 1, "New Year's Day"),
        dated(addDays(easter, -2), "Good Friday"),
        dated(addDays(easter, 1), "Easter Monday"),
        dated(lastWeekday(year, 4, 1), "Victoria Day"),
        fixed(7, 1, "Canada Day"),
        dated(nthWeekday(year, 7, 1, 1), "Civic Holiday"),
        dated(nthWeekday(year, 9, 1, 1), "Labour Day"),
        dated(nthWeekday(year, 9, 1, 2), "Thanksgiving"),
        fixed(11, 11, "Remembrance Day"),
        fixed(12, 25, "Christmas Day"),
        fixed(12, 26, "Boxing Day"),
      ];
    case "AU":
      return [
        fixed(1, 1, "New Year's Day"),
        fixed(1, 26, "Australia Day"),
        dated(addDays(easter, -2), "Good Friday"),
        dated(addDays(easter, 1), "Easter Monday"),
        fixed(4, 25, "Anzac Day"),
        dated(nthWeekday(year, 5, 1, 2), "King's Birthday"),
        dated(nthWeekday(year, 9, 1, 1), "Labour Day"),
        fixed(12, 25, "Christmas Day"),
        fixed(12, 26, "Boxing Day"),
      ];
    case "NZ":
      return [
        fixed(1, 1, "New Year's Day"),
        fixed(1, 2, "Day after New Year's Day"),
        fixed(2, 6, "Waitangi Day"),
        dated(addDays(easter, -2), "Good Friday"),
        dated(addDays(easter, 1), "Easter Monday"),
        fixed(4, 25, "Anzac Day"),
        dated(nthWeekday(year, 5, 1, 1), "King's Birthday"),
        dated(nthWeekday(year, 9, 1, 4), "Labour Day"),
        fixed(12, 25, "Christmas Day"),
        fixed(12, 26, "Boxing Day"),
      ];
    case "IN":
      return [
        fixed(1, 26, "Republic Day"),
        fixed(8, 15, "Independence Day"),
        fixed(10, 2, "Gandhi Jayanti"),
        fixed(12, 25, "Christmas Day"),
      ];
    default:
      throw new ApiError(`unsupported country '${country}'. Supported: US, GB, CA, AU, NZ, IN`);
  }
}

// ---------- fx rates ----------

interface FxUpstream {
  result: string;
  base_code: string;
  time_last_update_utc: string;
  rates: Record<string, number>;
}

async function fetchUsdRates(req: Request): Promise<FxUpstream> {
  const cacheKey = "https://fx.freeforagents.internal/usd";
  const cache = caches.default;
  let res = await cache.match(cacheKey);
  if (!res) {
    const upstream = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new ApiError("upstream FX provider unavailable, try again shortly", 503);
    res = upstream;
    await cache.put(cacheKey, res.clone());
  }
  const data = (await res.json()) as FxUpstream;
  if (data.result !== "success") throw new ApiError("upstream FX provider error", 502);
  return data;
}

// ---------- json proxy ----------

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i, /\.local$/i, /\.internal$/i,
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^\[?::1\]?$/, /^\[?fc00:/i, /^\[?fd/i, /^0\./,
];

async function proxyJson(ctx: Ctx): Promise<unknown> {
  const target = strParam(ctx.url, "url", true);
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw new ApiError("'url' must be a valid absolute URL");
  }
  if (parsed.protocol !== "https:") throw new ApiError("only https:// URLs are allowed");
  if (PRIVATE_HOST_PATTERNS.some((p) => p.test(parsed.hostname))) {
    throw new ApiError("private/internal hosts are not allowed");
  }
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      headers: { accept: "application/json", "user-agent": "freeforagents/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError("failed to fetch target URL (timeout or network error)", 502);
  }
  if (!res.ok) throw new ApiError(`target returned HTTP ${res.status}`, 502);
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (text.length > 500_000) throw new ApiError("response exceeds 500 KB limit", 413);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(`target did not return valid JSON (content-type: ${contentType || "none"})`, 415);
  }
  return { source_url: parsed.toString(), content_type: contentType, data };
}

// ---------- endpoint definitions ----------

export const ENDPOINTS: EndpointDef[] = [
  {
    name: "ip",
    path: "/ip",
    summary: "Look up your IP address and geolocation.",
    description:
      "Returns the caller's public IP address and geolocation data (country, city, region, coordinates, timezone, ASN) derived from Cloudflare's edge network. No parameters required — call it from any client and it inspects the incoming request.",
    params: [],
    example: "/ip",
    exampleResponse: {
      ok: true, ip: "203.0.113.42", country: "US", city: "San Francisco",
      region: "California", postal_code: "94102", latitude: 37.7749, longitude: -122.4194,
      timezone: "America/Los_Angeles", asn: 7922, as_organization: "Comcast Cable",
    },
    run: ({ req }) => {
      const cf = (req as unknown as { cf?: Record<string, unknown> }).cf ?? {};
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
      return {
        ip,
        country: cf.country ?? null,
        city: cf.city ?? null,
        region: cf.region ?? null,
        postal_code: cf.postalCode ?? null,
        latitude: cf.latitude ?? null,
        longitude: cf.longitude ?? null,
        timezone: cf.timezone ?? null,
        asn: cf.asn ?? null,
        as_organization: cf.asOrganization ?? null,
      };
    },
  },
  {
    name: "uuid",
    path: "/uuid",
    summary: "Generate RFC 4122 version 4 UUIDs.",
    description: "Generates cryptographically random UUIDs (version 4) using the Web Crypto API.",
    params: [{ name: "count", type: "integer", required: false, description: "How many UUIDs to generate (default 1, max 100)." }],
    example: "/uuid?count=2",
    exampleResponse: { ok: true, count: 2, uuids: ["3f2504e0-4f89-41d3-9a0c-0305e82c3301", "9b2f1c3e-8a4d-4c2a-b6f0-1d2e3f4a5b6c"] },
    run: ({ url }) => {
      const count = intParam(url, "count", 1, 1, 100);
      const uuids = Array.from({ length: count }, () => crypto.randomUUID());
      return { count, uuids };
    },
  },
  {
    name: "ulid",
    path: "/ulid",
    summary: "Generate ULIDs (sortable unique identifiers).",
    description:
      "Generates ULIDs per the ulid spec: a 48-bit timestamp prefix followed by 80 bits of randomness, encoded in Crockford Base32. ULIDs sort lexicographically by creation time, making them ideal for database keys.",
    params: [{ name: "count", type: "integer", required: false, description: "How many ULIDs to generate (default 1, max 100)." }],
    example: "/ulid",
    exampleResponse: { ok: true, count: 1, ulids: ["01JF8ZK3P2QWERTY5MNBHY6VCX"] },
    run: ({ url }) => {
      const count = intParam(url, "count", 1, 1, 100);
      return { count, ulids: Array.from({ length: count }, ulid) };
    },
  },
  {
    name: "hash",
    path: "/hash",
    summary: "Hash text with SHA-1/256/384/512.",
    description: "Computes the hex digest of the given text using Web Crypto SHA algorithms. MD5 is intentionally not supported (insecure and unavailable in Web Crypto).",
    params: [
      { name: "text", type: "string", required: true, description: "The text to hash." },
      { name: "algo", type: "string", required: false, description: "One of sha-1, sha-256, sha-384, sha-512 (default sha-256)." },
    ],
    example: "/hash?text=hello&algo=sha-256",
    exampleResponse: { ok: true, algo: "sha-256", text: "hello", digest: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" },
    run: async ({ url }) => {
      const text = strParam(url, "text", true);
      const algoRaw = strParam(url, "algo", false, "sha-256").toLowerCase();
      const allowed = ["sha-1", "sha-256", "sha-384", "sha-512"];
      if (!allowed.includes(algoRaw)) throw new ApiError(`'algo' must be one of: ${allowed.join(", ")}`);
      const digest = await hashHex(algoRaw, text);
      return { algo: algoRaw, text, digest };
    },
  },
  {
    name: "base64",
    path: "/base64",
    summary: "Encode or decode Base64 strings.",
    description: "Encodes text to Base64, or decodes Base64 back to UTF-8 text.",
    params: [
      { name: "text", type: "string", required: true, description: "The input text." },
      { name: "mode", type: "string", required: false, description: "'encode' (default) or 'decode'." },
    ],
    example: "/base64?text=hello+world",
    exampleResponse: { ok: true, mode: "encode", input: "hello world", result: "aGVsbG8gd29ybGQ=" },
    run: ({ url }) => {
      const text = strParam(url, "text", true);
      const mode = strParam(url, "mode", false, "encode").toLowerCase();
      if (mode === "encode") {
        const bytes = new TextEncoder().encode(text);
        let bin = "";
        for (const b of bytes) bin += String.fromCharCode(b);
        return { mode, input: text, result: btoa(bin) };
      }
      if (mode === "decode") {
        try {
          const bin = atob(text.replace(/\s/g, ""));
          const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
          return { mode, input: text, result: new TextDecoder().decode(bytes) };
        } catch {
          throw new ApiError("'text' is not valid Base64");
        }
      }
      throw new ApiError("'mode' must be 'encode' or 'decode'");
    },
  },
  {
    name: "convert",
    path: "/convert",
    summary: "Convert between units (length, mass, volume, area, data, speed, time, temperature).",
    description:
      "General-purpose unit conversion. Units are resolved across categories with common aliases accepted (e.g. 'kilometers', 'km', 'kilometres' all work). Temperature converts between c, f and k.",
    params: [
      { name: "value", type: "number", required: true, description: "The numeric value to convert." },
      { name: "from", type: "string", required: true, description: "Source unit (e.g. kg, mi, c)." },
      { name: "to", type: "string", required: true, description: "Target unit (e.g. lb, km, f)." },
    ],
    example: "/convert?value=10&from=kg&to=lb",
    exampleResponse: { ok: true, value: 10, from: "kg", to: "lb", result: 22.046226218487758 },
    run: ({ url }) => {
      const value = numParam(url, "value", NaN);
      if (!Number.isFinite(value)) throw new ApiError("missing required query parameter 'value'");
      const from = strParam(url, "from", true);
      const to = strParam(url, "to", true);
      const result = convert(value, from, to);
      return { value, from: normalizeUnit(from), to: normalizeUnit(to), result };
    },
  },
  {
    name: "time",
    path: "/time",
    summary: "Current time in any timezone.",
    description: "Returns the current UTC epoch timestamps plus fully-parsed local time components for the requested IANA timezone.",
    params: [{ name: "tz", type: "string", required: false, description: "IANA timezone name (default 'UTC'), e.g. America/New_York." }],
    example: "/time?tz=Asia/Tokyo",
    exampleResponse: {
      ok: true, utc_epoch_seconds: 1755892800, utc_iso: "2026-08-22T18:40:00.000Z", timezone: "Asia/Tokyo",
      local: { year: 2026, month: 8, day: 23, hour: 3, minute: 40, second: 0, weekday: "Sunday", date: "2026-08-23", time: "03:40:00" }, utc_offset: "GMT+9",
    },
    run: ({ url }) => {
      const tz = strParam(url, "tz", false, "UTC");
      const now = new Date();
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
      } catch {
        throw new ApiError(`'${tz}' is not a valid IANA timezone`);
      }
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric", hour12: false, weekday: "long",
      }).formatToParts(now);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      const offsetParts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(now);
      const utc_offset = offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "";
      const pad = (n: string) => n.padStart(2, "0");
      return {
        utc_epoch_seconds: Math.floor(now.getTime() / 1000),
        utc_iso: now.toISOString(),
        timezone: tz,
        local: {
          year: Number(get("year")), month: Number(get("month")), day: Number(get("day")),
          hour: Number(get("hour") === "24" ? "0" : get("hour")), minute: Number(get("minute")), second: Number(get("second")),
          weekday: get("weekday"), date: `${get("year")}-${pad(get("month"))}-${pad(get("day"))}`,
          time: `${pad(get("hour") === "24" ? "0" : get("hour"))}:${pad(get("minute"))}:${pad(get("second"))}`,
        },
        utc_offset,
      };
    },
  },
  {
    name: "timestamp",
    path: "/timestamp",
    summary: "Current Unix timestamp.",
    description: "Returns the current time as Unix epoch seconds, milliseconds and ISO 8601. Useful for clock sanity checks in scripts and agents.",
    params: [],
    example: "/timestamp",
    exampleResponse: { ok: true, epoch_seconds: 1755892800, epoch_millis: 1755892800123, iso_8601: "2026-08-22T18:40:00.123Z" },
    run: () => {
      const now = new Date();
      return {
        epoch_seconds: Math.floor(now.getTime() / 1000),
        epoch_millis: now.getTime(),
        iso_8601: now.toISOString(),
      };
    },
  },
  {
    name: "random",
    path: "/random",
    summary: "Cryptographically secure random integers.",
    description: "Generates random integers between min and max (inclusive) using a CSPRNG. Set decimals=true for random floats in [min, max).",
    params: [
      { name: "min", type: "number", required: false, description: "Lower bound inclusive (default 0)." },
      { name: "max", type: "number", required: false, description: "Upper bound inclusive (default 100)." },
      { name: "count", type: "integer", required: false, description: "How many numbers (default 1, max 1000)." },
      { name: "decimals", type: "boolean", required: false, description: "Return floats instead of integers (default false)." },
    ],
    example: "/random?min=1&max=6&count=2",
    exampleResponse: { ok: true, min: 1, max: 6, count: 2, values: [4, 1] },
    run: ({ url }) => {
      const min = numParam(url, "min", 0);
      const max = numParam(url, "max", 100);
      const count = intParam(url, "count", 1, 1, 1000);
      const decimals = ["true", "1", "yes"].includes((url.searchParams.get("decimals") ?? "").toLowerCase());
      if (max < min) throw new ApiError("'max' must be >= 'min'");
      const values = Array.from({ length: count }, () =>
        decimals ? min + crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * (max - min) : randInt(Math.ceil(min), Math.floor(max))
      );
      return { min, max, count, values };
    },
  },
  {
    name: "dice",
    path: "/dice",
    summary: "Roll dice.",
    description: "Simulates dice rolls with any number of sides. Perfect for games, decisions and settling arguments fairly.",
    params: [
      { name: "rolls", type: "integer", required: false, description: "Number of dice to roll (default 1, max 20)." },
      { name: "sides", type: "integer", required: false, description: "Sides per die (default 6, max 1000)." },
    ],
    example: "/dice?rolls=2&sides=20",
    exampleResponse: { ok: true, rolls: [17, 3], sides: 20, total: 20, count: 2 },
    run: ({ url }) => {
      const count = intParam(url, "rolls", 1, 1, 20);
      const sides = intParam(url, "sides", 6, 2, 1000);
      const rolls = Array.from({ length: count }, () => randInt(1, sides));
      return { rolls, sides, total: rolls.reduce((a, b) => a + b, 0), count };
    },
  },
  {
    name: "password",
    path: "/password",
    summary: "Generate strong random passwords.",
    description:
      "Generates passwords drawn from upper/lowercase letters, digits and symbols, guaranteed to include at least one of each character class.",
    params: [
      { name: "length", type: "integer", required: false, description: "Password length (default 16, max 128)." },
      { name: "count", type: "integer", required: false, description: "How many passwords (default 1, max 10)." },
    ],
    example: "/password?length=20",
    exampleResponse: { ok: true, length: 16, passwords: ["K#9mVx2!pLq8@wZ4"] },
    run: ({ url }) => {
      const length = intParam(url, "length", 16, 8, 128);
      const count = intParam(url, "count", 1, 1, 10);
      const classes = [
        "ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz",
        "23456789", "!@#$%^&*()-_=+[]{}<>?",
      ];
      const all = classes.join("");
      const gen = (): string => {
        const chars: string[] = classes.map((set) => set[randInt(0, set.length - 1)]);
        while (chars.length < length) chars.push(all[randInt(0, all.length - 1)]);
        for (let i = chars.length - 1; i > 0; i--) {
          const j = randInt(0, i);
          [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        return chars.join("");
      };
      return { length, passwords: Array.from({ length: count }, gen) };
    },
  },
  {
    name: "lorem",
    path: "/lorem",
    summary: "Lorem ipsum placeholder text.",
    description: "Generates lorem ipsum style paragraphs built from a classic word bank. Deterministically starts with 'Lorem ipsum dolor sit amet'.",
    params: [{ name: "paragraphs", type: "integer", required: false, description: "Number of paragraphs (default 1, max 10)." }],
    example: "/lorem?paragraphs=2",
    exampleResponse: { ok: true, paragraphs: ["Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor."] },
    run: ({ url }) => {
      const paragraphs = intParam(url, "paragraphs", 1, 1, 10);
      const sentence = (): string => {
        const words = Array.from({ length: 6 + randInt(0, 8) }, () => pick(LOREM_WORDS));
        const s = words.join(" ");
        return s.charAt(0).toUpperCase() + s.slice(1) + ".";
      };
      const out = Array.from({ length: paragraphs }, (_, i) => {
        const body = Array.from({ length: 3 + randInt(0, 3) }, sentence).join(" ");
        if (i === 0) {
          return "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " + body;
        }
        const s = body.charAt(0).toUpperCase() + body.slice(1);
        return s;
      });
      return { paragraphs: out };
    },
  },
  {
    name: "emoji",
    path: "/emoji",
    summary: "Random emoji.",
    description: "Returns random emoji characters with their names from a curated library of 100+.",
    params: [{ name: "count", type: "integer", required: false, description: "How many emoji (default 5, max 50)." }],
    example: "/emoji?count=3",
    exampleResponse: { ok: true, emoji: [{ char: "🚀", name: "rocket" }] },
    run: ({ url }) => {
      const count = intParam(url, "count", 5, 1, 50);
      const chosen = Array.from({ length: count }, () => pick(EMOJI));
      return { emoji: chosen };
    },
  },
  {
    name: "joke",
    path: "/joke",
    summary: "Random clean programming joke.",
    description: "Returns a random joke from a hand-curated list of clean, work-safe jokes with a tech/programming flavour.",
    params: [],
    example: "/joke",
    exampleResponse: { ok: true, id: 3, joke: "A SQL query walks into a bar, approaches two tables and asks: may I join you?" },
    run: () => ({ id: randInt(0, JOKES.length - 1), joke: pick(JOKES) }),
  },
  {
    name: "fact",
    path: "/fact",
    summary: "Random fun fact.",
    description: "Returns a random verified fun fact — great conversation starters and test payloads.",
    params: [],
    example: "/fact",
    exampleResponse: { ok: true, id: 1, fact: "Octopuses have three hearts and blue blood." },
    run: () => ({ id: randInt(0, FACTS.length - 1), fact: pick(FACTS) }),
  },
  {
    name: "quote",
    path: "/quote",
    summary: "Random inspirational quote.",
    description: "Returns a random quote with author attribution from a curated public list.",
    params: [],
    example: "/quote",
    exampleResponse: { ok: true, id: 0, quote: { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" } },
    run: () => ({ id: randInt(0, QUOTES.length - 1), quote: pick(QUOTES) }),
  },
  {
    name: "holidays",
    path: "/holidays",
    summary: "Public holidays by country and year.",
    description:
      "Lists public holidays for the requested country and year. Dates are computed locally (including Easter-based holidays via the anonymous Gregorian algorithm). Supported countries: US, GB, CA, AU, NZ, IN. Years supported: 2000–2100.",
    params: [
      { name: "country", type: "string", required: false, description: "ISO country code (default US)." },
      { name: "year", type: "integer", required: false, description: "Calendar year (default current year)." },
    ],
    example: "/holidays?country=GB&year=2026",
    exampleResponse: { ok: true, country: "IN", year: 2026, holidays: [{ date: "2026-01-26", name: "Republic Day" }] },
    run: ({ url }) => {
      const country = strParam(url, "country", false, "US");
      const year = intParam(url, "year", new Date().getUTCFullYear(), 2000, 2100);
      const holidays = computeHolidays(country, year).sort((a, b) => a.date.localeCompare(b.date));
      return { country: country.toUpperCase(), year, holidays };
    },
  },
  {
    name: "fx",
    path: "/fx",
    summary: "Foreign exchange rates (daily, no key).",
    description:
      "Returns latest FX exchange rates against the requested base currency, sourced from open.er-api.com and cached at the edge for 1 hour. Cross rates are computed for non-USD bases.",
    params: [{ name: "base", type: "string", required: false, description: "Base currency code (default USD), e.g. EUR, GBP, JPY." }],
    example: "/fx?base=EUR",
    exampleResponse: { ok: true, base: "USD", last_update_utc: "Sat, 22 Aug 2026 00:00:01 +0000", rates: { EUR: 0.92, GBP: 0.79, JPY: 149.5 } },
    run: async ({ url, req }) => {
      const base = strParam(url, "base", false, "USD").toUpperCase();
      if (!/^[A-Z]{3}$/.test(base)) throw new ApiError("'base' must be a 3-letter currency code");
      const usd = await fetchUsdRates(req);
      if (!usd.rates[base]) throw new ApiError(`unknown currency code '${base}'`);
      const factor = usd.rates[base];
      const rates: Record<string, number> = {};
      for (const [code, rate] of Object.entries(usd.rates)) {
        rates[code] = rate / factor;
      }
      return { base, last_update_utc: usd.time_last_update_utc, rates };
    },
  },
  {
    name: "headers",
    path: "/headers",
    summary: "Echo your request headers.",
    description:
      "Returns all request headers as seen by the server. Invaluable for debugging proxies, webhooks, API gateways and agent user-agents.",
    params: [],
    example: "/headers",
    exampleResponse: { ok: true, headers: { "user-agent": "curl/8.7.1", accept: "*/*" } },
    run: ({ req }) => {
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        headers[k] = v;
      });
      return { headers };
    },
  },
  {
    name: "json",
    path: "/json",
    summary: "Fetch any URL and get parsed JSON back.",
    description:
      "A minimal JSON proxy: fetches an https:// URL and returns its parsed JSON body under 'data'. Safety limits: https only, private/internal hosts blocked, 8s timeout, 500 KB max response.",
    params: [{ name: "url", type: "string", required: true, description: "The https:// URL to fetch. Must return JSON." }],
    example: "/json?url=https%3A%2F%2Fapi.github.com%2Fzen",
    exampleResponse: { ok: true, source_url: "https://api.github.com/zen", content_type: "application/json; charset=utf-8", data: {} },
    run: proxyJson,
  },
];

export function findEndpoint(pathname: string): EndpointDef | undefined {
  const normalized = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return ENDPOINTS.find((e) => e.path === normalized);
}
