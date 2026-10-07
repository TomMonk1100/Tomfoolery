import { sharedPeople, ADAM, personUrl, type SharedPerson } from './shared-family';
import { people as researchPeople, relationships, sourceById, type SourceKind } from './family';
import { relationshipReview } from './ancestry-relationships';
import { upbringing, closeFamilyRelationships } from './close-family-evidence';
import { missingParents } from '../scripts/family/ancestry';

export interface MapPerson extends SharedPerson {
  kind: 'family' | 'research' | 'unknown';
  child?: string;
  sourceKind: SourceKind;
}

// An additive display overlay. Original people and parent assertions stay intact.
const known: MapPerson[] = [
  ...sharedPeople.map(p => ({ ...p, kind: 'family' as const, sourceKind: 'compiled genealogy' as const })),
  ...researchPeople.filter(p => !sharedPeople.some(existing => existing.id === p.id)).map(p => ({
    id: p.id, uuid: p.id, name: p.name, dates: p.dates, aliases: [...p.aliases], gender: '',
    parents: [], partners: [], children: [], kind: 'research' as const, sourceKind: 'user supplied' as const,
  })),

];
// Display the recorded research assertions without changing imported records or upgrading certainty.
for (const person of known) {
  const union = (ids: string[], added: string[]) => [...new Set([...ids, ...added])];
  person.parents = union(person.parents, closeFamilyRelationships.filter(r=>r.kind==='parent' && r.to===person.id).map(r=>r.from));
  person.children = union(person.children, closeFamilyRelationships.filter(r=>r.kind==='parent' && r.from===person.id).map(r=>r.to));
  person.partners = union(person.partners, closeFamilyRelationships.filter(r=>r.kind==='partner' && (r.from===person.id || r.to===person.id)).map(r=>r.from===person.id ? r.to : r.from));
  person.parents = union(person.parents, relationships.filter(r => r.kind === 'parent' && r.to === person.id).map(r => r.from));
  person.children = union(person.children, relationships.filter(r => r.kind === 'parent' && r.from === person.id).map(r => r.to));
  person.partners = union(person.partners, relationships.filter(r => r.kind === 'spouse' && (r.from === person.id || r.to === person.id)).map(r => r.from === person.id ? r.to : r.from));
}
export function mapEdgeAssessment(from: string, to: string, kind: 'parent' | 'partner') {
  if(kind==='parent' && ((from===upbringing.biologicalFather && to===upbringing.child) || (from===upbringing.child && to===ADAM))) return {confidence:'supported' as const,sourceKind:'user supplied' as const,importedConfidence:undefined,review:to===ADAM ? 'Tom identifies Patrick as his father in his direct family testimony; this is family testimony, not an inspected birth registration.' : upbringing.note,evidenceUrl:'/family/#patrick-biological-and-raised-family'};
  const importedReview = kind==='parent' && relationshipReview(from,to);
  if(importedReview) return {confidence:importedReview.confidence,sourceKind:'compiled genealogy' as const,importedConfidence:'supported' as const,review:importedReview.finding,evidenceUrl:`/family/#${importedReview.finding}`};
  const closeRecord = closeFamilyRelationships.find(r=>r.kind===kind && (kind==='parent' ? r.from===from && r.to===to : (r.from===from && r.to===to) || (r.from===to && r.to===from)));
  if(closeRecord) return {confidence:closeRecord.confidence,sourceKind:closeRecord.sourceKind,importedConfidence:undefined,review:closeRecord.note,evidenceUrl:`/family/#${closeRecord.finding}`};
  const relation = relationships.find(r => kind === 'parent' ? r.kind === 'parent' && r.from === from && r.to === to : r.kind === 'spouse' && ((r.from === from && r.to === to) || (r.from === to && r.to === from)));
  return relation ? { confidence: relation.confidence, sourceKind: sourceById[relation.sources[0]].inspected ? sourceById[relation.sources[0]].kind : 'research guide' as const, importedConfidence: undefined, review: relation.note } : {};
}
// Keep the import available for evidence audits, without treating its links as proof.
export const familyMapAncestryById: Record<string, SharedPerson> = Object.fromEntries(known.map(p=>[p.id,{...p, parents:[...p.parents], children:[...p.children], partners:[...p.partners]}]));
const supportedSources = new Set<SourceKind>(['original record', 'official index', 'transcription', 'user supplied']);
export function isConfirmedConnection(from: string, to: string, kind: 'parent' | 'partner') {
  const assessment = mapEdgeAssessment(from, to, kind);
  return assessment.confidence === 'supported' && !!assessment.sourceKind && supportedSources.has(assessment.sourceKind);
}
// Only explicitly supported connections enter the displayed tree. Unknown,
// probable, conflicting, and unreviewed imported assertions stop the trail.
const confirmedIds = new Set([ADAM, upbringing.child, upbringing.biologicalFather, upbringing.raisedBy]);
for (const p of known) {
  p.parents = p.parents.filter(id => isConfirmedConnection(id, p.id, 'parent'));
  p.partners = p.partners.filter(id => isConfirmedConnection(id, p.id, 'partner'));
  if (p.id === ADAM) p.parents = [upbringing.child];
  for (const id of [...p.parents, ...p.partners]) { confirmedIds.add(p.id); confirmedIds.add(id); }
}
for (const p of known) p.children = known.filter(child=>child.parents.includes(p.id)).map(child=>child.id);
const confirmed = known.filter(p=>confirmedIds.has(p.id));
export const confirmedAncestryById: Record<string, SharedPerson> = Object.fromEntries(confirmed.map(p=>[p.id,p]));
export const familyMapKnownCount = confirmed.length;
const unknown: MapPerson[] = [];
export const familyMapPeople: MapPerson[] = confirmed.map(p => {
  const gaps = missingParents(p);
  for (const gap of gaps) unknown.push({
    id: gap.id, uuid: gap.id, name: '?', dates: 'Evidence not established', aliases: [`Unconfirmed parent ${gap.slot} of ${p.name}`],
    parents: [], partners: [], children: [p.id], gender: '', child: p.id,
    kind: 'unknown', sourceKind: 'inference',
  });
  return { ...p, parents: [...p.parents, ...gaps.map(g => g.id)] };
}).concat(unknown);
export const familyMapById: Record<string, MapPerson> = Object.fromEntries(familyMapPeople.map(p => [p.id, p]));
export const mapProfileUrl = (id: string) => sharedPeople.some(p=>p.id===id)
  ? personUrl(id) : `/family/#${familyMapById[id]?.kind === 'unknown' ? `map-${id}` : `person-${id}`}`;
export const mapPersonLabel = (id: string) => id === ADAM ? 'Adam Muncie (Tom)'
  : familyMapById[id].kind === 'unknown' ? `? · ${familyMapById[id].aliases[0]}` : familyMapById[id].name;
export function searchFamilyMap(query: string) {
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const words = normalize(query).trim().split(/\s+/);
  return familyMapPeople.filter(p => words.every(word => normalize(`${mapPersonLabel(p.id)} ${p.aliases.join(' ')} ${p.dates}`).includes(word)));
}
// A finite bound from the data keeps All ancestors complete as the tree grows.
export const familyMapAncestorDepth = confirmed.length;
export const mapSource = (id: string) => familyMapById[id].kind === 'unknown'
  ? 'No supported parent connection established for this position.'
  : 'Included through supported evidence or direct family testimony. Individual dates and other profile claims may remain unresolved.';
