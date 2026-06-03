// lib/qr.ts
// ─────────────────────────────────────────────────────────────────────────────
// Minimal, dependency-free QR Code generator → inline SVG string.
// Byte mode, ECC level M, auto version (1..10). Good for URLs.
// Server-only. Used to embed a scannable verify-URL QR in the passport HTML.
// ─────────────────────────────────────────────────────────────────────────────

// ---- Galois field tables for Reed-Solomon ----
const EXP = new Array<number>(512).fill(0);
const LOG = new Array<number>(256).fill(0);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}
function rsGenPoly(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const g2 = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      g2[j] ^= gfMul(g[j], 1);
      g2[j + 1] ^= gfMul(g[j], EXP[i]);
    }
    g = g2;
  }
  return g;
}
function rsEncode(data: number[], n: number): number[] {
  const gen = rsGenPoly(n);
  const res = data.concat(new Array<number>(n).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) for (let j = 0; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], coef);
  }
  return res.slice(data.length);
}

// Version capacity tables (byte mode) for ECC level M, versions 1..10
// [version]: { totalCodewords, ecPerBlock, blocks: [ [numBlocks, dataCwPerBlock], ... ] }
const ECC_M: Record<number, { ec: number; blocks: [number, number][] }> = {
  1: { ec: 10, blocks: [[1, 16]] },
  2: { ec: 16, blocks: [[1, 28]] },
  3: { ec: 26, blocks: [[1, 44]] },
  4: { ec: 18, blocks: [[2, 32]] },
  5: { ec: 24, blocks: [[2, 43]] },
  6: { ec: 16, blocks: [[4, 27]] },
  7: { ec: 18, blocks: [[4, 31]] },
  8: { ec: 22, blocks: [[2, 38], [2, 39]] },
  9: { ec: 22, blocks: [[3, 36], [2, 37]] },
  10: { ec: 26, blocks: [[4, 43], [1, 44]] },
};

const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

function sizeOf(v: number) { return 4 * v + 17; }

function bchFormat(fmt: number): number {
  let code = fmt << 10;
  const g = 0b10100110111;
  for (let i = 4; i >= 0; i--) if (code & (1 << (i + 10))) code ^= g << i;
  return ((fmt << 10) | code) ^ 0b101010000010010;
}

function chooseVersion(dataLen: number): number {
  for (let v = 1; v <= 10; v++) {
    const dataCw = ECC_M[v].blocks.reduce((s, [nb, dc]) => s + nb * dc, 0);
    const countBits = v < 10 ? 8 : 16;
    const cap = dataCw * 8 - 4 - countBits;
    if (dataLen * 8 <= cap) return v;
  }
  throw new Error('QR data too long (max version 10 / ECC M)');
}

type Mat = (number | null)[][];

function buildMatrix(version: number, finalBits: number[]): { mat: Mat; size: number; reserved: boolean[][] } {
  const size = sizeOf(version);
  const mat: Mat = Array.from({ length: size }, () => new Array<number | null>(size).fill(null));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  const placeFinder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const onBorder = (dr === 0 || dr === 6) && dc >= 0 && dc <= 6;
      const onSide = (dc === 0 || dc === 6) && dr >= 0 && dr <= 6;
      const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      mat[rr][cc] = (onBorder || onSide || inner) ? 1 : 0;
      reserved[rr][cc] = true;
    }
  };
  placeFinder(0, 0); placeFinder(0, size - 7); placeFinder(size - 7, 0);

  // timing
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    if (mat[6][i] === null) { mat[6][i] = bit; reserved[6][i] = true; }
    if (mat[i][6] === null) { mat[i][6] = bit; reserved[i][6] = true; }
  }
  // alignment
  for (const r of ALIGN[version]) for (const c of ALIGN[version]) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const ring = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
      mat[r + dr][c + dc] = ring ? 1 : 0;
      reserved[r + dr][c + dc] = true;
    }
  }
  // reserve format areas + dark module
  for (let i = 0; i <= 8; i++) {
    if (mat[8][i] === null) reserved[8][i] = true;
    if (mat[i][8] === null) reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }
  mat[size - 8][8] = 1; reserved[size - 8][8] = true;

  // place data (zig-zag)
  let idx = 0; let col = size - 1; let upward = true;
  while (col > 0) {
    if (col === 6) col--;
    const rows = upward ? range(size - 1, -1, -1) : range(0, size, 1);
    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (mat[row][c] === null && !reserved[row][c]) {
          mat[row][c] = idx < finalBits.length ? finalBits[idx] : 0;
          idx++;
        }
      }
    }
    col -= 2; upward = !upward;
  }
  return { mat, size, reserved };
}

function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  if (step > 0) for (let i = start; i < end; i += step) out.push(i);
  else for (let i = start; i > end; i += step) out.push(i);
  return out;
}

function applyMask(mat: Mat, reserved: boolean[][], size: number, mask: number): Mat {
  const m: Mat = mat.map(row => row.slice());
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (reserved[r][c] || m[r][c] === null) continue;
    let flip = false;
    switch (mask) {
      case 0: flip = (r + c) % 2 === 0; break;
      case 1: flip = r % 2 === 0; break;
      case 2: flip = c % 3 === 0; break;
      case 3: flip = (r + c) % 3 === 0; break;
      case 4: flip = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
      case 5: flip = ((r * c) % 2) + ((r * c) % 3) === 0; break;
      case 6: flip = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break;
      case 7: flip = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; break;
    }
    if (flip) m[r][c] = (m[r][c] as number) ^ 1;
  }
  return m;
}

function placeFormat(m: Mat, size: number, mask: number) {
  const fmt = (0b00 << 3) | mask; // ECC level M = 0b00
  const bits = bchFormat(fmt);
  const seq: number[] = [];
  for (let i = 0; i < 15; i++) seq.push((bits >> (14 - i)) & 1);
  const c1: [number, number][] = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  c1.forEach(([r, c], i) => { m[r][c] = seq[i]; });
  const c2: [number, number][] = [
    [size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],
    [8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1],
  ];
  c2.forEach(([r, c], i) => { m[r][c] = seq[i]; });
}

function penalty(m: Mat, size: number): number {
  let score = 0;
  const at = (r: number, c: number) => (m[r][c] ?? 0);
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (at(r, c) === at(r, c - 1)) run++; else { if (run >= 5) score += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) score += 3 + (run - 5);
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (at(r, c) === at(r - 1, c)) run++; else { if (run >= 5) score += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) score += 3 + (run - 5);
  }
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = at(r, c);
    if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
  }
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += at(r, c);
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

function generateMatrix(text: string): Mat {
  const data = Array.from(Buffer.from(text, 'utf-8'));
  const version = chooseVersion(data.length);
  const { ec, blocks } = ECC_M[version];
  const dataCw = blocks.reduce((s, [nb, dc]) => s + nb * dc, 0);
  const countBits = version < 10 ? 8 : 16;

  // bitstream
  const bits: number[] = [];
  const put = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(0b0100, 4);
  put(data.length, countBits);
  for (const b of data) put(b, 8);
  const rem = dataCw * 8 - bits.length;
  put(0, Math.min(4, rem));
  while (bits.length % 8 !== 0) bits.push(0);
  const pads = [0xec, 0x11]; let pi = 0;
  while (bits.length < dataCw * 8) { put(pads[pi % 2], 8); pi++; }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0; for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }

  // split blocks + ecc
  const blockData: number[][] = []; const blockEcc: number[][] = [];
  let idx = 0;
  for (const [nb, dc] of blocks) for (let i = 0; i < nb; i++) {
    const blk = codewords.slice(idx, idx + dc); idx += dc;
    blockData.push(blk); blockEcc.push(rsEncode(blk, ec));
  }
  const final: number[] = [];
  const maxD = Math.max(...blockData.map(b => b.length));
  for (let i = 0; i < maxD; i++) for (const b of blockData) if (i < b.length) final.push(b[i]);
  const maxE = Math.max(...blockEcc.map(b => b.length));
  for (let i = 0; i < maxE; i++) for (const b of blockEcc) if (i < b.length) final.push(b[i]);

  const finalBits: number[] = [];
  for (const cw of final) for (let i = 7; i >= 0; i--) finalBits.push((cw >> i) & 1);

  const { mat, size, reserved } = buildMatrix(version, finalBits);
  let best: Mat | null = null; let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(mat, reserved, size, mask);
    placeFormat(masked, size, mask);
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (masked[r][c] === null) masked[r][c] = 0;
    const sc = penalty(masked, size);
    if (sc < bestScore) { bestScore = sc; best = masked; }
  }
  return best!;
}

/**
 * Returns a self-contained <svg> string for the given text (e.g. a URL).
 * @param text   payload to encode
 * @param opts   module px size, quiet-zone modules, dark/light colors
 */
export function qrSvg(
  text: string,
  opts: { module?: number; quiet?: number; dark?: string; light?: string } = {}
): string {
  const module = opts.module ?? 4;
  const quiet = opts.quiet ?? 4;
  const dark = opts.dark ?? '#0B1F3A';
  const light = opts.light ?? '#FFFFFF';
  const m = generateMatrix(text);
  const size = m.length;
  const total = (size + 2 * quiet) * module;
  let rects = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (m[r][c]) {
      const x = (c + quiet) * module;
      const y = (r + quiet) * module;
      rects += `<rect x="${x}" y="${y}" width="${module}" height="${module}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" shape-rendering="crispEdges" role="img" aria-label="Verification QR code"><rect width="${total}" height="${total}" fill="${light}"/><g fill="${dark}">${rects}</g></svg>`;
}
