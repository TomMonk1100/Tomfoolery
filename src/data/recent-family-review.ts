// Server-side audit: the full source archive must not enter the map's browser bundle.
import { sharedById, PATRICK, FRED_RICHARD } from './shared-family';
import { sharedRecords } from './shared-family-records';
import { familyMapAncestryById } from './family-map';
export function recentGenerations(root:string, generation:number, people=sharedById) {
  const rows:{id:string;generation:number}[]=[];
  const visit=(id:string,g:number,path:Set<string>)=>{
    if(g>5 || path.has(id) || !people[id])return;
    rows.push({id,generation:g});
    for(const parent of people[id].parents)visit(parent,g+1,new Set([...path,id]));
  };
  visit(root,generation,new Set());return rows;
}
export const stockwellReview=recentGenerations(PATRICK,1);
export const muncieReview=recentGenerations(FRED_RICHARD,2,familyMapAncestryById);
export function importedSourceInventory(id:string) {
  const cards=sharedRecords[`person:${id}`]?.sections.find(s=>s.title==='Source Citations')?.cards || [];
  const collections=[...new Map(cards.map(c=>[c.name,{name:c.name,url:c.url}])).values()];
  return {references:cards.length,collections};
}
export const recentRecordTargets = [
  {name:'Mark → Dorothy Macy / Eugene Leslie', target:'Mark’s 1940 Indiana birth certificate. Then the couple’s marriage record and 1940 Indianapolis census; Dorothy’s imported citation identifies ED 96-202, sheet 5B.', limit:'Parent names and surname history remain uncorroborated by an inspected original.'},
  {name:'Gloria → Eugene Brown / Eleene White', target:'Gloria’s 1940 birth record and her parents’ marriage record; compare the 1940 and 1950 households.', limit:'Imported parent assignments need originals identifying this child and couple.'},
  {name:'Dorothy → Curtis Macy / Inez Beeler', target:'Dorothy’s 1919 birth record and the Macy household in the 1920 Guilford, Hendricks County census.', limit:'Census and birth references are leads until their images have been read.'},
  {name:'Eugene Leslie → Harry Leslie / Ida Brechbiel', target:'Eugene’s 1919 birth record, the 1920 household and Ida’s obituary in the Logansport Pharos-Tribune, 26 October 1959.', limit:'A same-name obituary dated 2008 is only a lead; it does not name these parents.'},
  {name:'Eugene Brown → Hienz Brown / Mary Sterling', target:'Eugene’s 1916 birth record and the 1920 Wortham, Freestone County census, ED 22, page 7B.', limit:'Check the named child against the household; do not assume a surname match proves descent.'},
  {name:'Eleene White → Henry White / Velma Miller', target:'Eleene’s 1921 birth record and the White household in the 1930 census.', limit:'Both parent assignments need an independently inspected relationship record.'},
  {name:'Fred Richard → Fred Victor / Luneta Mae', target:'Fred Richard’s 1938 Ohio birth record and his parents’ 16 March 1938 Franklin County marriage record.', limit:'The inspected 1940 household supports the couple provisionally, without directly naming this child’s parents.'},
  {name:'Luneta → ? / ?', target:'The same 1938 marriage original, followed by her birth record and 1930 household.', limit:'Both parents are unknown; conflicting birth years remain unresolved.'},
];
