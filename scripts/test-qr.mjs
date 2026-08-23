#!/usr/bin/env node
// QR round-trip test battery: /qr output -> rasterize SVG -> jsQR decode -> compare.
// Requires `wrangler dev` running on :8788. Usage: node scripts/test-qr.mjs

const BASE = process.env.BASE_URL || "http://localhost:8788";
const ENDPOINTS_EXPECTED = 23;
const { default: jsQR } = await import("jsqr");

let pass = 0;
let fail = 0;

function svgToImage(svg) {
  const dims = /width="(\d+)" height="(\d+)"/.exec(svg);
  if (!dims) throw new Error("no dimensions in svg");
  const w = Number(dims[1]);
  const h = Number(dims[2]);
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  const re = /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="#000000"\/>/g;
  let m;
  let dark = 0;
  while ((m = re.exec(svg))) {
    const x = Number(m[1]), y = Number(m[2]), rw = Number(m[3]), rh = Number(m[4]);
    for (let yy = y; yy < y + rh; yy++) {
      for (let xx = x; xx < x + rw; xx++) {
        const i = (yy * w + xx) * 4;
        rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0;
      }
    }
    dark++;
  }
  if (dark === 0) throw new Error("no dark modules in svg");
  return { rgba, w, h };
}

async function roundtrip(label, text, ec) {
  const url = `${BASE}/qr?text=${encodeURIComponent(text)}&scale=4&margin=4&ec=${ec}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.ok || !json.svg) throw new Error("bad response shape");
    const { rgba, w, h } = svgToImage(json.svg);
    const decoded = jsQR(rgba, w, h);
    if (!decoded) throw new Error(`could not decode (v${json.version}, ${w}x${h})`);
    if (decoded.data !== text) {
      throw new Error(`decoded mismatch:\n  want: ${JSON.stringify(text.slice(0, 80))}\n  got:  ${JSON.stringify(decoded.data.slice(0, 80))}`);
    }
    console.log(`PASS ${label} [${ec}] v${json.version} ${json.modules}x${json.modules} (${json.byte_length}B)`);
    pass++;
  } catch (err) {
    console.error(`FAIL ${label} [${ec}]: ${err.message}`);
    fail++;
  }
}

async function expectError(label, qs, wantStatus) {
  const res = await fetch(`${BASE}/qr?${qs}`);
  const body = await res.json().catch(() => ({}));
  if (res.status === wantStatus && body.ok === false) {
    console.log(`PASS ${label} -> ${res.status} "${body.error}"`);
    pass++;
  } else {
    console.error(`FAIL ${label}: expected ${wantStatus}, got ${res.status} ${JSON.stringify(body).slice(0, 100)}`);
    fail++;
  }
}

console.log("== QR roundtrip battery ==");

for (const ec of ["L", "M", "Q", "H"]) {
  await roundtrip("hello", "Hello, FreeForAgents!", ec);
}
await roundtrip("url", "https://freeforagents.dev/docs/qr?utm=test&x=1#frag", "M");
await roundtrip("unicode", "unicode test ✓ — emoji 🚀 done", "M");
await roundtrip("xml-chars", `<a href="x">&"'"</a>`, "Q");
await roundtrip("300B", "The quick brown fox jumps over the lazy dog. ".repeat(6), "H");
await roundtrip("1200B", "abcdefghij".repeat(120), "M");
await roundtrip("2800B", "z".repeat(2800), "L");

await expectError("too long", `text=${"y".repeat(4001)}`, 400);
await expectError("missing text", "", 400);
await expectError("bad ec", "text=x&ec=X", 400);
await expectError("bad scale", "text=x&scale=999", 400);

console.log("\n== format=svg direct ==");
{
  const res = await fetch(`${BASE}/qr?text=direct-svg-test&format=svg`);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();
  if (ct.includes("image/svg+xml") && body.startsWith("<svg") && res.ok) {
    console.log(`PASS svg content-type + body (${body.length}B)`);
    pass++;
  } else {
    console.error(`FAIL format=svg: ct=${ct} starts=${body.slice(0, 20)}`);
    fail++;
  }
}

console.log("\n== avatar ==");
{
  const a = await fetch(`${BASE}/avatar?seed=determinism-check`).then((r) => r.json());
  const b = await fetch(`${BASE}/avatar?seed=determinism-check`).then((r) => r.json());
  if (a.svg === b.svg && a.svg.includes("<svg")) {
    console.log("PASS deterministic identicon");
    pass++;
  } else {
    console.error("FAIL avatar not deterministic");
    fail++;
  }
  const c = await fetch(`${BASE}/avatar?seed=Ada Lovelace&style=initials`).then((r) => r.json());
  if (c.svg.includes(">AL<")) {
    console.log("PASS initials style renders AL");
    pass++;
  } else {
    console.error("FAIL initials missing: " + c.svg.slice(0, 200));
    fail++;
  }
  const raw = await fetch(`${BASE}/avatar?seed=x&format=svg`);
  if ((raw.headers.get("content-type") || "").includes("image/svg+xml")) {
    console.log("PASS avatar format=svg");
    pass++;
  } else {
    console.error("FAIL avatar format=svg wrong content-type");
    fail++;
  }
}

console.log("\n== dns ==");
{
  try {
    const j = await fetch(`${BASE}/dns?name=cloudflare.com&type=A`).then((r) => r.json());
    if (j.ok && Array.isArray(j.records) && j.records.some((r) => /^\d+\.\d+\.\d+\.\d+$/.test(r.data))) {
      console.log(`PASS A record resolved (${j.records.length} answers)`);
      pass++;
    } else {
      console.error("FAIL dns A: " + JSON.stringify(j).slice(0, 150));
      fail++;
    }
    const bad = await fetch(`${BASE}/dns?name=not-a-real-hostname-xyz123.example`);
    const badBody = await bad.json();
    if ([200, 502].includes(bad.status)) {
      console.log(`PASS nx-domain handled (${bad.status}, nxdomain=${badBody.nxdomain})`);
      pass++;
    } else {
      console.error(`FAIL nxdomain unexpected status ${bad.status}`);
      fail++;
    }
  } catch (err) {
    console.error(`FAIL dns: ${err.message} (network offline?)`);
    fail++;
  }
}

console.log("\n== mcp tools/list count ==");
{
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  const j = await res.json();
  const n = j.result?.tools?.length ?? 0;
  if (n === ENDPOINTS_EXPECTED) {
    console.log(`PASS mcp exposes ${n} tools`);
    pass++;
  } else {
    console.error(`FAIL expected ${ENDPOINTS_EXPECTED} mcp tools, got ${n}`);
    fail++;
  }
}


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
