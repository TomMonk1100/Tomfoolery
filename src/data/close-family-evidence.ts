import { MARK, PATRICK, FRED_RICHARD, ADAM } from './shared-family';
export const upbringing = {
  biologicalFather: MARK, child: PATRICK, raisedBy: FRED_RICHARD,
  citation: 'Adam (Tom) Muncie, direct family testimony, 6 October 2026: “Mark is my dads biological dad but Fred Richard Muncie raised him”.',
  note: 'Tom confirms that Mark is Patrick’s biological father and Fred Richard Muncie raised Patrick. This records the family’s account; no legal adoption is inferred.',
};
export const upbringingPeople = [ADAM, PATRICK, MARK, FRED_RICHARD];

// Independently inspected records assess imported links and can add a recorded
// partnership without rewriting the original family export.
export interface CloseFamilyRelationship {
  from: string; to: string; kind: 'parent' | 'partner';
  confidence: 'supported' | 'probable';
  sourceKind: 'original record' | 'official index'; finding: string; note: string;
}
export const closeFamilyRelationships: CloseFamilyRelationship[] = [
  {"from": "mft-6ee470e8-d907-4ed6-ad3b-b9847730c160", "to": "mft-ee6ed11d-2031-451f-823a-5362114e84a6", "kind": "parent", "confidence": "probable", "sourceKind": "official index", "finding": "dorothy-application-parents", "note": "Dorothy’s own application index names Curtis L. Macy and Inez Beeler, corroborated by the 1920 household; her indexed birth year conflicts."},
  {"from": "mft-1bc0d47f-abff-45be-a21c-1ba082f928cf", "to": "mft-ee6ed11d-2031-451f-823a-5362114e84a6", "kind": "parent", "confidence": "probable", "sourceKind": "official index", "finding": "dorothy-application-parents", "note": "Dorothy’s own application index names Inez Beeler and Curtis L. Macy; the original 1920 household corroborates a probable identity match."},
  {"from": "mft-b83d2726-4a9f-4e9f-bceb-e4e0e98ed168", "to": "mft-6ee470e8-d907-4ed6-ad3b-b9847730c160", "kind": "parent", "confidence": "probable", "sourceKind": "original record", "finding": "macy-household-1920", "note": "Luella is Samuel’s wife and Curtis his son in 1920; biological maternity is a probable household inference, pending a direct parental record."},
  {"from": "mft-45146b40-d146-4f78-8e21-0500f316cb5d", "to": "mft-ee6ed11d-2031-451f-823a-5362114e84a6", "kind": "partner", "confidence": "probable", "sourceKind": "official index", "finding": "dorothy-eugene-marriage-1940", "note": "The Indiana marriage index names Eugene Howard Leslie and wife Dorothy D. Macy, 11 May 1940. Original image not inspected; matching these names to the imported couple remains probable. This does not prove Mark’s paternity."},
  {"from": "mft-f696f570-fdf7-45c5-802d-d20cdd293a34", "to": "mft-6ee470e8-d907-4ed6-ad3b-b9847730c160", "kind": "parent", "confidence": "probable", "sourceKind": "original record", "finding": "curtis-inez-marriage-1916", "note": "Curtis names S. A. Macy in his original 1916 application; the 1920 original names Curtis as Samuel A. Macy’s son. Matching these identities is probable."},
  {"from": "mft-29daa386-7685-4031-8e46-859662836d52", "to": "mft-1bc0d47f-abff-45be-a21c-1ba082f928cf", "kind": "parent", "confidence": "probable", "sourceKind": "original record", "finding": "curtis-inez-marriage-1916", "note": "Inez’s original 1916 marriage application names mother Francis Hale and reports the same birthday as the import. Identity match to Frances Hale remains probable."},
];
