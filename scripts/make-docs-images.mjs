/**
 * Renders the artwork used in README.md.
 *
 * These are the real shipped vectors, not screenshots: the logo comes straight
 * from assets/logo, and the mood strip redraws Ellie so her expressions can be
 * seen without a device.
 *
 * WARNING: the Ellie shapes below mirror src/components/ellie/ellie-face.tsx by
 * hand, because react-native-svg components cannot render under node. If you
 * change her there, change her here too — otherwise this picture quietly starts
 * lying about what the app looks like.
 *
 *   node scripts/make-docs-images.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (name) => resolve(root, 'docs/images', name);

/** Mirrors src/constants/theme.ts — Ellie and Surface.sunken. */
const C = {
  fur: '#E2B887',
  furShade: '#C2956A',
  pink: '#E58BA4',
  eye: '#17160F',
  shine: '#FFFFFF',
  whisker: 'rgba(255,255,255,0.45)',
  blush: 'rgba(229,139,164,0.35)',
  bg: '#1a1a19',
};

const MOODS = [
  { id: 'content', label: 'content' },
  { id: 'proud', label: 'proud' },
  { id: 'watchful', label: 'watchful' },
  { id: 'worried', label: 'worried' },
  { id: 'sleepy', label: 'sleepy' },
];

const earAngle = (m) =>
  m === 'worried' ? 22 : m === 'sleepy' ? 16 : m === 'watchful' ? 4 : 0;

function eyes(mood, closed) {
  const s = `stroke="${C.eye}" stroke-linecap="round" fill="none"`;
  if (closed)
    return `<path d="M44 72 Q52 79 60 72" stroke-width="3.5" ${s}/>
            <path d="M80 72 Q88 79 96 72" stroke-width="3.5" ${s}/>`;
  if (mood === 'proud')
    return `<path d="M44 74 Q52 65 60 74" stroke-width="4" ${s}/>
            <path d="M80 74 Q88 65 96 74" stroke-width="4" ${s}/>`;
  const ry = mood === 'worried' ? 11 : mood === 'watchful' ? 6.5 : 9;
  const p = mood === 'worried' ? 2.6 : 4;
  const brow =
    mood === 'watchful'
      ? `<path d="M43 60 L61 64" stroke="${C.furShade}" stroke-width="3" stroke-linecap="round"/>
         <path d="M97 60 L79 64" stroke="${C.furShade}" stroke-width="3" stroke-linecap="round"/>`
      : '';
  return `<ellipse cx="52" cy="71" rx="8.5" ry="${ry}" fill="${C.eye}"/>
          <ellipse cx="88" cy="71" rx="8.5" ry="${ry}" fill="${C.eye}"/>
          <circle cx="54.5" cy="${71 - p / 2}" r="${p}" fill="${C.shine}" opacity="0.9"/>
          <circle cx="90.5" cy="${71 - p / 2}" r="${p}" fill="${C.shine}" opacity="0.9"/>${brow}`;
}

function mouth(mood) {
  const s = `stroke="${C.eye}" stroke-width="2.6" stroke-linecap="round" fill="none"`;
  if (mood === 'worried') return `<path d="M62 99 Q70 94 78 99" ${s}/>`;
  if (mood === 'sleepy') return `<path d="M66 96 Q70 99 74 96" ${s}/>`;
  return `<path d="M61 94 Q65.5 100 70 94 Q74.5 100 79 94" ${s}/>`;
}

/** One 140x140 tile of Ellie, on the app's own card surface. */
function face(mood) {
  const closed = mood === 'sleepy';
  const e = earAngle(mood);
  const w = `stroke="${C.whisker}" stroke-width="2" stroke-linecap="round" fill="none"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
  <rect width="140" height="140" fill="${C.bg}"/>
  <path d="M44 118 Q44 96 70 96 Q96 96 96 118 Q96 126 70 126 Q44 126 44 118 Z" fill="${C.furShade}"/>
  <g transform="rotate(${-e} 44 52)">
    <polygon points="33,66 34,20 60,44" fill="${C.fur}"/>
    <polygon points="36,50 38,30 52,44" fill="${C.pink}"/>
  </g>
  <g transform="rotate(${e} 96 52)">
    <polygon points="107,66 106,20 80,44" fill="${C.fur}"/>
    <polygon points="104,50 102,30 88,44" fill="${C.pink}"/>
  </g>
  <ellipse cx="70" cy="74" rx="42" ry="37" fill="${C.fur}"/>
  <path d="M62 42 L66 54" stroke="${C.furShade}" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M70 40 L70 53" stroke="${C.furShade}" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M78 42 L74 54" stroke="${C.furShade}" stroke-width="3.5" stroke-linecap="round"/>
  ${eyes(mood, closed)}
  <ellipse cx="46" cy="86" rx="8" ry="5.5" fill="${C.blush}"/>
  <ellipse cx="94" cy="86" rx="8" ry="5.5" fill="${C.blush}"/>
  <path d="M70 84 L65 89 Q70 93 75 89 Z" fill="${C.pink}"/>
  ${mouth(mood)}
  <path d="M36 84 Q22 80 12 82" ${w}/><path d="M36 90 Q22 90 11 93" ${w}/>
  <path d="M104 84 Q118 80 128 82" ${w}/><path d="M104 90 Q118 90 129 93" ${w}/>
</svg>`;
}

const TILE = 240;
const GAP = 12;
const CAPTION = 34;

/** A labelled strip of every mood, so the set reads as one system. */
async function moodStrip() {
  const tiles = await Promise.all(
    MOODS.map(({ id }) =>
      sharp(Buffer.from(face(id)), { density: 300 }).resize(TILE, TILE).png().toBuffer()
    )
  );

  const width = TILE * MOODS.length + GAP * (MOODS.length - 1);
  const labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${CAPTION}">
    ${MOODS.map(
      ({ label }, i) =>
        `<text x="${i * (TILE + GAP) + TILE / 2}" y="22" fill="#898781"
               font-family="DejaVu Sans, Verdana, sans-serif" font-size="15"
               text-anchor="middle">${label}</text>`
    ).join('\n    ')}
  </svg>`;

  return sharp({
    create: { width, height: TILE + CAPTION, channels: 4, background: C.bg },
  })
    .composite([
      ...tiles.map((input, i) => ({ input, left: i * (TILE + GAP), top: 0 })),
      { input: Buffer.from(labels), left: 0, top: TILE },
    ])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(resolve(root, 'docs/images'), { recursive: true });

  await writeFile(out('ellie-moods.png'), await moodStrip());
  console.log('ellie-moods.png   the five moods, labelled');

  // The launcher icon as it actually ships, straight from the committed SVG.
  const icon = await sharp(resolve(root, 'assets/logo/scrollwise.svg'), { density: 512 })
    .resize(256, 256)
    .png()
    .toBuffer();
  await writeFile(out('icon.png'), icon);
  console.log('icon.png          256x256 <- assets/logo/scrollwise.svg');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
