import type { SharedPerson } from './shared-family';

// These are sourced hypotheses, never replacements for imported identities.
export const HENRY_GOTHAM = 'mft-fa80c8f6-5cd2-4356-91af-bc2f56f540b8';
export const ANDREA_GOTHAM = 'candidate-andrea-degotham';
export const NEWMAN_PRATHER = 'mft-a87ffd54-6551-42c3-9390-4c0c2dffc6d9';
export const JOSIAH_PRATHER = 'candidate-josiah-prather';
export const JOHN_SMITH_PRATHER = 'candidate-john-smith-prather';
export const ELIZABETH_NUTHALL = 'candidate-elizabeth-nuthall';
const pratherSource = 'https://multiwords.de/genealogy/Pr10%20Thomas%20Prather.html';
export const candidatePeople: SharedPerson[] = [{
  id: ANDREA_GOTHAM, uuid: ANDREA_GOTHAM, name: 'Andrea deGotham',
  dates: '1217? · contributor-tree claim', aliases: [], gender: '',
  parents: [], partners: [], children: [HENRY_GOTHAM],
}, {
  id: JOSIAH_PRATHER, uuid: JOSIAH_PRATHER, name: 'Josiah Prather',
  dates: '1727?–about 1755? · compiled claim', aliases: [], gender: '',
  parents: [], partners: [], children: [NEWMAN_PRATHER],
}, {
  id: JOHN_SMITH_PRATHER, uuid: JOHN_SMITH_PRATHER, name: 'John Smith Prather',
  dates: 'about 1705?–1763? · compiled claim', aliases: [], gender: '',
  parents: [], partners: [], children: [JOSIAH_PRATHER],
}, {
  id: ELIZABETH_NUTHALL, uuid: ELIZABETH_NUTHALL, name: 'Elizabeth Nuthall',
  dates: 'Dates not established', aliases: [], gender: '',
  parents: [], partners: [], children: [JOSIAH_PRATHER],
}];
export const candidateRelationships = [{
  from: ANDREA_GOTHAM, to: HENRY_GOTHAM, confidence: 'provisional' as const,
  finding: 'gotham-andrea-parent-candidate',
  note: 'WikiTree names Andrea as Henry’s father. Only contributor-tree citations are supplied; neither parentage nor identity with the imported Henry has been independently established.',
  url: 'https://www.wikitree.com/wiki/DeGotham-11',
}, {
  from: JOSIAH_PRATHER, to: NEWMAN_PRATHER, confidence: 'provisional' as const,
  finding: 'prather-josiah-parent-candidate',
  note: 'Compiled pedigree parent claim; the match to this imported family remains tentative because related dates conflict. See the evidence review.',
  url: pratherSource,
}, ...[JOHN_SMITH_PRATHER, ELIZABETH_NUTHALL].map(from => ({
  from, to: JOSIAH_PRATHER, confidence: 'provisional' as const,
  finding: 'prather-josiah-parent-candidate',
  note: 'Compiled pedigree parent claim, conditional on the unresolved Newman/Josiah identity match. Original parish or probate records have not been inspected.',
  url: pratherSource,
}))];
export const candidateById = Object.fromEntries(candidatePeople.map(p => [p.id, p]));
