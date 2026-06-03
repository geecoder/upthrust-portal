#!/usr/bin/env node
/**
 * scripts/prep-light-and-sig.js
 *
 * Generates two new image exports and APPENDS them to
 * lib/upthrust-logo-base64.ts (leaves existing LOGO + WATERMARK exports intact).
 *
 *   UPTHRUST_LOGO_LIGHT_DATA_URL  — orange arrow preserved, navy text → white
 *   GENESIS_SIGNATURE_DATA_URL    — transparent background, trimmed, 320px wide
 *
 * Run once:  node scripts/prep-light-and-sig.js
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const LOGO_SRC = 'C:\\Users\\genes\\Downloads\\Upthrust Logo.png';
const SIG_SRC  = 'C:\\Users\\genes\\Downloads\\genesis signature.png';
const OUT_TS   = path.join(__dirname, '..', 'lib', 'upthrust-logo-base64.ts');

const WHITE_THRESHOLD = 235;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function removeBackground(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] > WHITE_THRESHOLD && px[i+1] > WHITE_THRESHOLD && px[i+2] > WHITE_THRESHOLD) {
      px[i+3] = 0;
    }
  }
  return sharp(Buffer.from(px), { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toBuffer();
}

// Recolor pixels: orange arrow → keep, navy/grey text → white (#FFF).
// Keep rule: R > 150 AND (R − B) > 80 AND R > G  (matches orange; excludes navy/grey).
async function recolorNavyToWhite(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data);
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i+3];
    if (a < 10) continue;                     // already transparent — skip
    const r = px[i], g = px[i+1], b = px[i+2];
    const isOrange = r > 150 && (r - b) > 80 && r > g;
    if (!isOrange) {
      // Navy, grey, or dark AA pixel → recolor to white, preserve alpha
      px[i]   = 255;
      px[i+1] = 255;
      px[i+2] = 255;
    }
  }
  return sharp(Buffer.from(px), { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toBuffer();
}

// ── Asset 1: White-text logo ──────────────────────────────────────────────────

async function buildLightLogo() {
  console.log('\n--- LIGHT LOGO ---');
  if (!fs.existsSync(LOGO_SRC)) { console.error('ERROR: source not found:', LOGO_SRC); process.exit(1); }

  const raw = fs.readFileSync(LOGO_SRC);

  console.log('Removing background…');
  const transparent = await removeBackground(raw);

  console.log('Recoloring navy → white…');
  const recolored = await recolorNavyToWhite(transparent);

  console.log('Trimming…');
  const trimmed = await sharp(recolored).trim({ threshold: 2 }).png().toBuffer();

  console.log('Resizing → 600px wide…');
  const final = await sharp(trimmed)
    .resize({ width: 600, withoutEnlargement: false })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  const dataUrl = `data:image/png;base64,${final.toString('base64')}`;
  console.log(`Light logo data URL length: ${dataUrl.length.toLocaleString()} chars`);
  return dataUrl;
}

// ── Asset 2: Signature ────────────────────────────────────────────────────────

async function buildSignature() {
  console.log('\n--- SIGNATURE ---');
  if (!fs.existsSync(SIG_SRC)) { console.error('ERROR: source not found:', SIG_SRC); process.exit(1); }

  const raw = fs.readFileSync(SIG_SRC);

  console.log('Removing background…');
  const transparent = await removeBackground(raw);

  console.log('Trimming…');
  const trimmed = await sharp(transparent).trim({ threshold: 2 }).png().toBuffer();

  console.log('Resizing → 320px wide…');
  const final = await sharp(trimmed)
    .resize({ width: 320, withoutEnlargement: false })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  const dataUrl = `data:image/png;base64,${final.toString('base64')}`;
  console.log(`Signature data URL length: ${dataUrl.length.toLocaleString()} chars`);
  return dataUrl;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const [lightLogoUrl, signatureUrl] = await Promise.all([
    buildLightLogo(),
    buildSignature(),
  ]);

  // Read existing file and strip any prior versions of these two exports
  let existing = fs.existsSync(OUT_TS) ? fs.readFileSync(OUT_TS, 'utf8') : '';
  existing = existing
    .replace(/\nexport const UPTHRUST_LOGO_LIGHT_DATA_URL = "[^"]*";\n/g, '\n')
    .replace(/\nexport const GENESIS_SIGNATURE_DATA_URL = "[^"]*";\n/g, '\n')
    .trimEnd();

  const additions = [
    '',
    `export const UPTHRUST_LOGO_LIGHT_DATA_URL = "${lightLogoUrl}";`,
    '',
    `export const GENESIS_SIGNATURE_DATA_URL = "${signatureUrl}";`,
    '',
  ].join('\n');

  fs.writeFileSync(OUT_TS, existing + additions, 'utf8');

  const outSize = fs.statSync(OUT_TS).size;
  console.log(`\nWrote: ${OUT_TS}`);
  console.log(`  Total file size: ${(outSize / 1024).toFixed(1)} KB`);
  console.log('  UPTHRUST_LOGO_LIGHT_DATA_URL ✓');
  console.log('  GENESIS_SIGNATURE_DATA_URL   ✓');
  console.log('\nDone.');
}

main().catch(err => { console.error('Script failed:', err.message); process.exit(1); });
