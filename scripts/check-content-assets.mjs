import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const contentRoot = path.join(root, 'src', 'content');
const collections = ['now', 'art', 'pokemon'];
const missing = [];

for (const collection of collections) {
  const directory = path.join(contentRoot, collection);
  const names = (await readdir(directory)).filter((name) => name.endsWith('.md'));

  for (const name of names) {
    const file = path.join(directory, name);
    const source = await readFile(file, 'utf8');
    const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? '';
    const rawImage = frontmatter.match(/^image:\s*(.+?)\s*$/m)?.[1];
    if (!rawImage) continue;

    const image = rawImage.replace(/^['"]|['"]$/g, '');
    if (!image.startsWith('/')) {
      missing.push(`${path.relative(root, file)}: image must start with / (${image})`);
      continue;
    }

    const target = path.join(publicRoot, image.slice(1));
    try {
      const details = await stat(target);
      if (!details.isFile()) throw new Error('not a file');
    } catch {
      missing.push(`${path.relative(root, file)}: ${image}`);
    }
  }
}

if (missing.length > 0) {
  console.error('content asset check failed:\n' + missing.map((item) => `  - ${item}`).join('\n'));
  process.exit(1);
}

console.log('content assets: all frontmatter image paths resolve');
