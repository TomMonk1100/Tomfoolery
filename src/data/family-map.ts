import { sharedPeople, ADAM, personUrl, type SharedPerson } from './shared-family';
import { biblicalPeople, biblicalById } from './biblical-family';
import { people as researchPeople, relationships, sourceById, type SourceKind } from './family';
import { candidatePeople, candidateRelationships } from './ancestry-candidates';
import { legendaryPeople, legendaryRelationships } from './legendary-family';
import { relationshipReview } from './ancestry-relationships';
import { upbringing } from './close-family-evidence';
import { missingParents } from '../scripts/family/ancestry';

export interface MapPerson extends SharedPerson {
  kind: 'family' | 'research' | 'candidate' | 'legendary' | 'biblical' | 'unknown';
  child?: string;
  sourceKind: SourceKind | 'biblical narrative' | 'legendary tradition';
}

// An additive display overlay. Original people and parent assertions stay intact.
const known: MapPerson[] = [
  ...sharedPeople.map(p => ({ ...p, kind: 'family' as const, sourceKind: 'compiled genealogy' as const })),
  ...researchPeople.filter(p => !sharedPeople.some(existing => existing.id === p.id)).map(p => ({
    id: p.id, uuid: p.id, name: p.name, dates: p.dates, aliases: [...p.aliases], gender: '',
    parents: [], partners: [], children: [], kind: 'research' as const, sourceKind: 'user supplied' as const,
  })),
  ...candidatePeople.map(p => ({...p, kind:'candidate' as const, sourceKind:'compiled genealogy' as const})),
  ...legendaryPeople.map(p => ({...p, kind:'legendary' as const, sourceKind:'legendary tradition' as const})),
  ...biblicalPeople.map(p => ({
    id: p.id, uuid: p.id, name: p.name, dates: p.verse, parents: [...p.parents],
    partners: p.id === 'bible-adam' ? ['bible-eve'] : p.id === 'bible-eve' ? ['bible-adam'] : [],
    children: biblicalPeople.filter(child => child.parents.includes(p.id)).map(child => child.id),
    aliases: p.name === 'Abram' ? ['Abraham'] : [], gender: '',
    kind: 'biblical' as const, sourceKind: 'biblical narrative' as const,
  })),
];
// Display the recorded research assertions without changing imported records or upgrading certainty.
for (const person of known) {
  const union = (ids: string[], added: string[]) => [...new Set([...ids, ...added])];
  person.parents = union(person.parents, legendaryRelationships.filter(r=>r.to===person.id).map(r=>r.from));
  person.children = union(person.children, legendaryRelationships.filter(r=>r.from===person.id).map(r=>r.to));
  person.parents = union(person.parents, candidateRelationships.filter(r=>r.to===person.id).map(r=>r.from));
  person.parents = union(person.parents, relationships.filter(r => r.kind === 'parent' && r.to === person.id).map(r => r.from));
  person.children = union(person.children, relationships.filter(r => r.kind === 'parent' && r.from === person.id).map(r => r.to));
  person.partners = union(person.partners, relationships.filter(r => r.kind === 'spouse' && (r.from === person.id || r.to === person.id)).map(r => r.from === person.id ? r.to : r.from));
}
export function mapEdgeAssessment(from: string, to: string, kind: 'parent' | 'partner') {
  if(kind==='parent' && from===upbringing.biologicalFather && to===upbringing.child) return {confidence:'supported' as const,sourceKind:'user supplied' as const,importedConfidence:undefined,review:upbringing.note,evidenceUrl:'/family/#patrick-biological-and-raised-family'};
  const legend = kind==='parent' && legendaryRelationships.find(r=>r.from===from && r.to===to);
  if(legend) return {confidence:legend.confidence, sourceKind:legend.sourceKind, importedConfidence:undefined, review:legend.note, evidenceUrl:`/family/#${legend.finding}`};
  const candidate = kind==='parent' && candidateRelationships.find(r=>r.from===from && r.to===to);
  if(candidate) return {confidence:candidate.confidence, sourceKind:'compiled genealogy' as const, importedConfidence:undefined, review:candidate.note, evidenceUrl:`/family/#${candidate.finding}`};
  const importedReview = kind==='parent' && relationshipReview(from,to);
  if(importedReview) return {confidence:importedReview.confidence,sourceKind:'compiled genealogy' as const,importedConfidence:'supported' as const,review:importedReview.finding,evidenceUrl:`/family/#${importedReview.finding}`};
  const relation = relationships.find(r => kind === 'parent' ? r.kind === 'parent' && r.from === from && r.to === to : r.kind === 'spouse' && ((r.from === from && r.to === to) || (r.from === to && r.to === from)));
  return relation ? { confidence: relation.confidence, sourceKind: sourceById[relation.sources[0]].kind, importedConfidence: undefined, review: relation.note } : {};
}
// Historical research counts exclude the chronicle bridge and biblical branch.
const historical = known.filter(p=>p.kind!=='biblical' && p.kind!=='legendary');
const historicalIds = new Set(historical.map(p=>p.id));
export const familyMapAncestryById: Record<string, SharedPerson> = Object.fromEntries(historical.map(p=>[p.id,{...p,parents:p.parents.filter(id=>historicalIds.has(id)),children:p.children.filter(id=>historicalIds.has(id))}]));
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
  ? personUrl(id) : `/family/#${familyMapById[id].kind === 'unknown' ? `map-${id}` : familyMapById[id].kind === 'research' ? `person-${id}` : id}`;
export const mapPersonLabel = (id: string) => id === ADAM ? 'Adam Muncie (Tom)'
  : familyMapById[id].kind === 'unknown' ? `? · ${familyMapById[id].aliases[0]}` : familyMapById[id].name;
export function searchFamilyMap(query: string) {
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const words = normalize(query).trim().split(/\s+/);
  return familyMapPeople.filter(p => words.every(word => normalize(`${mapPersonLabel(p.id)} ${p.aliases.join(' ')} ${p.dates}`).includes(word)));
}
// A finite bound from the data keeps All ancestors complete as the tree grows.
export const familyMapAncestorDepth = known.length;
export const mapSource = (id: string) => familyMapById[id].kind === 'biblical'
  ? `${biblicalById[id].verse} · biblical narrative` : familyMapById[id].kind === 'legendary' ? 'Medieval chronicle tradition · mythical and disputed pedigree; not verified ancestry' : familyMapById[id].kind === 'unknown'
    ? 'Unknown immediate parent position; identity and relationship status unestablished.' : familyMapById[id].kind === 'research' ? 'Research person · see profile for evidence and confidence' : familyMapById[id].kind === 'candidate' ? 'Provisional compiled claim · identity and parentage unverified' : 'Family-provided record';
