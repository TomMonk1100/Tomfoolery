// Research assessments are overlays; the imported parent assertions remain intact.
export interface RelationshipReview {
  parent: string;
  child: string;
  confidence: 'provisional';
  finding: string;
}
export const relationshipReviews: RelationshipReview[] = [
  {parent:'mft-807ec9be-5d73-4829-841b-ef6f291c5a7f',child:'mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47',confidence:'provisional',finding:'needles-william-identity-conflict'},
  {parent:'mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47',child:'mft-839c0600-46b6-4cc8-b075-d01d833d4564',confidence:'provisional',finding:'needles-william-identity-conflict'},
];
export const relationshipReview = (parent:string,child:string) => relationshipReviews.find(r=>r.parent===parent&&r.child===child);
