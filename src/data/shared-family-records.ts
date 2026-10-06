import data from './shared-family-records.json';
export interface SharedLink { name: string; url: string }
export interface SharedField { label: string; value: string; confidence:'supported'; sourceKind:'compiled genealogy'; links: SharedLink[] }
export interface SharedSection { title: string; text: string; fields: SharedField[]; cards: {name:string;url:string;fields:SharedField[]}[] }
export interface SharedRecord { id: string; uuid: string; kind: string; title: string; dates: string; originalUrl: string; images: string[]; sections: SharedSection[] }
export const sharedRecords = data as unknown as Record<string, SharedRecord>;
export const recordUrl = (r: SharedRecord) => r.kind === 'person' ? `/family/person/${r.id}/` : `/family/record/${r.kind}/${r.id}/`;
