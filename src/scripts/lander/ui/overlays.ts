import { RARITY } from '../stats';
import { DIFF_MODS } from '../stats';
import { UPGRADES, PAINTS, TRAILS, SKIES } from '../upgrades';
import type { Difficulty, TrailDef, UpgradeId } from '../types';

export function upgradeListHtml(pickedUpgrades: UpgradeId[]): string {
  if (pickedUpgrades.length === 0) return '<p class="text-xs text-muted mt-2">No upgrades yet.</p>';
  const counts = new Map<UpgradeId, number>();
  pickedUpgrades.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  return '<div class="flex flex-wrap gap-2 mt-3 justify-center">' +
    Array.from(counts.entries()).map(([id, n]) => {
      const def = UPGRADES.find((u) => u.id === id)!;
      const color = RARITY[def.rarity].color;
      return `<span class="badge border px-2 py-1" style="border-color:${color}">${def.icon} ${def.name}${n > 1 ? ` ×${n}` : ''}</span>`;
    }).join('') + '</div>';
}

export function shopItemHtml(
  kind: 'paint' | 'trail' | 'sky', id: string, name: string, price: number, swatch: string,
  cosmetics: { owned: string[]; paint: string; trail: string; sky: string }
): string {
  const owned = cosmetics.owned.includes(id);
  const equipped = cosmetics[kind] === id;
  // px-3 py-2.5 (not the tighter px-2 py-1 badges use elsewhere) keeps this
  // at/near the 44px touch-target minimum — these are tappable purchase
  // actions on a scrolling mobile list, not inline text badges.
  const action = equipped ? '' : owned
    ? `<button data-shop="equip:${kind}:${id}" class="badge border border-line px-3 py-2.5 cursor-pointer hover:border-accent">equip</button>`
    : `<button data-shop="buy:${kind}:${id}" class="badge border border-line px-3 py-2.5 cursor-pointer hover:border-accent">✨ ${price}</button>`;
  return `
    <div class="flex items-center gap-3 py-2 border-b border-line">
      <span class="inline-block w-9 h-5 border border-line shrink-0" style="background:${swatch}"></span>
      <span class="flex-1 text-left font-mono text-sm ${equipped ? 'badge-signal' : 'text-ink'}">${name}${equipped ? ' · equipped' : ''}</span>
      ${action}
    </div>`;
}

export function trailSwatch(td: TrailDef): string {
  return td.colors === 'rainbow'
    ? 'linear-gradient(90deg,#e05a5a,#d9a441,#94b03d,#7ba7c7,#b07bd6)'
    : td.colors === 'stardust'
      ? 'linear-gradient(90deg,#F4EBDA,#FFC94A)'
      : `linear-gradient(90deg,${(td.colors as string[]).join(',')})`;
}

export function diffButtonsHtml(difficulty: Difficulty, bestFor: (d: Difficulty) => number): string {
  return `<div class="flex gap-2 justify-center mt-4">${(Object.keys(DIFF_MODS) as Difficulty[]).map((d) => {
    const mod = DIFF_MODS[d];
    const active = d === difficulty;
    return `<button data-diff="${d}" class="tile px-4 py-2 cursor-pointer text-center" style="${active ? 'border-color: var(--color-accent);' : 'opacity:0.65;'}">
      <div class="font-mono text-sm">${mod.icon} ${mod.label}</div>
      <div class="text-[10px] text-muted mt-0.5">${mod.blurb}</div>
      <div class="text-[10px] font-mono mt-1 badge-signal">best: ${bestFor(d) || '—'}</div>
    </button>`;
  }).join('')}</div>`;
}

export { PAINTS, TRAILS, SKIES };
