// Research assessments are overlays; the imported parent assertions remain intact.
export interface RelationshipReview {
  parent: string;
  child: string;
  confidence: 'provisional';
  finding: string;
}
export const relationshipReviews: RelationshipReview[] = [
  {parent:'mft-45146b40-d146-4f78-8e21-0500f316cb5d',child:'mft-ec434d2f-e202-4a58-a16f-608ccd3d6fe7',confidence:'provisional',finding:'mark-stockwell-household-1950'},
  {parent:'mft-e562d673-0941-4d90-82d4-c747c5db6db3',child:'mft-1987620c-0044-4f35-9a91-1f3087279c84',confidence:'provisional',finding:'brown-original-parent-conflict'},
  {parent:'mft-ac18e21f-8562-4540-a292-0014f7848951',child:'mft-6e6822b7-100a-4225-8772-6f0893b9a5ad',confidence:'provisional',finding:'boyd-parent-date-conflict'},
  {parent:'mft-807ec9be-5d73-4829-841b-ef6f291c5a7f',child:'mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47',confidence:'provisional',finding:'needles-william-identity-conflict'},
  {parent:'mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47',child:'mft-839c0600-46b6-4cc8-b075-d01d833d4564',confidence:'provisional',finding:'needles-william-identity-conflict'},
];
export const relationshipReview = (parent:string,child:string) => relationshipReviews.find(r=>r.parent===parent&&r.child===child);
