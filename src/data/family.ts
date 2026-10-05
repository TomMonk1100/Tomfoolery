// IDs are permanent. Names and conclusions may change without changing identity.
export type Confidence = 'supported' | 'probable' | 'provisional';
export type SourceKind = 'original record' | 'official index' | 'transcription' | 'compiled genealogy' | 'user supplied' | 'inference' | 'research guide';
export interface Source { id: string; title: string; kind: SourceKind; url?: string; citation: string; inspected: boolean }
export interface Fact { label: string; value: string; confidence: Confidence; sources: string[]; note?: string }
export interface Person { id: string; name: string; aliases: string[]; dates: string; facts: Fact[]; notes: string[]; provisional?: boolean }
export interface Relationship { id: string; from: string; to: string; kind: 'parent' | 'spouse' | 'sibling'; confidence: Confidence; sources: string[]; note: string }
export interface Branch { id: string; title: string; note?: string; people: string[]; relations?: string[]; children?: Branch[]; open?: boolean; provisional?: boolean }

export const sources: Source[] = [
  { id: 'ohio-index', title: 'Ohio death index: Palmier Mangini', kind: 'official index', url: 'https://resources.ohiohistory.org/death/search_dc.php', inspected: true, citation: 'Search performed 5 October 2026: surname Mangini; all given names; 1926–1928; all counties; Soundex off. One result: MANGINI, Palmier; 30 July 1927; Franklin; ODC volume 5401, certificate 40647. Result page is session-based; repeat the search. Original certificate not inspected.' },
  { id: 'nora-genealogy', title: 'Field genealogy: Nora Lewis Muncie', kind: 'compiled genealogy', url: 'https://fieldgenealogy.com/g0/p424.htm', inspected: true, citation: 'Nora entry, last edited 6 January 2012; checked 5 October 2026. Equates the Italian and American parental names. Cites Sunderland-Field Family History p. 11 and Ohio county marriages. Underlying records not inspected. Obituary date conflict: field says 9 November 1989; reproduced text references Columbus Dispatch, 12 February 1962, p. 4A.' },
  { id: 'italy-marriages', title: 'Castel di Sangro marriage transcription', kind: 'transcription', url: 'https://www.italyheritage.com/genealogy/records/abruzzo/province-laquila/casteldisangro/marriages/r.htm', inspected: true, citation: 'R surnames; 12 July 1856 entry for Nicola Ricchiuto and Domenica Antonia Mastrorocco; checked 5 October 2026. Lists each spouse’s parents and Roccaraso for Domenica. Original act and act number not retrieved. Also lists Giuseppe Ricchiuto in 1814 with mother Rosa Santostefano.' },
  { id: 'summary-1', title: 'Supplied research summary 1', kind: 'user supplied', inspected: true, citation: 'Attachment eb636fd9-d90d-4dc8-b182-5d73c978b34f, Pasted text.txt; read 5 October 2026. Earlier research reconstruction. ChatGPT citation placeholders have no recoverable links; claims remain leads.' },
  { id: 'summary-2', title: 'Supplied research summary 2', kind: 'user supplied', inspected: true, citation: 'Attachment e43d8cfd-fdea-4e93-8130-02f39b72117d, Pasted text.txt; read 5 October 2026. Earlier research reconstruction, not an inspected original record.' },
  { id: 'marriage-inference', title: 'Inferred marriage date', kind: 'inference', inspected: false, citation: 'Earlier summary calculated 30 June 1895 from a reported birth date and age at marriage. Those inputs and the marriage date are unverified; do not use as an exact event date.' },
  { id: 'ohio-images', title: 'FamilySearch: Ohio, Deaths, 1908–1953', kind: 'research guide', url: 'https://www.familysearch.org/en/search/collection/1307272', inspected: true, citation: 'Collection landing page checked 5 October 2026. A search for Palmier Mangini required sign-in; no original certificate image retrieved. This collection link is an access route, not evidence for a person’s facts.' },
  { id: 'naturalization', title: 'FamilySearch: Ohio county naturalizations', kind: 'research guide', url: 'https://www.familysearch.org/en/search/collection/1987615', inspected: true, citation: 'Collection landing page checked 5 October 2026. County coverage varies. No matching petition retrieved.' },
  { id: 'italy-register', title: 'Original 1856 Castel di Sangro marriage register', kind: 'research guide', url: 'https://antenati.cultura.gov.it/ark:/12657/an_ua19118358/', inspected: true, citation: 'Antenati catalogue and viewer opened 5 October 2026: Archivio di Stato dell’Aquila, Stato civile della restaurazione, Castel di Sangro, Matrimoni 1856, segnatura 1409; 45 viewer pages. Images are publicly viewable. The relevant couple’s act has not been identified and transcribed here; this is a register access link, not new evidence of their parentage.' },
];

const lead = (label: string, value: string, note?: string): Fact => ({ label, value, confidence: 'provisional', sources: ['summary-1', 'summary-2'], note });
const compiled = (label: string, value: string, note?: string): Fact => ({ label, value, confidence: 'supported', sources: ['nora-genealogy'], note });
export const people: Person[] = [
  { id: 'p001', name: 'Palmiero Mangini', aliases: ['Paul Muncie', 'Palmier Mangini', 'Palmiro Mangini', 'Palmerio Mangini'], dates: '1851?–1927', facts: [
    { label: 'Working identity', value: 'Palmiero Mangini / Paul Muncie', confidence: 'probable', sources: ['nora-genealogy'], note: 'Explicitly paired in Nora’s compiled entry; a legal name change is not established.' },
    lead('Birth', '3 April 1851 · reportedly L’Aquila, Italy', 'City or province unresolved; no birth act inspected.'),
    { label: 'Death index', value: '30 July 1927 · Franklin County, Ohio', confidence: 'supported', sources: ['ohio-index'], note: 'Indexed as Palmier Mangini. Volume 5401, certificate 40647. Strong candidate for this person; certificate image needed to confirm identity and parentage.' },
    lead('Marriage', 'About 1895 · location unresolved', 'Italy is suggested in one summary; Franklin County is a search hypothesis in the other.'),
    { label: 'Date hypothesis', value: '30 June 1895', confidence: 'provisional', sources: ['marriage-inference'], note: 'Arithmetic inference only, not a documented marriage date.' },
  ], notes: ['Parents unknown. Do not attach a Mangini pedigree until a record identifies them.', 'A possible earlier marriage is an unlinked summary lead; no first spouse identified.', 'Next: inspect 1927 certificate 40647; compare spouse, informant, residence, birth date, and parents.'] },
  { id: 'p002', name: 'Emiecia Ricchiuto', aliases: ['Emida Ricchuitta', 'Emida Ricchiuto', 'Emma Richards', 'Emma Muncie'], dates: 'born about 1876?', facts: [
    { label: 'Working identity', value: 'Emida Ricchuitta / Emma Richards', confidence: 'probable', sources: ['nora-genealogy'], note: 'Paired explicitly in Nora’s compiled genealogy. Emiecia spelling comes from supplied research.' },
    lead('Birth', 'About 1876 · Italy'),
    lead('Candidate parents', 'Nicola Ricchiuto and Domenica Antonia Mastrorocco', 'Their marriage is transcribed, but no inspected record connects them to Emiecia.'),
  ], notes: ['Her birth act or marriage act must establish her parents.', 'Search Emiecia, Emida, Emidia, Emma; Ricchiuto and Ricchuitta. Birthplace not established.'] },
  { id: 'p003', name: 'Maria “Mary” Muncie', aliases: ['Marianana Muncie', 'Mary Muncie', 'Maria Mangini'], dates: '1897?–1934?', facts: [lead('Birth', '2 February 1897 · reportedly Italy'), lead('Death', '1934'), lead('Identity / spouse', 'Possibly Marianana “Mary” Muncie, wife of Salvatore Rocci', 'Maria and Marianana are a tentative identity match, not two established daughters.')], notes: ['Birth and marriage records needed to establish identity and parentage. Do not use this birth to fix the immigration window yet.'] },
  { id: 'p004', name: 'Victor Richard Muncie', aliases: ['Victor Muncie'], dates: 'born 1899?', facts: [lead('Birth', '22 January 1899'), compiled('Sibling lead', 'Victor Muncie · Greensboro, North Carolina, in reproduced obituary', 'The expanded name and birth date are from supplied research; exact identity still needs comparison.')], notes: ['Nora’s reproduced obituary supports a brother named Victor; no census household retrieved.'] },
  { id: 'p005', name: 'Nora Lewis Muncie', aliases: ['Nora Muncie Sunderland', 'Nora Sunderland'], dates: '1908–1962 (compiled)', facts: [compiled('Birth', '24 April 1908 · Camp Chase, Franklin County, Ohio'), compiled('Marriage', '16 January 1926 · Franklin County, Ohio · George Edward Sunderland'), compiled('Death', '11 February 1962 · Columbus, Franklin County, Ohio'), compiled('Record locator', 'Ohio death volume 16803 · certificate 11169', 'Reference copied from compiled citation; death record not inspected.'), compiled('Burial', 'Walnut Grove Cemetery')], notes: ['Obituary reference conflicts: 9 November 1989 in the field, 12 February 1962 p. 4A in the reproduced text. Retrieve the original newspaper.', 'The compiler gives a 1930 census locator for her married household: Sharon Township, Franklin County, ED 215, sheet 3A, 16 April 1930. This is not Paul’s 1920 household.'] },
  { id: 'p006', name: 'Albert J. Muncie', aliases: ['Albert Muncie'], dates: '1911?–1999?', facts: [lead('Birth', '7 July 1911'), lead('Death', '3 March 1999 · reportedly Columbus, Ohio'), compiled('Sibling lead', 'Albert Muncie · Columbus, in reproduced obituary')], notes: ['The Albert named in Nora’s obituary and Albert J. in supplied research are a probable match; original records needed.'] },
  { id: 'p007', name: 'Fred Victor Muncie', aliases: ['Fred Muncie'], dates: 'born 1915?', facts: [lead('Birth', '1915'), compiled('Sibling lead', 'Fred Muncie · Johnstown, Ohio, in reproduced obituary')], notes: ['The full name and year are unverified summary leads.'] },
  { id: 'p008', name: 'Nicola Ricchiuto', aliases: [], dates: 'born 1833?', facts: [lead('Birth', '31 December 1833 · reportedly Castel di Sangro'), { label: 'Marriage', value: '12 July 1856 · Castel di Sangro · Domenica Antonia Mastrorocco', confidence: 'supported', sources: ['italy-marriages'], note: 'Transcription inspected; original act not inspected.' }], notes: ['Candidate father of Emiecia. Kept distinct from elder Nicola (p014).'] },
  { id: 'p009', name: 'Domenica Antonia Mastrorocco', aliases: ['Domenica Mastrocco'], dates: 'dates unknown', facts: [{ label: 'Origin', value: 'Roccaraso', confidence: 'supported', sources: ['italy-marriages'], note: 'Described as from Roccaraso, not necessarily born there.' }], notes: ['Candidate mother of Emiecia.'] },
  { id: 'p010', name: 'Patrizio Ricchiuto', aliases: [], dates: 'born 1807?', facts: [lead('Birth', '12 December 1807 · reportedly Castel di Sangro'), lead('Marriage', '1 August 1833 · reportedly Reparata Liberatore')], notes: ['Named as Nicola’s father in the 1856 transcription. His own birth and marriage dates remain leads.'] },
  { id: 'p011', name: 'Reparata Liberatore', aliases: ['Emidia Reparata Liberatore'], dates: 'dates unknown', facts: [lead('Full-name lead', 'Emidia Reparata Liberatore')], notes: ['Named as Nicola’s mother in the 1856 transcription; fuller name comes from supplied research.'] },
  { id: 'p012', name: 'Samuele Mastrorocco', aliases: [], dates: 'dates unknown', facts: [], notes: ['Named as Domenica’s father in the 1856 transcription.'] },
  { id: 'p013', name: 'Alberta Di Battista', aliases: [], dates: 'dates unknown', facts: [], notes: ['Named as Domenica’s mother in the 1856 transcription.'] },
  { id: 'p014', name: 'Nicola Ricchiuto (elder)', aliases: [], dates: '1761?–1831?', provisional: true, facts: [lead('Birth', '1761'), lead('Death', '31 July 1831 · reportedly Castel di Sangro')], notes: ['Contributor-tree reconstruction reported by summary; original records and source URL absent.'] },
  { id: 'p015', name: 'Maria DiSanto', aliases: ['Maria Di Santo'], dates: '1773?–1845?', provisional: true, facts: [lead('Birth', '1773'), lead('Death', '17 June 1845 · reportedly Castel di Sangro')], notes: ['Provisional parent of Patrizio.'] },
  { id: 'p016', name: 'Giovanni Ricchiuto', aliases: [], dates: '1736?–1787?', provisional: true, facts: [lead('Birth', '1736'), lead('Death', '24 December 1787 · reportedly Castel di Sangro')], notes: ['No inspected original act supports this extension.'] },
  { id: 'p017', name: 'Francesca Minchillo', aliases: [], dates: 'dates unknown', provisional: true, facts: [], notes: ['Provisional parent of elder Nicola.'] },
  { id: 'p018', name: 'Lionardo Ricchiuto', aliases: ['Leonardo Ricchiuto'], dates: 'dates unknown', provisional: true, facts: [], notes: ['Do not merge with the Lionardo named with Rosa Santostefano in the 1814 marriage index. Repeated names may describe different people.'] },
  { id: 'p019', name: 'Anna Grazia Sconciafurno', aliases: [], dates: 'dates unknown', provisional: true, facts: [], notes: ['Provisional parent of Giovanni. The Giuseppe/Rosa Santostefano discrepancy remains unresolved.'] },
  { id: 'p020', name: 'Vincenzo DiSanto', aliases: ['Vincenzo Di Santo'], dates: 'dates unknown', provisional: true, facts: [], notes: ['Candidate father of Maria, reported by supplied reconstruction.'] },
  { id: 'p021', name: 'Costanza Catullo', aliases: [], dates: 'dates unknown', provisional: true, facts: [], notes: ['Candidate mother of Maria, reported by supplied reconstruction.'] },
];

const relation = (id: string, from: string, to: string, kind: Relationship['kind'], confidence: Confidence, sources: string[], note: string): Relationship => ({id, from, to, kind, confidence, sources, note});
export const relationships: Relationship[] = [
  relation('r01', 'p001', 'p002', 'spouse', 'probable', ['nora-genealogy', 'summary-1', 'summary-2'], 'Working couple; marriage date and location unresolved.'),
  ...['p001', 'p002'].map((id, i) => relation(`r0${i + 2}`, id, 'p005', 'parent', 'supported', ['nora-genealogy'], 'Parent named by Nora’s compiler; original record still needed.')),
  ...['p004', 'p006', 'p007'].map((id, i) => relation(`r0${i + 4}`, 'p005', id, 'sibling', 'probable', ['nora-genealogy', 'summary-1'], 'Reproduced obituary names this brother by short name. Exact identity and shared parentage need records.')),
  ...['p003', 'p004', 'p006', 'p007'].flatMap(id => ['p001', 'p002'].map(parent => relation(`child-${parent}-${id}`, parent, id, 'parent', 'provisional', ['summary-1', 'summary-2'], 'Candidate child; sibling evidence alone does not prove both parents.'))),
  relation('r07', 'p008', 'p009', 'spouse', 'supported', ['italy-marriages'], '1856 marriage transcription; original act not inspected.'),
  ...['p008', 'p009'].map((id, i) => relation(`re${i}`, id, 'p002', 'parent', 'provisional', ['summary-1'], 'Unlinked earlier reconstruction; 1856 marriage does not establish Emiecia’s parentage.')),
  ...[['p010', 'p008'], ['p011', 'p008'], ['p012', 'p009'], ['p013', 'p009']].map(([from, to], i) => relation(`rt${i}`, from, to, 'parent', 'supported', ['italy-marriages'], 'Parent named in inspected 1856 transcription; original act not inspected.')),
  ...[['p014', 'p010'], ['p015', 'p010'], ['p016', 'p014'], ['p017', 'p014'], ['p018', 'p016'], ['p019', 'p016'], ['p020', 'p015'], ['p021', 'p015']].map(([from, to], i) => relation(`ro${i}`, from, to, 'parent', 'provisional', ['summary-1'], 'Contributor-tree ancestry reported by supplied summary; not independently checked.')),
];
export const familyBranch: Branch = {
  id: 'central', title: 'Mangini → Muncie', people: ['p001', 'p002'], relations: ['r01'], open: true,
  note: 'A working family group. Palmiero’s parents and the path to Tom are still unknown.',
  children: [
    { id: 'children', title: 'Children & sibling leads', people: [], open: true, note: 'This is not yet a complete household. Only Nora’s parentage is explicitly stated in the inspected compiled page.', children:
      ['p003', 'p004', 'p005', 'p006', 'p007'].map(id => ({id: `child-${id}`, title: people.find(p => p.id === id)!.name, people: [id], relations: id === 'p005' ? ['r02', 'r03'] : [`child-p001-${id}`, `child-p002-${id}`, ...(id === 'p003' ? [] : [id === 'p004' ? 'r04' : id === 'p006' ? 'r05' : 'r06'])], open: true})) },
    { id: 'ricchiuto', title: 'Explore Emiecia’s candidate parents', people: ['p008', 'p009'], relations: ['re0', 're1', 'r07'], note: 'The couple is transcribed; the link to Emiecia remains provisional.', children: [
      { id: 'nicola-parents', title: 'Parents named for Nicola', people: ['p010', 'p011'], relations: ['rt0', 'rt1'], children: [
        { id: 'older', title: 'Older Ricchiuto research branch', people: ['p014', 'p015'], relations: ['ro0', 'ro1'], provisional: true, note: 'All connections here are provisional; no missing generations have been filled in.', children: [
          { id: 'giovanni', title: 'Candidate parents of elder Nicola', people: ['p016', 'p017'], relations: ['ro2', 'ro3'], children: [
            { id: 'lionardo', title: 'Candidate parents of Giovanni', people: ['p018', 'p019'], relations: ['ro4', 'ro5'], note: 'Lionardo / Rosa Santostefano in the 1814 index is an unresolved separate identity.' }
          ] },
          { id: 'disanto', title: 'Candidate parents of Maria', people: ['p020', 'p021'], relations: ['ro6', 'ro7'] }
        ] }
      ] },
      { id: 'domenica-parents', title: 'Parents named for Domenica', people: ['p012', 'p013'], relations: ['rt2', 'rt3'] }
    ] }
  ]
};

export const personById = Object.fromEntries(people.map(person => [person.id, person])) as Record<string, Person>;
export const sourceById = Object.fromEntries(sources.map(source => [source.id, source])) as Record<string, Source>;
export const relationshipById = Object.fromEntries(relationships.map(item => [item.id, item])) as Record<string, Relationship>;
export function searchPeople(query: string, includeProvisional = false): Person[] {
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  if (!normalized) return [];
  return people.filter(person => (includeProvisional || !person.provisional) && [person.name, ...person.aliases].some(name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(normalized)));
}
