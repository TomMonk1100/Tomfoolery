import { sharedById, ADAM, type SharedPerson } from '../../data/shared-family';

// Paths are assertions from the imported tree, not a measure of proof.
export function ancestryPaths(start: string, people: Record<string, SharedPerson> = sharedById): string[][] {
  if (!people[start]) return [];
  const walk = (id: string, path: string[]): string[][] => {
    const parents = people[id].parents.filter(parent => people[parent] && !path.includes(parent));
    return parents.length ? parents.flatMap(parent => walk(parent, [...path, parent])) : [path];
  };
  return walk(start, [start]).sort((a, b) => b.length - a.length || a.join('/').localeCompare(b.join('/')));
}
export interface MissingParent {
  id: string;
  child: string;
  slot: number;
  confidence: 'provisional';
  sourceKind: 'inference';
  kind: 'missing parent position';
}
export function missingParents(person: SharedPerson): MissingParent[] {
  // Only immediate unfilled positions. No guessed sex, number of earlier
  // generations, marriage, biological status, or connection to biblical figures.
  return Array.from({ length: Math.max(0, 2 - person.parents.length) }, (_, i) => ({
    id: `gap-${person.id}-parent-${i + 1}`, child: person.id, slot: i + 1,
    confidence: 'provisional', sourceKind: 'inference', kind: 'missing parent position',
  }));
}
export function ancestryAudit(start = ADAM) {
  const paths = ancestryPaths(start);
  const ids = [...new Set(paths.flat())];
  return { paths, ids, ancestors: ids.filter(id => id !== start), longest: paths[0] || [], gaps: ids.flatMap(id => missingParents(sharedById[id])) };
}
