import type { SharedPerson } from './shared-family';

// These are sourced hypotheses, never replacements for imported identities.
export const HENRY_GOTHAM = 'mft-fa80c8f6-5cd2-4356-91af-bc2f56f540b8';
export const ANDREA_GOTHAM = 'candidate-andrea-degotham';
export const candidatePeople: SharedPerson[] = [{
  id: ANDREA_GOTHAM, uuid: ANDREA_GOTHAM, name: 'Andrea deGotham',
  dates: '1217? · contributor-tree claim', aliases: [], gender: '',
  parents: [], partners: [], children: [HENRY_GOTHAM],
}];
export const candidateRelationships = [{
  from: ANDREA_GOTHAM, to: HENRY_GOTHAM, confidence: 'provisional' as const,
  finding: 'gotham-andrea-parent-candidate',
  note: 'WikiTree names Andrea as Henry’s father. Only contributor-tree citations are supplied; neither parentage nor identity with the imported Henry has been independently established.',
  url: 'https://www.wikitree.com/wiki/DeGotham-11',
}];
export const candidateById = Object.fromEntries(candidatePeople.map(p => [p.id, p]));
