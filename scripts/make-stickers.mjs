/**
 * Renders the Twemoji SVGs in assets/stickers/svg to 192px PNGs beside them.
 * Run with `node scripts/make-stickers.mjs` after adding or replacing an SVG.
 *
 * Twemoji graphics © Twitter, Inc. and other contributors, CC-BY 4.0.
 */
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets/stickers/svg');
for (const file of readdirSync(src).filter((f) => f.endsWith('.svg'))) {
  const out = join(root, 'assets/stickers', file.replace('.svg', '.png'));
  await sharp(join(src, file), { density: 600 }).resize(192, 192).png().toFile(out);
}
console.log('stickers rendered');
