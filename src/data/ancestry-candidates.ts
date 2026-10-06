import type { SharedPerson } from './shared-family';

// These are sourced hypotheses, never replacements for imported identities.
export const HENRY_GOTHAM = 'mft-fa80c8f6-5cd2-4356-91af-bc2f56f540b8';
export const ANDREA_GOTHAM = 'candidate-andrea-degotham';
export const NEWMAN_PRATHER = 'mft-a87ffd54-6551-42c3-9390-4c0c2dffc6d9';
export const JOSIAH_PRATHER = 'candidate-josiah-prather';
export const JOHN_SMITH_PRATHER = 'candidate-john-smith-prather';
export const ELIZABETH_NUTHALL = 'candidate-elizabeth-nuthall';
const pratherSource = 'https://multiwords.de/genealogy/Pr10%20Thomas%20Prather.html';
const initialCandidates: SharedPerson[] = [{
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
const initialRelationships = [{
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

// Continue one sourced route toward the older English pedigrees. Dates remain
// broad where the compilations disagree; every edge is conditional/provisional.
export const THOMAS_PRATHER = 'candidate-thomas-mackay-prather';
export const MARTHA_SPRIGG = 'candidate-martha-sprigg';
export const THOMAS_SPRIGG = 'candidate-thomas-sprigg-immigrant';
export const ELEANOR_NUTHALL = 'candidate-eleanor-nuthall-sprigg';
export const JOHN_CROSS_MANOR = 'candidate-john-nuthall-cross-manor';
export const ELIZABETH_BACON = 'candidate-elizabeth-bacon-nuthall';
export const JOHN_CATTENHALL = 'candidate-john-nuthall-cattenhall';
export const MARY_HYDE = 'candidate-mary-hyde-nuthall';
export const ROBERT_HYDE = 'candidate-robert-hyde-norbury';
export const BEATRIX_CALVERLEY = 'candidate-beatrix-calverley-hyde';
export const ROBERT_HYDE_ELDER = 'candidate-robert-hyde-elder-norbury';
export const JANE_DAVENPORT = 'candidate-jane-davenport-hyde';
export const HAMNET_HYDE = 'candidate-hamnet-hyde-norbury';
export const MARGARET_WARREN = 'candidate-margaret-warren-hyde';
export const LAWRENCE_WARREN = 'candidate-lawrence-warren-poynton';
export const WILLIAM_DAVENPORT = 'candidate-william-davenport-bramhall';
export const WILLIAM_CALVERLEY = 'candidate-william-calverley-yorkshire';
export const MARGARET_LEGH = 'candidate-margaret-legh-warren';
export const PIERS_LEGH = 'candidate-piers-legh-lyme';
export const ELEANOR_SAVAGE = 'candidate-eleanor-savage-legh';
export const JOHN_SAVAGE = 'candidate-john-savage-clifton';
export const KATHERINE_STANLEY = 'candidate-katherine-stanley-savage';
export const THOMAS_STANLEY = 'candidate-thomas-stanley-first-lord';
export const JOAN_GOUSHILL = 'candidate-joan-goushill-stanley';
export const ROBERT_GOUSHILL = 'candidate-robert-goushill';
export const ELIZABETH_FITZALAN = 'candidate-elizabeth-fitzalan-goushill';
export const RICHARD_FITZALAN = 'candidate-richard-fitzalan-arundel';
export const ELIZABETH_BOHUN = 'candidate-elizabeth-bohun-fitzalan';
export const WILLIAM_BOHUN = 'candidate-william-bohun-northampton';
export const ELIZABETH_BADLESMERE = 'candidate-elizabeth-badlesmere-bohun';
export const HUMPHREY_BOHUN = 'candidate-humphrey-bohun-hereford';
export const ELIZABETH_RHUDDLAN = 'candidate-elizabeth-rhuddlan';
export const EDWARD_I = 'candidate-edward-i-england';
export const ELEANOR_CASTILE = 'candidate-eleanor-castile';
const extensions = [
  [MARGARET_LEGH,'Margaret Legh of Lyme (Warren)','late 15th–early 16th century · pedigree claim'],
  [PIERS_LEGH,'Sir Piers Legh of Lyme','15th century · visitation pedigree'],
  [ELEANOR_SAVAGE,'Eleanor Savage (Legh)','15th century · visitation pedigree'],
  [JOHN_SAVAGE,'Sir John Savage of Clifton','15th century · visitation pedigree'],
  [KATHERINE_STANLEY,'Katherine Stanley (Savage)','15th century · pedigree claim'],
  [THOMAS_STANLEY,'Thomas Stanley, 1st Lord Stanley','15th century · compiled pedigree'],
  [JOAN_GOUSHILL,'Joan Goushill (Stanley)','15th century · compiled pedigree'],
  [ROBERT_GOUSHILL,'Sir Robert Goushill','late 14th–early 15th century · compiled pedigree'],
  [ELIZABETH_FITZALAN,'Elizabeth Fitzalan (Goushill)','late 14th–early 15th century · compiled pedigree'],
  [RICHARD_FITZALAN,'Richard Fitzalan, Earl of Arundel','14th century · compiled pedigree'],
  [ELIZABETH_BOHUN,'Elizabeth de Bohun (Fitzalan)','14th century · compiled pedigree'],
  [WILLIAM_BOHUN,'William de Bohun, Earl of Northampton','14th century · compiled pedigree'],
  [ELIZABETH_BADLESMERE,'Elizabeth de Badlesmere (Bohun)','14th century · compiled pedigree'],
  [HUMPHREY_BOHUN,'Humphrey de Bohun, Earl of Hereford','late 13th–early 14th century · compiled pedigree'],
  [ELIZABETH_RHUDDLAN,'Elizabeth of Rhuddlan','1282–1316 · royal pedigree'],
  [EDWARD_I,'Edward I of England','13th–early 14th century · royal pedigree'],
  [ELEANOR_CASTILE,'Eleanor of Castile','13th century · royal pedigree'],
  [ROBERT_HYDE_ELDER,'Robert Hyde of Norbury (elder)','16th century · visitation pedigree'],
  [JANE_DAVENPORT,'Jane Davenport (Hyde)','16th century · visitation pedigree'],
  [HAMNET_HYDE,'Hamnet Hyde of Norbury','early 16th century · visitation pedigree'],
  [MARGARET_WARREN,'Margaret Warren (Hyde)','early 16th century · visitation pedigree'],
  [LAWRENCE_WARREN,'Lawrence Warren of Poynton','Dates not established · visitation pedigree'],
  [WILLIAM_DAVENPORT,'William Davenport of Bramhall','Dates not established · visitation pedigree'],
  [WILLIAM_CALVERLEY,'William Calverley of Yorkshire','Dates not established · visitation pedigree'],
  [THOMAS_PRATHER,'Thomas MacKay Prather','about 1673?–1712? · compiled claim'],
  [MARTHA_SPRIGG,'Martha Sprigg','about 1677?–1742? · compiled claim'],
  [THOMAS_SPRIGG,'Thomas Sprigg of Northampton','about 1630?–1704? · compiled claim'],
  [ELEANOR_NUTHALL,'Eleanor Nuthall (Sprigg)','17th century · dates disputed'],
  [JOHN_CROSS_MANOR,'John Nuthall of Cross Manor','early 17th century–1667? · identity disputed'],
  [ELIZABETH_BACON,'Elizabeth Bacon (Nuthall)','17th century · dates not established'],
  [JOHN_CATTENHALL,'John Nuthall of Cattenhall','late 16th–17th century · candidate identity'],
  [MARY_HYDE,'Mary Hyde (Nuthall)','late 16th–17th century · candidate identity'],
  [ROBERT_HYDE,'Robert Hyde of Norbury','1543?–1614? · compiled claim'],
  [BEATRIX_CALVERLEY,'Beatrix Calverley (Hyde)','16th–17th century · dates disputed'],
];
const extensionClaims = [
  {parents:[MARGARET_LEGH],child:MARGARET_WARREN,
   finding:'warren-legh-mother-candidate',url:'https://www.multiwords.de/genealogy/Hy14HamnetHyde.htm',
   note:'A compiled Hyde pedigree names Margaret Legh as Margaret Warren’s mother. The scanned visitation shows Legh married to Lawrence but does not list the Hyde daughter. This identity and maternal assignment remain provisional.'},
  ...[
    {parents:[PIERS_LEGH,ELEANOR_SAVAGE],child:MARGARET_LEGH},
    {parents:[JOHN_SAVAGE,KATHERINE_STANLEY],child:ELEANOR_SAVAGE},
  ].map(c=>({...c,finding:'legh-savage-visitation-route',
    url:'https://archive.org/details/visitationchesh00fellgoog/page/n169/mode/1up',
    note:'Parent lines inspected in the printed Cheshire visitation of 1580, pp. 153 and 203–204. This English pedigree is a conditional route from Tom because the earlier American identity links remain disputed.'})),
  ...[
    {parents:[THOMAS_STANLEY,JOAN_GOUSHILL],child:KATHERINE_STANLEY,url:'https://www.thepeerage.com/p70924.htm#i709239'},
    {parents:[ROBERT_GOUSHILL,ELIZABETH_FITZALAN],child:JOAN_GOUSHILL,url:'https://www.thepeerage.com/p1385.htm#i13849'},
    {parents:[RICHARD_FITZALAN,ELIZABETH_BOHUN],child:ELIZABETH_FITZALAN,url:'https://www.thepeerage.com/p196.htm#i1959'},
  ].map(c=>({...c,finding:'stanley-goushill-fitzalan-route',
    note:'An identified compiled peerage supplies this parent claim and cites published genealogies. The cited books and original records are not inspected here; Tom’s descent remains conditional on the earlier disputed bridges.'})),
  ...[
    {parents:[WILLIAM_BOHUN,ELIZABETH_BADLESMERE],child:ELIZABETH_BOHUN,url:'https://www.thepeerage.com/p10690.htm#i106899'},
    {parents:[HUMPHREY_BOHUN,ELIZABETH_RHUDDLAN],child:WILLIAM_BOHUN,url:'https://www.thepeerage.com/p10182.htm#i101816'},
    {parents:[EDWARD_I,ELEANOR_CASTILE],child:ELIZABETH_RHUDDLAN,url:'https://www.thepeerage.com/p10192.htm#i101916'},
  ].map(c=>({...c,finding:'bohun-edward-i-candidate-route',
    note:'The compiled royal pedigree explicitly names these parents and cites published works. This gives a candidate route to Edward I and Eleanor of Castile, not proof of Tom’s royal ancestry or a connection to biblical Adam and Eve.'})),

  ...[
    {parents:[ROBERT_HYDE_ELDER,JANE_DAVENPORT],child:ROBERT_HYDE},
    {parents:[HAMNET_HYDE,MARGARET_WARREN],child:ROBERT_HYDE_ELDER},
    {parents:[LAWRENCE_WARREN],child:MARGARET_WARREN},
    {parents:[WILLIAM_DAVENPORT],child:JANE_DAVENPORT},
    {parents:[WILLIAM_CALVERLEY],child:BEATRIX_CALVERLEY},
  ].map(c=>({...c,finding:'hyde-earlier-visitation-pedigree',
    url:'https://archive.org/details/recordsociety58recouoft/page/135/mode/1up',
    note:'Named in the printed Cheshire visitation pedigree, page 135. Matching these English identities to Tom remains conditional on the disputed immigrant bridge and the Newman/Josiah claim. Dates and unnamed mothers are not inferred.'})),
  {parents:[THOMAS_PRATHER,MARTHA_SPRIGG], child:JOHN_SMITH_PRATHER,
   finding:'prather-sprigg-parent-candidates',
   url:'https://www.ffish.com/family_tree/pedigrees/4068.htm',
   note:'Compiled pedigree and a quoted will abstract name this Prather family. The original will is uninspected and Tom’s route remains conditional on the Newman/Josiah match.'},
  {parents:[THOMAS_SPRIGG,ELEANOR_NUTHALL], child:MARTHA_SPRIGG,
   finding:'prather-sprigg-parent-candidates',
   url:'https://www.ffish.com/family_tree/pedigrees/4068.htm',
   note:'Compiled parent claim for Martha Sprigg; an abstract of Thomas Sprigg’s will also names daughter Martha Prather. Original documents remain to be checked.'},
  {parents:[JOHN_CROSS_MANOR,ELIZABETH_BACON], child:ELEANOR_NUTHALL,
   finding:'nuthall-cross-manor-candidates',
   url:'https://www.multiwords.de/genealogy/Nu9EleanorNuthall.html',
   note:'Compiled parent claim for Eleanor. Her dates vary across accounts; this is a conditional research route, not established descent.'},
  {parents:[JOHN_CATTENHALL,MARY_HYDE], child:JOHN_CROSS_MANOR,
   finding:'nuthall-english-parent-dispute',
   url:'https://www.multiwords.de/genealogy/Nu10JohnNUTHALL.html',
   note:'Disputed identity bridge from the Maryland immigrant to the English family. Other compilations assign James Nuthall and Jane Wiseman instead. No original baptism or identity proof inspected.'},
  {parents:[ROBERT_HYDE,BEATRIX_CALVERLEY], child:MARY_HYDE,
   finding:'hyde-norbury-parent-candidates',
   url:'https://www.multiwords.de/genealogy/Hy12RobertHyde.html',
   note:'Compiled parent claim for Mary Hyde. Conflicting dates and similarly named family members need comparison with the Cheshire visitation and parish records.'},
];
export const candidateRelationships = [...initialRelationships, ...extensionClaims.flatMap(c=>c.parents.map(from=>({
  from,to:c.child,confidence:'provisional' as const,finding:c.finding,note:c.note,url:c.url,
})))];
export const candidatePeople: SharedPerson[] = [...initialCandidates,...extensions.map(([id,name,dates])=>({
  id,uuid:id,name,dates,aliases:[],gender:'',parents:[],partners:[],
  children:candidateRelationships.filter(r=>r.from===id).map(r=>r.to),
}))];
export const candidateById = Object.fromEntries(candidatePeople.map(p => [p.id, p]));
