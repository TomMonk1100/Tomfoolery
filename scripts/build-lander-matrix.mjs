import fs from 'node:fs';

const source = fs.readFileSync('src/scripts/lander/upgrades.ts', 'utf8').split('export const PAINTS')[0];
const pattern = /\{ id: '([^']+)',\s+rarity: '([^']+)',\s+name: ([^,]+),\s+icon: '([^']*)',\s+pro: '([^']*)',\s+con: '([^']*)',\s+desc: ([^,]+),/g;
const rows = [...source.matchAll(pattern)];
const lines = rows.map(([, id, rarity, name, icon, pro, con, desc]) => `| \`${id}\` | ${rarity} | ${name.replaceAll('"', '')} | ${pro.replaceAll('|', '\\|')} | ${con.replaceAll('|', '\\|')} | ${desc.replaceAll('"', '').replaceAll('|', '\\|')} | legacy stat contract; Pixi card mapping | focused interaction test pending | in progress |`);
const header = ['# Moon Lander 1.0 upgrade matrix', '', 'Generated from `src/scripts/lander/upgrades.ts`; stable IDs are preserved. The new runtime uses the legacy catalog as its content authority while effect-family migration continues.', '', '| Stable ID | Rarity | Name | Current behavior | Tradeoff | Player-facing explanation | Affected systems / visual mapping | Tests | Status |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
fs.mkdirSync('docs/plans/lander', { recursive: true });
fs.writeFileSync('docs/plans/lander/lander-1.0-upgrade-matrix.md', `${header.join('\n')}\n${lines.join('\n')}\n`);
console.log(`Wrote ${rows.length} upgrade rows.`);
