// Server-side audit: the full source archive must not enter the map's browser bundle.
import { sharedById, PATRICK, FRED_RICHARD } from './shared-family';
import { sharedRecords } from './shared-family-records';
import { familyMapAncestryById } from './family-map';
import { ancestryFindings } from './ancestry-research';
export function recentGenerations(root:string, generation:number, people=sharedById, maximum=6) {
  const rows:{id:string;generation:number}[]=[];
  const visit=(id:string,g:number,path:Set<string>)=>{
    if(g>maximum || path.has(id) || !people[id])return;
    rows.push({id,generation:g});
    for(const parent of people[id].parents)visit(parent,g+1,new Set([...path,id]));
  };
  visit(root,generation,new Set());return rows;
}
export const stockwellReview=recentGenerations(PATRICK,1);
export const maternalReview=recentGenerations('mft-977e3680-c40d-4c6c-aade-3562855e3e99',1,familyMapAncestryById);
export const muncieReview=recentGenerations(FRED_RICHARD,2,familyMapAncestryById);
export function importedSourceInventory(id:string) {
  const cards=sharedRecords[`person:${id}`]?.sections.find(s=>s.title==='Source Citations')?.cards || [];
  const collections=[...new Map(cards.map(c=>[c.name,{name:c.name,url:c.url}])).values()];
  return {references:cards.length,collections};
}
export const recentRecordTargets = [
  {name:'Mark → Dorothy Macy / Eugene Leslie', target:'Mark’s 1940 Indiana birth certificate. Compare Dorothy’s separate Stockwell and Leslie family records and 1940 Indianapolis census; Dorothy’s imported citation identifies ED 96-202, sheet 5B.', limit:'The inspected 1950 census calls Mark William R. Stockwell’s son; it does not settle biological paternity. The 1940 marriage index names Dorothy Macy and Eugene Leslie as a couple, but does not prove Mark’s paternity. Original marriage and birth images remain needed.'},
  {name:'Gloria → Eugene Brown / Eleene White', target:'Gloria’s 1940 birth record and her parents’ marriage record; compare the 1940 and 1950 households.', limit:'Imported parent assignments need originals identifying this child and couple.'},
  {name:'Dorothy → Curtis Macy / Inez Beeler', target:'Dorothy’s birth record and original Social Security application; the 1920 Macy household and 1916 Curtis/Inez marriage are now inspected.', limit:'Her application index reports 1917, while the import and nine-month age in 1920 favor 1919. The conflict remains open.'},
  {name:'Curtis / Inez → fifth-generation parents', target:'Curtis’s birth record, Samuel/Luella’s 1890 marriage and Inez’s birth record; compare the parent names in the original 1916 marriage.', limit:'Curtis names Martha Collins rather than Luella M. Collins; Inez names Henry Beeler rather than William H. Beeler. Possible name variants remain unproved.'},
  {name:'Eugene Leslie → Harry Leslie / Ida Brechbiel', target:'Eugene’s birth record and original draft card; the uploaded 1943 marriage certificate, Wyoming archive index card and original 1920 household are now inspected. Compare the 1940 household and Ida’s 26 October 1959 Logansport obituary.', limit:'The certificate names Harry C. Leslie and Ida May Brechbiel, corroborating Ida’s maiden surname. The imported 1919 birthday and census age still conflict; the photographed marriage age digit needs a clearer copy.'},
  {name:'Eugene Brown → Hienz Brown / Mary Sterling', target:'Eugene’s 1916 birth record and the 1920 Wortham, Freestone County census, ED 22, page 7B.', limit:'Check the named child against the household; do not assume a surname match proves descent.'},
  {name:'Eleene White → Henry White / Velma Miller', target:'Eleene’s 1921 birth record and the White household in the 1930 census.', limit:'Both parent assignments need an independently inspected relationship record.'},
  {name:'Fred Richard → Fred Victor / Luneta Mae', target:'Fred Richard’s 1938 Ohio birth record ; his parents’ 1938 marriage original is now inspected.', limit:'The inspected 1940 household supports the couple provisionally, without directly naming this child’s parents.'},
  {name:'Luneta → Earl Etling / Blanche Taladay', target:'Luneta’s birth record, Earl’s Pennsylvania birth image and Blanche/Belle’s Ohio birth record; the 1900 Etling and 1910 Talada households are now inspected.', limit:'Parents are now corroborated by marriage, census and application records; her birth year and their exact dates remain unresolved.'},
];


// Each row states the particular claim checked, rather than treating every
// finding mentioning a person as proof of that person's parents.
type RecentAssessment = { note: string; findings: string[] };
const recentAssessments: Record<string, RecentAssessment> = {
  'mft-5141f558-0dac-4850-9878-246f3c464bff': {note:'Tom confirms Kenneth Crook and Winifred Chappell are Virginia’s biological parents. Original 1940 household corroborates the couple with baby Virginia; birth original not inspected.',findings:['tom-crook-parent-testimony','virginia-crook-household-1940']},
  'mft-977e3680-c40d-4c6c-aade-3562855e3e99': {note:'Tom confirms Wendy is his biological mother and Thomas/Virginia are her biological parents. Supported direct testimony; birth originals remain pending.',findings:['tom-close-biological-family-testimony']},
  'mft-081b6b3e-fe93-43f0-b44e-f2ef23d34738': {note:'Tom confirms Gloria is Patrick’s biological mother. Her own imported parents still need relationship records.',findings:['tom-close-biological-family-testimony']},
  'mft-664a7bfb-2b53-47fc-b977-114b40f8c371': {note:'Marriage index names Able/Pressilla; original 1880 household corroborates Abel/Priscilla with son William. Parent links supported; exact birthday remains unresolved.',findings:['william-louise-marriage-parents-1890']},
  'mft-b634a085-0249-4220-805e-85141e6876a3': {note:'Marriage index names Phillip/Elizabeth; original 1880 Rockbridge household corroborates both with daughter Louise. Parent links supported; surname variants retained.',findings:['william-louise-marriage-parents-1890']},
  p038: {note:'Father Abram and mother Lucretia are named in the death index, with a probable identity match. Own parental evidence remains open.',findings:['abel-reagles-death-parents-1906','abel-priscilla-marriage-1844']},
  p039: {note:'Original marriage confirms Priscilla E. Sippy. Death index names Joseph/Martha as parents; the 1884 printed biography independently corroborates both generation-six parents.',findings:['priscilla-sippy-biography-1884','priscilla-reagles-death-parents-1901','abel-priscilla-marriage-1844']},
  p040: {note:'Named as Louise’s father in the marriage index, corroborated by the original 1880 household. His own parents are unidentified.',findings:['william-louise-marriage-parents-1890']},
  p041: {note:'Named as Louise’s mother in the marriage index, corroborated by the original 1880 household. Her maiden surname and own parents remain unidentified.',findings:['william-louise-marriage-parents-1890']},
  p042: {note:'Indexed father of Abel; no original or independent parental identity record inspected.',findings:['abel-reagles-death-parents-1906']},
  p043: {note:'Indexed mother of Abel without surname; parental identity remains probable.',findings:['abel-reagles-death-parents-1906']},
  p044: {note:'Father of Priscilla, supported by the death index and independently inspected 1884 biography.',findings:['priscilla-sippy-biography-1884','priscilla-reagles-death-parents-1901']},
  p045: {note:'Mother of Priscilla, supported by two sources; the 1884 biography reports Cogswell as her maiden surname.',findings:['priscilla-sippy-biography-1884','priscilla-reagles-death-parents-1901']},
  'mft-e238c8e7-0773-4a8b-a850-9c705c1699f3': {note:'His own application index names Donald Reagles and Dora Webster, corroborated by the original 1940 household and exact imported birth/death dates.',findings:['thomas-reagles-application-parents']},
  'mft-df1cc011-4357-42cc-ad5f-26c8d2a20658': {note:'Birth index names William Shakespear Reagles and Louise Scholl, corroborated by the original 1910 household; birth original unavailable.',findings:['donald-reagles-birth-parents-1904','thomas-reagles-application-parents']},
  'mft-fdad09b4-49fd-48c6-86c3-486c2becefb0': {note:'Named as Thomas’s parent in his application, corroborated by original 1940 household. Her own mother is missing; Clara Hickcox remains an uninspected locator lead.',findings:['thomas-reagles-application-parents']},
  "mft-45146b40-d146-4f78-8e21-0500f316cb5d": {"note": "The inspected 1943 marriage certificate names Harry C. Leslie and Ida May Brechbiel, corroborating the 1920 household and Ida’s maiden surname. Its age digit needs archival comparison, and the imported birthday conflicts with the census; identity matches remain probable. Neither marriage proves Mark’s paternity.", "findings": ["eugene-leslie-marriage-parents-1943", "eugene-leslie-household-1920", "dorothy-eugene-marriage-1940"]},
  "mft-58e475c7-22e9-4753-b563-8b06c4ff2dc5": {"note": "Mark is Patrick’s biological father, confirmed by Tom; original birth record pending.", "findings": ["patrick-biological-and-raised-family"]},
  "mft-ec434d2f-e202-4a58-a16f-608ccd3d6fe7": {"note": "The 1950 household names William and Dorothy Stockwell; the 1940 marriage index names Dorothy and Eugene Leslie. Mark’s biological father remains unresolved.", "findings": ["mark-stockwell-household-1950", "dorothy-eugene-marriage-1940"]},
  "mft-ee6ed11d-2031-451f-823a-5362114e84a6": {"note": "Own application index names Curtis Macy and Inez Beeler, corroborated by the original 1920 household. Dorothy’s birth year conflicts (1917 / 1919).", "findings": ["dorothy-application-parents", "macy-household-1920"]},
  "mft-6ee470e8-d907-4ed6-ad3b-b9847730c160": {"note": "Original 1916 marriage names S. A. Macy and Martha Collins. Samuel is corroborated by 1900 and 1920 households; Martha / Luella identity remains unresolved.", "findings": ["curtis-inez-marriage-1916", "curtis-childhood-household-1900", "macy-household-1920"]},
  "mft-1bc0d47f-abff-45be-a21c-1ba082f928cf": {"note": "Original 1916 marriage names Henry Beeler and Francis Hale. Frances is a probable match; Henry / William H. identity remains unresolved.", "findings": ["curtis-inez-marriage-1916"]},
  "mft-f696f570-fdf7-45c5-802d-d20cdd293a34": {"note": "Samuel is named as Curtis’s father in the 1920 original and probably as S. A. in the 1916 marriage. Samuel’s own parentage still needs inspection.", "findings": ["macy-household-1920", "curtis-childhood-household-1900", "curtis-inez-marriage-1916"]},
  "mft-b83d2726-4a9f-4e9f-bceb-e4e0e98ed168": {"note": "Luella is Samuel’s wife in 1900 and 1920, with one child reported in 1900; Curtis names mother Martha Collins in 1916. Biological maternity and name identity remain unresolved.", "findings": ["curtis-inez-marriage-1916", "curtis-childhood-household-1900"]},
  "mft-dfb0638d-604b-4212-8073-5c69dce4949c": {"note": "Inez’s 1916 application names Henry Beeler. Matching him to imported William H. Beeler still needs evidence.", "findings": ["curtis-inez-marriage-1916"]},
  "mft-29daa386-7685-4031-8e46-859662836d52": {"note": "Francis Hale is named as Inez’s mother in her original 1916 marriage. The match to imported Frances is probable; her own biography is not yet corroborated.", "findings": ["curtis-inez-marriage-1916"]},
  "mft-e562d673-0941-4d90-82d4-c747c5db6db3": {"note": "Contradicted maternity: death certificate and application index name Lacy, corroborated by the original 1900 household.", "findings": ["brown-original-parent-conflict"]},
  "mft-0409914c-16fd-4485-baaa-31083b6a4b01": {"note": "Parents corroborated by 1938 marriage, 1930 census and own application index; birth year disputed.", "findings": ["fred-mae-marriage-1938", "luneta-recorded-parents", "luneta-household-1930"]},
  "p001": {"note": "Palmiero / Paul is Fred’s probable father from the original marriage and county alias certificate.", "findings": ["fred-mae-marriage-1938"]},
  "p002": {"note": "Emma’s son Fred is named in the inspected 1940 census. The surname variants and Italian identity remain under review.", "findings": ["muncie-close-household-1940", "fred-mae-marriage-1938"]},
  "mft-9a062353-8ce3-4bd7-9d22-0f7860e861f4": {"note": "Raised Patrick, confirmed by Tom. Own parents remain a probable household inference; direct birth evidence pending.", "findings": ["patrick-biological-and-raised-family", "muncie-close-household-1940"]},
  "p024": {"note": "Earl’s 1920 marriage, original 1900 household and birth index corroborate the parent names. Exact identities remain probable; Earl’s 1897 / 1898 year conflicts.", "findings": ["earl-childhood-parent-corroboration", "earl-belle-marriage-1920"]},
  "p026": {"note": "Earl’s 1920 marriage, original 1900 household and birth index corroborate the parent names. Exact identities remain probable; Earl’s 1897 / 1898 year conflicts.", "findings": ["earl-childhood-parent-corroboration", "earl-belle-marriage-1920"]},
  "p027": {"note": "Earl’s 1920 marriage, original 1900 household and birth index corroborate the parent names. Exact identities remain probable; Earl’s 1897 / 1898 year conflicts.", "findings": ["earl-childhood-parent-corroboration", "earl-belle-marriage-1920"]},
  "p025": {"note": "Belle’s marriage names R. G. Taladay and May Armstrong; the 1910 Ralph / May household is a probable match. Blanche’s age conflicts, so identity remains under review.", "findings": ["blanche-childhood-parent-corroboration", "earl-belle-marriage-1920"]},
  "p028": {"note": "Belle’s marriage names R. G. Taladay and May Armstrong; the 1910 Ralph / May household is a probable match. Blanche’s age conflicts, so identity remains under review.", "findings": ["blanche-childhood-parent-corroboration", "earl-belle-marriage-1920"]},
  "p029": {"note": "Belle’s marriage names R. G. Taladay and May Armstrong; the 1910 Ralph / May household is a probable match. Blanche’s age conflicts, so identity remains under review.", "findings": ["blanche-childhood-parent-corroboration", "earl-belle-marriage-1920"]},
  "p022": {"note": "Named in the child’s Ohio death certificate; Italian identity and record matches remain under review.", "findings": []},
  "p023": {"note": "Named in the child’s Ohio death certificate; Italian identity and record matches remain under review.", "findings": []},
  "p008": {"note": "Named in the child’s Ohio death certificate; Italian identity and record matches remain under review.", "findings": []},
  "p009": {"note": "Named in the child’s Ohio death certificate; Italian identity and record matches remain under review.", "findings": []},
};
export function recentEvidenceAssessment(id:string) {
  const review = recentAssessments[id] || { note:'Original relationship evidence still needs inspection.', findings:[] };
  return { note:review.note, findings:review.findings.map(key=>ancestryFindings.find(f=>f.id===key)).filter((f):f is (typeof ancestryFindings)[number]=>!!f) };
}
