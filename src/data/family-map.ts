import { sharedPeople, ADAM, personUrl, type SharedPerson } from './shared-family';
import { biblicalPeople, biblicalById } from './biblical-family';
import { missingParents } from '../scripts/family/ancestry';

export interface MapPerson extends SharedPerson {
  kind: 'family' | 'biblical' | 'unknown';
  child?: string;
  sourceKind: 'compiled genealogy' | 'biblical narrative' | 'inference';
}

// An additive display overlay. Original people and parent assertions stay intact.
const known: MapPerson[] = [
  ...sharedPeople.map(p => ({ ...p, kind: 'family' as const, sourceKind: 'compiled genealogy' as const })),
  ...biblicalPeople.map(p => ({
    id: p.id, uuid: p.id, name: p.name, dates: p.verse, parents: [...p.parents],
    partners: p.id === 'bible-adam' ? ['bible-eve'] : p.id === 'bible-eve' ? ['bible-adam'] : [],
    children: biblicalPeople.filter(child => child.parents.includes(p.id)).map(child => child.id),
    aliases: p.name === 'Abram' ? ['Abraham'] : [], gender: '',
    kind: 'biblical' as const, sourceKind: 'biblical narrative' as const,
  })),
];
export const familyMapKnownCount = known.length;
const unknown: MapPerson[] = [];
export const familyMapPeople: MapPerson[] = known.map(p => {
  // Genesis gives Adam and Eve no human parents. Do not create parents for them.
  const gaps = p.id === 'bible-adam' || p.id === 'bible-eve' ? [] : missingParents(p);
  for (const gap of gaps) unknown.push({
    id: gap.id, uuid: gap.id, name: '?', dates: 'Identity unknown', aliases: [`Unknown parent ${gap.slot} of ${p.name}`],
    parents: [], partners: [], children: [p.id], gender: '', child: p.id,
    kind: 'unknown', sourceKind: 'inference',
  });
  return { ...p, parents: [...p.parents, ...gaps.map(g => g.id)] };
}).concat(unknown);
export const familyMapById: Record<string, MapPerson> = Object.fromEntries(familyMapPeople.map(p => [p.id, p]));
export const mapProfileUrl = (id: string) => familyMapById[id].kind === 'family'
  ? personUrl(id) : `/family/#${familyMapById[id].kind === 'unknown' ? `map-${id}` : id}`;
export const mapPersonLabel = (id: string) => id === ADAM ? 'Adam Muncie (Tom)'
  : familyMapById[id].kind === 'unknown' ? `? · ${familyMapById[id].aliases[0]}` : familyMapById[id].name;
export function searchFamilyMap(query: string) {
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const words = normalize(query).trim().split(/\s+/);
  return familyMapPeople.filter(p => words.every(word => normalize(`${mapPersonLabel(p.id)} ${p.aliases.join(' ')} ${p.dates}`).includes(word)));
}
export const mapSource = (id: string) => familyMapById[id].kind === 'biblical'
  ? `${biblicalById[id].verse} · biblical narrative` : familyMapById[id].kind === 'unknown'
    ? 'Unknown immediate parent position; identity and relationship status unestablished.' : 'Family-provided record';
