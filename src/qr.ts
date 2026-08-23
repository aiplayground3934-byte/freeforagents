// Minimal QR Code encoder (ISO/IEC 18004), byte mode only.
// Supports versions 1-40 and all four error-correction levels.
// Produces an SVG string. Mask selection uses the standard penalty score.
//
// Structure and lookup tables transcribed from Project Nayuki's
// QR-Code-generator library (MIT License, https://www.nayuki.io/page/qr-code-generator-library).

import { ApiError } from "./endpoints";

export type Ecc = "L" | "M" | "Q" | "H";

const ECC_ORDER: Record<Ecc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Total data+ecc codewords per version (1..40)
const TOTAL_CODEWORDS = [
  26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
  404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
  1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185,
  2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3707,
];

// ECC codewords per block, indexed [eccLevelOrder][version-1]
const ECC_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

// Number of error correction blocks, indexed [eccLevelOrder][version-1]
const NUM_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

// Alignment pattern center coordinates per version (empty for v1)
const ALIGNMENT: number[][] = [
  [],
  [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
  [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
  [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

// ---------- GF(256) / Reed-Solomon ----------

function gfMul(a: number, b: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = ((z << 1) ^ ((z >>> 7) * 0x11d)) & 0xff;
    z ^= ((b >>> i) & 1) * a;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

// ---------- bit helpers ----------

class BitBuffer {
  bits: number[] = [];
  append(value: number, len: number): void {
    for (let i = len - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
}

// ---------- encoding ----------

interface Grid {
  size: number;
  modules: boolean[][];
  isFunction: boolean[][];
  set(x: number, y: number, dark: boolean): void;
}

function makeGrid(size: number): Grid {
  const modules: boolean[][] = [];
  const isFunction: boolean[][] = [];
  for (let i = 0; i < size; i++) {
    modules.push(new Array(size).fill(false));
    isFunction.push(new Array(size).fill(false));
  }
  return {
    size,
    modules,
    isFunction,
    set(x: number, y: number, dark: boolean): void {
      modules[y][x] = dark;
      isFunction[y][x] = true;
    },
  };
}

function drawFunctionPatterns(g: Grid, version: number, ecl: Ecc, mask: number): void {
  const size = g.size;
  for (let i = 0; i < size; i++) {
    g.set(6, i, i % 2 === 0);
    g.set(i, 6, i % 2 === 0);
  }
  const drawFinder = (cx: number, cy: number): void => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) g.set(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  const pos = ALIGNMENT[version - 1];
  const last = pos.length - 1;
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      const cx = pos[j], cy = pos[i];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          g.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // format info (two copies) + dark module
  const data = ECC_FORMAT_BITS[ecl] << 3 | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fbits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number): boolean => ((fbits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) g.set(8, i, bit(i));
  g.set(8, 7, bit(6));
  g.set(8, 8, bit(7));
  g.set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) g.set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) g.set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) g.set(8, size - 15 + i, bit(i));
  g.set(8, size - 8, true);

  // version info (v7+)
  if (version >= 7) {
    let vrem = version;
    for (let i = 0; i < 12; i++) vrem = (vrem << 1) ^ ((vrem >>> 11) * 0x1f25);
    const vbits = (version << 12) | vrem;
    for (let i = 0; i < 18; i++) {
      const dark = ((vbits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      g.set(a, b, dark);
      g.set(b, a, dark);
    }
  }
}

function drawCodewords(g: Grid, data: number[]): void {
  const size = g.size;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!g.isFunction[y][x] && i < data.length * 8) {
          g.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

const MASK_FORMULAS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x, _y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(g: Grid, mask: number): void {
  const size = g.size;
  const fn = MASK_FORMULAS[mask];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!g.isFunction[y][x]) g.modules[y][x] = g.modules[y][x] !== fn(x, y);
    }
  }
}

function penaltyScore(g: Grid): number {
  const size = g.size;
  const m = g.modules;
  let result = 0;

  const linePenalty = (get: (i: number) => boolean): void => {
    let runColor = false;
    let runLen = 0;
    for (let i = 0; i < size; i++) {
      if (get(i) === runColor) {
        runLen++;
        if (runLen === 5) result += 3;
        else if (runLen > 5) result += 1;
      } else {
        runColor = get(i);
        runLen = 1;
      }
    }
  };
  for (let y = 0; y < size; y++) linePenalty((i) => m[y][i]);
  for (let x = 0; x < size; x++) linePenalty((i) => m[i][x]);

  // N2: 2x2 blocks
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += 3;
    }
  }

  // N3: finder-like patterns (1,0,1,1,1,0,1 with 4 light on either side)
  const patA = [true, false, true, true, true, false, true, false, false, false, false];
  const patB = [false, false, false, false, true, false, true, true, true, false, true];
  const windowMatch = (get: (i: number) => boolean, pat: boolean[]): boolean => {
    for (let i = 0; i < pat.length; i++) if (get(i) !== pat[i]) return false;
    return true;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x <= size - 11; x++) {
      if (windowMatch((i) => m[y][x + i], patA) || windowMatch((i) => m[y][x + i], patB)) result += 40;
    }
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y <= size - 11; y++) {
      if (windowMatch((i) => m[y + i][x], patA) || windowMatch((i) => m[y + i][x], patB)) result += 40;
    }
  }

  // N4: dark/light balance
  let darkCount = 0;
  for (const row of m) for (const c of row) if (c) darkCount++;
  const total = size * size;
  const k = Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1;
  result += k * 10;
  return result;
}

function buildCodewords(dataBytes: Uint8Array, version: number, ecl: Ecc): number[] {
  const order = ECC_ORDER[ecl];
  const numBlocks = NUM_BLOCKS[order][version];
  const blockEccLen = ECC_PER_BLOCK[order][version];
  const rawCodewords = TOTAL_CODEWORDS[version - 1];
  const dataCapBits = (rawCodewords - blockEccLen * numBlocks) * 8;

  const bb = new BitBuffer();
  bb.append(0x4, 4);
  bb.append(dataBytes.length, version < 10 ? 8 : 16);
  for (const b of dataBytes) bb.append(b, 8);

  const capacityUsed = bb.bits.length;
  if (capacityUsed > dataCapBits) throw new Error("overflow");
  bb.append(0, Math.min(4, dataCapBits - capacityUsed));
  while (bb.bits.length % 8 !== 0) bb.bits.push(0);
  const dataLen = (rawCodewords - blockEccLen * numBlocks);
  for (let pad = 0xec; bb.bits.length < dataLen * 8; pad ^= 0xec ^ 0x11) bb.append(pad, 8);

  const data: number[] = [];
  for (let i = 0; i < bb.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bb.bits[i + j];
    data.push(byte);
  }

  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const divisor = rsDivisor(blockEccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    const padded = dat.slice();
    if (i < numShortBlocks) padded.push(0);
    blocks.push(padded.concat(ecc));
  }

  const interleaved: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < numBlocks; j++) {
      // Skip the padding byte placeholder in short blocks
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) interleaved.push(blocks[j][i]);
    }
  }
  return interleaved;
}

export interface QrResult {
  svg: string;
  version: number;
  modules: number;
  ec: Ecc;
  byte_length: number;
}

export function qrSvg(
  text: string,
  opts: { ec?: Ecc; scale?: number; margin?: number; dark?: string; light?: string } = {}
): QrResult {
  const ecl: Ecc = opts.ec ?? "M";
  const scale = opts.scale ?? 8;
  const margin = opts.margin ?? 4;
  const dark = opts.dark ?? "#000000";
  const light = opts.light ?? "#ffffff";
  if (!/^#[0-9a-fA-F]{6}$/.test(dark) || !/^#[0-9a-fA-F]{6}$/.test(light)) {
    throw new ApiError("'dark' and 'light' must be hex colors like #000000");
  }

  const dataBytes = new TextEncoder().encode(text);
  if (dataBytes.length === 0) throw new ApiError("'text' must not be empty");
  if (dataBytes.length > 2953) throw new ApiError("'text' too long for a QR code (max 2953 bytes)");

  const order = ECC_ORDER[ecl];
  let version = -1;
  for (let v = 1; v <= 40; v++) {
    const cap = (TOTAL_CODEWORDS[v - 1] - ECC_PER_BLOCK[order][v] * NUM_BLOCKS[order][v]) * 8;
    if (4 + (v < 10 ? 8 : 16) + dataBytes.length * 8 <= cap) {
      version = v;
      break;
    }
  }
  if (version === -1) throw new ApiError("'text' too long for a QR code (max 2953 bytes)");

  const finalData = buildCodewords(dataBytes, version, ecl);
  const size = version * 4 + 17;

  let bestPenalty = Infinity;
  let bestMask = 0;
  for (let mask = 0; mask < 8; mask++) {
    const g = makeGrid(size);
    drawFunctionPatterns(g, version, ecl, mask);
    drawCodewords(g, finalData);
    applyMask(g, mask);
    const score = penaltyScore(g);
    if (score <= bestPenalty) {
      bestPenalty = score;
      bestMask = mask;
    }
  }
  const winner = makeGrid(size);
  drawFunctionPatterns(winner, version, ecl, bestMask);
  drawCodewords(winner, finalData);
  applyMask(winner, bestMask);

  const dim = (size + margin * 2) * scale;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">`
  );
  parts.push(`<rect x="0" y="0" width="${dim}" height="${dim}" fill="${light}"/>`);
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (winner.modules[y][x]) {
        let run = 1;
        while (x + run < size && winner.modules[y][x + run]) run++;
        const px = (x + margin) * scale;
        const py = (y + margin) * scale;
        parts.push(`<rect x="${px}" y="${py}" width="${run * scale}" height="${scale}" fill="${dark}"/>`);
        x += run;
      } else {
        x++;
      }
    }
  }
  parts.push("</svg>");
  return { svg: parts.join(""), version, modules: size, ec: ecl, byte_length: dataBytes.length };
}
