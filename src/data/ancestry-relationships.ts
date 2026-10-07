// Research assessments are overlays; the imported parent assertions remain intact.
export interface RelationshipReview {
  parent: string;
  child: string;
  confidence: 'provisional';
  finding: string;
}
export const relationshipReviews: RelationshipReview[] = [
  {parent:'mft-60355500-acbb-45ac-8285-53029c447596',child:'p036',confidence:'provisional',finding:'harry-leslie-parents-1900'},
  {parent:'mft-e89f1d73-f867-43b4-9e50-39fa59ca56f1',child:'mft-45146b40-d146-4f78-8e21-0500f316cb5d',confidence:'provisional',finding:'eugene-leslie-household-1920'},
  {parent:'mft-fffbc6f3-d024-471f-8141-8ccb93b27ba5',child:'mft-45146b40-d146-4f78-8e21-0500f316cb5d',confidence:'provisional',finding:'eugene-leslie-household-1920'},
  {parent:'mft-b83d2726-4a9f-4e9f-bceb-e4e0e98ed168',child:'mft-6ee470e8-d907-4ed6-ad3b-b9847730c160',confidence:'provisional',finding:'curtis-inez-marriage-1916'},
  {parent:'mft-dfb0638d-604b-4212-8073-5c69dce4949c',child:'mft-1bc0d47f-abff-45be-a21c-1ba082f928cf',confidence:'provisional',finding:'curtis-inez-marriage-1916'},
  {parent:'mft-45146b40-d146-4f78-8e21-0500f316cb5d',child:'mft-ec434d2f-e202-4a58-a16f-608ccd3d6fe7',confidence:'provisional',finding:'mark-stockwell-household-1950'},
  {parent:'mft-e562d673-0941-4d90-82d4-c747c5db6db3',child:'mft-1987620c-0044-4f35-9a91-1f3087279c84',confidence:'provisional',finding:'brown-original-parent-conflict'},
  {parent:'mft-ac18e21f-8562-4540-a292-0014f7848951',child:'mft-6e6822b7-100a-4225-8772-6f0893b9a5ad',confidence:'provisional',finding:'boyd-parent-date-conflict'},
  {parent:'mft-807ec9be-5d73-4829-841b-ef6f291c5a7f',child:'mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47',confidence:'provisional',finding:'needles-william-identity-conflict'},
  {parent:'mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47',child:'mft-839c0600-46b6-4cc8-b075-d01d833d4564',confidence:'provisional',finding:'needles-william-identity-conflict'},
];
export const relationshipReview = (parent:string,child:string) => relationshipReviews.find(r=>r.parent===parent&&r.child===child);
