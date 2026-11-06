/**
 * Renders the ScrollWise SVG marks into the PNGs Android's launcher needs.
 *
 * Android will not take an SVG for a launcher icon, and a raster drawn by hand
 * would drift from the vector the rest of the app uses. So the SVG stays the source
 * of truth and this renders from it; run it after changing anything in assets/logo
 * and commit the output.
 *
 *   node scripts/make-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logo = (name) => resolve(root, 'assets/logo', name);
const out = (name) => resolve(root, 'assets/images', name);

/** Adaptive icon layers are 432x432; the Play listing icon is 1024x1024. */
const TARGETS = [
  { from: 'scrollwise.svg', to: 'icon.png', size: 1024 },
  { from: 'scrollwise.svg', to: 'favicon.png', size: 256 },
  { from: 'scrollwise-foreground.svg', to: 'android-icon-foreground.png', size: 432 },
  { from: 'scrollwise-monochrome.svg', to: 'android-icon-monochrome.png', size: 432 },
  { from: 'scrollwise.svg', to: 'splash-icon.png', size: 512 },
];

/** The background layer is flat, so it is cheaper to generate than to store. */
const BACKGROUND = { to: 'android-icon-background.png', size: 432, color: '#0d0d0d' };

async function main() {
  await mkdir(resolve(root, 'assets/images'), { recursive: true });

  for (const { from, to, size } of TARGETS) {
    const png = await sharp(logo(from), { density: 512 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await writeFile(out(to), png);
    console.log(`${to}  ${size}x${size}  <- ${from}`);
  }

  const bg = await sharp({
    create: {
      width: BACKGROUND.size,
      height: BACKGROUND.size,
      channels: 4,
      background: BACKGROUND.color,
    },
  })
    .png()
    .toBuffer();
  await writeFile(out(BACKGROUND.to), bg);
  console.log(`${BACKGROUND.to}  ${BACKGROUND.size}x${BACKGROUND.size}  <- flat ${BACKGROUND.color}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
