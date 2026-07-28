import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const outputRoot = path.join(publicRoot, 'images', 'social');
const checkOnly = process.argv.includes('--check');

const xml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const cards = [
  {
    key: 'now',
    title: 'Now',
    kicker: 'CURRENT FIELD NOTES',
    detail: 'what has my attention lately',
    accent: '#C2673A',
    photo: 'images/now-bats.webp',
    position: 'attention',
  },
  {
    key: 'coffee',
    title: 'Coffee',
    kicker: 'A MORNING RITUAL',
    detail: 'latte art · small rituals · good light',
    accent: '#B8862E',
    photo: 'images/coffee/latte-breakfast.webp',
    position: 'centre',
  },
  {
    key: 'about',
    title: 'About Tom',
    kicker: 'THE PERSON TENDING THIS PLACE',
    detail: 'work · coffee · collections · learning',
    accent: '#C2673A',
    photo: 'images/about-tom.webp',
    position: 'centre',
    portrait: true,
  },
  {
    key: 'game',
    title: 'Moon Lander',
    kicker: 'PLAY',
    detail: 'an endless little flight with real tradeoffs',
    accent: '#D9A441',
    photo: 'images/outside/plates/clear/night-desktop.webp',
    position: 'centre',
  },
  {
    key: 'pokemon',
    title: 'Pokémon TCG',
    kicker: 'THE COLLECTION',
    detail: 'cards · sets · a binder with a mission',
    accent: '#56703D',
    paper: '#F3ECDE',
  },
  {
    key: 'art',
    title: 'Art',
    kicker: 'THE CREATIVE SHELF',
    detail: 'latte art · drawings · experiments',
    accent: '#A64E28',
    paper: '#FAF6EE',
  },
  {
    key: 'archive',
    title: 'Tom of the Past',
    kicker: 'THE ARCHIVE',
    detail: 'old blog posts · 2008–2018',
    accent: '#886018',
    paper: '#EEE4D3',
  },
  {
    key: 'archive-tweets',
    title: 'Old Tweets',
    kicker: 'A DECADE, ONE DAY AT A TIME',
    detail: '13,686 posts · 2008–2018',
    accent: '#A64E28',
    paper: '#F4ECDD',
  },
  {
    key: '404',
    title: 'Nothing here.',
    kicker: '404 · TOMFOOLERY',
    detail: 'the useful way back',
    accent: '#6F604A',
    paper: '#FAF6EE',
  },
];

function photoOverlay(card) {
  return Buffer.from(`
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#140F0A" stop-opacity=".83"/>
          <stop offset=".64" stop-color="#140F0A" stop-opacity=".44"/>
          <stop offset="1" stop-color="#140F0A" stop-opacity=".08"/>
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".55" stop-color="#140F0A" stop-opacity="0"/>
          <stop offset="1" stop-color="#140F0A" stop-opacity=".34"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#shade)"/>
      <rect width="1200" height="630" fill="url(#floor)"/>
      <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#FAF6EE" stroke-opacity=".46"/>
      <line x1="70" y1="94" x2="236" y2="94" stroke="${card.accent}" stroke-width="5"/>
      <text x="70" y="135" fill="#FAF6EE" font-family="monospace" font-size="23" font-weight="700" letter-spacing="4">${xml(card.kicker)}</text>
      <text x="64" y="350" fill="#FAF6EE" font-family="Arial, sans-serif" font-size="${card.title.length > 11 ? 92 : 112}" font-weight="600" letter-spacing="-4">${xml(card.title)}</text>
      <text x="70" y="407" fill="#FAF6EE" fill-opacity=".9" font-family="monospace" font-size="25" letter-spacing="1">${xml(card.detail)}</text>
      <text x="70" y="558" fill="#FAF6EE" fill-opacity=".82" font-family="monospace" font-size="21" letter-spacing="2">TOMFOOLERY · BRECKENRIDGE, TEXAS</text>
    </svg>
  `);
}

function paperCard(card) {
  const titleSize = card.title.length > 12 ? 88 : 112;
  return Buffer.from(`
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="${card.paper}"/>
      <path d="M-40 522 C 230 390, 430 720, 700 508 S 1010 374, 1260 490" fill="none" stroke="${card.accent}" stroke-opacity=".12" stroke-width="110"/>
      <path d="M-40 510 C 230 378, 430 708, 700 496 S 1010 362, 1260 478" fill="none" stroke="${card.accent}" stroke-opacity=".62" stroke-width="2"/>
      <circle cx="985" cy="148" r="82" fill="none" stroke="${card.accent}" stroke-opacity=".28"/>
      <circle cx="985" cy="148" r="7" fill="${card.accent}"/>
      <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#6F604A" stroke-opacity=".42"/>
      <line x1="70" y1="94" x2="236" y2="94" stroke="${card.accent}" stroke-width="5"/>
      <text x="70" y="135" fill="#6F604A" font-family="monospace" font-size="23" font-weight="700" letter-spacing="4">${xml(card.kicker)}</text>
      <text x="64" y="350" fill="#221A12" font-family="Arial, sans-serif" font-size="${titleSize}" font-weight="600" letter-spacing="-4">${xml(card.title)}</text>
      <text x="70" y="407" fill="#6F604A" font-family="monospace" font-size="25" letter-spacing="1">${xml(card.detail)}</text>
      <text x="70" y="558" fill="#6F604A" font-family="monospace" font-size="21" letter-spacing="2">TOMFOOLERY · BRECKENRIDGE, TEXAS</text>
    </svg>
  `);
}

async function writeIfChanged(file, buffer) {
  try {
    const previous = await readFile(file);
    if (previous.equals(buffer)) return false;
  } catch {
    // First generation.
  }
  await writeFile(file, buffer);
  return true;
}

await mkdir(outputRoot, { recursive: true });

async function validateCard(file) {
  const metadata = await sharp(file).metadata();
  if (metadata.width !== 1200 || metadata.height !== 630) {
    throw new Error(`${path.relative(root, file)} must remain exactly 1200×630`);
  }
}

await validateCard(path.join(publicRoot, 'og.png'));

if (checkOnly) {
  for (const card of cards) {
    await validateCard(path.join(outputRoot, `${card.key}.png`));
  }
  console.log(`social cards: homepage + ${cards.length} section cards verified`);
  process.exit(0);
}

let changed = 0;
for (const card of cards) {
  const source = card.photo && path.join(publicRoot, card.photo);
  let pipeline;
  if (source && card.portrait) {
    const portrait = await sharp(source)
      .resize({ height: 630 })
      .toBuffer();
    pipeline = sharp(source)
      .resize(1200, 630, { fit: 'cover', position: card.position })
      .blur(18)
      .composite([
        { input: portrait, left: 728, top: 0 },
        { input: photoOverlay(card) },
      ]);
  } else if (source) {
    pipeline = sharp(source)
      .resize(1200, 630, { fit: 'cover', position: card.position })
      .composite([{ input: photoOverlay(card) }]);
  } else {
    pipeline = sharp(paperCard(card));
  }

  const output = await pipeline
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toBuffer();
  const wrote = await writeIfChanged(
    path.join(outputRoot, `${card.key}.png`),
    output,
  );
  if (wrote) changed += 1;
}

for (const card of cards) {
  await validateCard(path.join(outputRoot, `${card.key}.png`));
}

console.log(
  `social cards: ${cards.length} ready${changed ? ` · ${changed} updated` : ''}`,
);
