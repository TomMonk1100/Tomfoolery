export interface AncestryFinding {
  id: string;
  people: string[];
  title: string;
  confidence: 'supported' | 'probable' | 'provisional';
  sourceKind: 'original record' | 'archival index' | 'transcription' | 'compiled genealogy';
  citation: string;
  url: string;
  finding: string;
  limit: string;
  next: string;
}
const cartulary = 'https://www.cambridge.org/core/services/aop-cambridge-core/content/view/E7CE82B8FBBBC523A6785663BB57C36A/S0960116311000121a.pdf/beauchief_abbey_cartulary.pdf';
export const ancestryFindings: AncestryFinding[] = [
  {
    id: 'needles-william-identity-conflict', people: ['mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47', 'mft-807ec9be-5d73-4829-841b-ef6f291c5a7f', 'mft-839c0600-46b6-4cc8-b075-d01d833d4564'],
    title: 'Which William Needles connects the colonial line?', confidence: 'provisional', sourceKind: 'compiled genealogy',
    citation: 'Maryland State Archives, A Biographical Dictionary of the Maryland Legislature, vol. 426, p. 609, Edward Needles entry. Scanned page inspected 5 October 2026.',
    url: 'https://msa.maryland.gov/megafile/msa/speccol/sc2900/sc2908/000001/000426/pdf/am426--609.pdf',
    finding: 'The published biography names Captain John Needles as Edward’s father and gives his brother William as born about 1697, dead about 1726, and married to Elizabeth Tonnard in 1722. The imported William is instead recorded as dying in Kent, Delaware, on 18 October 1748 and as Ann Needles’s father.',
    limit: 'The scanned biography confirms the printed date of about 1726. A William who died then cannot be the biological father of an Ann born in 1744. The Kent administration record now confirms a later William with widow Hannah, but does not identify his parents or daughter Ann. The biography is a compiled scholarly account, not the original Talbot probate.',
    next: 'Inspect John’s 1723 Maryland will (Liber 18, folio 198) and William’s Talbot estate, and compare them with the nine-page Kent probate file. Establish Ann’s parents and Cranfill connection before relying on this medieval trail.',
  },
  {
    id: 'needles-kent-administration-1748', people: ['mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47', 'mft-9c19c8c6-de00-4730-924f-dc5a1fc30300'],
    title: 'An original record names William’s widow Hannah', confidence: 'probable', sourceKind: 'original record',
    citation: 'Kent County, Delaware, Wills H–I, 1730–1749; FamilySearch film 6486, DGS 7652919, image 423 of 460, left page. Handwriting inspected 5 October 2026.',
    url: 'https://www.familysearch.org/ark:/61903/3:1:3Q9M-C95D-KWQV',
    finding: 'An administration grant dated 18 October 1748 names Hannah Needles as widow and administrator of William Needles, who died intestate with property in Kent County. This supports a William–Hannah couple in that place and period. William had died by the grant date; the grant does not state that he died on that day.',
    limit: 'The names, county, and date make a match to the imported couple probable. Hannah’s maiden name Hargrove, William’s 1697 birth, his Maryland parents, and Ann’s parentage are not stated. The family-provided death date remains preserved alongside this narrower original-record finding.',
    next: 'Read the associated estate packet and inventory for children, relatives, and residence. Compare Hannah’s later records before assigning a maiden name.',
  },
  {
    id: 'needles-kent-probate-index', people: ['mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47', 'mft-839c0600-46b6-4cc8-b075-d01d833d4564'],
    title: 'A nine-page Kent estate file to pursue', confidence: 'probable', sourceKind: 'archival index',
    citation: 'Delaware Public Archives, Kent Register of Wills, RG 3545, series WKC-012, William Needles probate, 1748, nine pages. Catalogue inspected 5 October 2026.',
    url: 'https://7080.sydneyplus.com/archive/final/Portal/Default.aspx?component=AABC&record=69e6c977-8fdf-4c7f-94d5-a90f87221ed8',
    finding: 'The official catalogue identifies a nine-page 1748 William Needles probate file on microfilm. It is distinct from another William’s 1803–1814 probate entry.',
    limit: 'The catalogue says this packet is not digitized. Its nine pages were not inspected; the separate register grant does not substitute for the entire estate packet or prove Ann’s parentage.',
    next: 'Locate the microfilmed packet or obtain a copy using this exact archive reference; check distributions and guardianship for named children.',
  },
  {
    id: 'needles-1876-delaware-hypothesis', people: ['mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47', 'mft-807ec9be-5d73-4829-841b-ef6f291c5a7f'],
    title: 'The old Delaware connection was a hypothesis', confidence: 'provisional', sourceKind: 'compiled genealogy',
    citation: 'Samuel Hambleton Needles, Record of the Man, Needles (Nedels) and Hambleton Families (1876), printed p. 49, PDF page 95. Scan inspected 5 October 2026.',
    url: 'https://archive.org/download/recordofmanneedl00need/recordofmanneedl00need.pdf#page=95',
    finding: 'On this page the author proposes that western Needles families descend from John and Elizabeth Man’s son William. He cites matching names, a belief that William moved to Delaware, and lost family records, while saying he was still seeking a definite conclusion in December 1875.',
    limit: 'This passage is explicitly tentative. It does not establish that the Maryland William was Hannah’s husband or Ann’s father. It is evidence about the origin of a genealogical hypothesis, not proof of the parent links.',
    next: 'Compare the book’s register extracts and any later appendix with original Maryland and Delaware probate. Keep the two William identities unresolved until their records agree.',
  },
  {
    id: 'gotham-norton-1350', people: ['mft-4b4246b5-b50c-43f2-be21-e46e5bac4d80'],
    title: 'Adam de Gotham in a Norton charter', confidence: 'provisional', sourceKind: 'transcription',
    citation: 'The Beauchief Abbey Cartulary (2011), charter 50, p. 105, folio 33v; PDF page 67. DOI 10.1017/S0960116311000121. Text checked 5 October 2026.',
    url: `${cartulary}#page=67`,
    finding: 'The transcription names Ada de Gotham as a witness at Norton on 7 April 1350. Its editorial note also cites an Adam of Gotham witnessing a Norton grant on 17 September 1352.',
    limit: 'The document establishes a contemporary name, not a match to the imported Adam Degotham (1330–1400), his parents, or Tom’s descent. The manuscript image has not been inspected here.',
    next: 'Compare charter 50 with the 1352 grant: Derbyshire Charters, no. 1776, and Addy’s Norton history, pp. 7–8. Resolve the Parker/Gotham pedigree before assigning parentage.',
  },
  {
    id: 'gotham-thomas-roger-1308', people: ['mft-e3b49222-fe7b-4fe0-8ea1-f5d9792c78fd', 'mft-e18c312e-e9d0-46d0-bb77-7910825f7025'],
    title: 'A 1308 father–son clue with a date conflict', confidence: 'provisional', sourceKind: 'transcription',
    citation: 'The Beauchief Abbey Cartulary (2011), p. 62, editorial note citing T. W. Hall and A. H. Thomas, Jackson Collection catalogue (1914), no. 299. PDF page 24. Checked 5 October 2026.',
    url: `${cartulary}#page=24`,
    finding: 'The editors describe a 3 May 1308 grant by Thomas Chaworth to Thomas, son of Roger of Gotham.',
    limit: 'This is an editorial citation to a charter catalogue, not the underlying grant inspected here. A grantee in 1308 needs comparison with the tree’s Thomas birth year of 1305; it may be another Thomas or a wrong date. It supplies no evidence that Roger’s father was Henry.',
    next: 'Retrieve Jackson Collection charter 299 and establish the grantee’s identity before using it as a relationship source.',
  },
  {
    id: 'parker-gotham-pedigree-conflict', people: ['mft-48c3efde-5125-48fb-8e6b-2cade8d5f2dc', 'mft-2310d10a-ecf3-4d46-95b1-19bc7e0d43aa'],
    title: 'Competing Parker / Gotham pedigrees', confidence: 'provisional', sourceKind: 'compiled genealogy',
    citation: 'Stirnet, Parker01, opening generations; its comparison of Collins and Familiae Minorum Gentium. Read 5 October 2026. The cited visitations have not yet been inspected.',
    url: 'https://www.stirnet.co.uk/genie/data/british/pp/parker01.php',
    finding: 'The comparison places Thomas le Parker in the reign of Edward III (1327–1377). Collins gives his wife as Elizabeth, daughter of Adam, son of Thomas, son of Roger Gotham; Familiae Minorum Gentium instead gives Joan, sister and coheir of John Gotham.',
    limit: 'These accounts disagree, and their period differs substantially from the imported Thomas Parker (1471) and Elizabeth De Gotham (1450). A similar name is insufficient for a merge. The existing family account remains preserved.',
    next: 'Inspect the Derbyshire visitation and the original Norton Lees deeds, then work back through the London Nettles / Parker and Maryland Needels links. Do not extend Henry’s parentage from a copied pedigree.',
  },
];
export const findingsFor = (id: string) => ancestryFindings.filter(f => f.people.includes(id));
