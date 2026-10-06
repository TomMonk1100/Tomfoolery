import index from './shared-family-index.json';
import { personById as researchById } from './family';
export interface SharedPerson { id: string; uuid: string; name: string; dates: string; aliases: string[]; parents: string[]; partners: string[]; children: string[]; gender: string }
export interface SharedFamily { id: string; name: string; dates: string; parents: string[]; children: string[] }
export const sharedPeople: SharedPerson[] = index.people;
export const sharedFamilies: SharedFamily[] = index.families;
export const sharedCounts = index.counts;
export const sharedById: Record<string, SharedPerson> = Object.fromEntries(sharedPeople.map(p => [p.id, p]));
export const KEVIN = 'mft-d2d82be3-cae8-42fd-8101-a809ceaf50d2';
export const ADAM = 'mft-35dc6a96-d08a-4625-8252-2e6ab3b6796b';
export const PATRICK = 'mft-58e475c7-22e9-4753-b563-8b06c4ff2dc5';
export const MARK = 'mft-ec434d2f-e202-4a58-a16f-608ccd3d6fe7';
export const GLORIA = 'mft-081b6b3e-fe93-43f0-b44e-f2ef23d34738';
export const FRED_RICHARD = 'mft-9a062353-8ce3-4bd7-9d22-0f7860e861f4';
export const personUrl = (id: string) => `/family/person/${id}/`;
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
export function searchSharedPeople(query: string) {
  const words = normalize(query).trim().split(/\s+/);
  return sharedPeople.filter(p => words.every(w => normalize(`${p.name} ${p.aliases.join(' ')} ${researchById[p.id]?.aliases.join(' ') || ''} ${p.id === ADAM ? 'Adam Muncie Tom Tom Muncie' : ''} ${p.dates}`).includes(w)));
}
