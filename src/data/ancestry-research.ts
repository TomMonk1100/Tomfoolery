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
    id: 'gotham-andrea-parent-candidate', people: ['mft-fa80c8f6-5cd2-4356-91af-bc2f56f540b8'],
    title: 'A provisional parent candidate beyond Henry: Andrea deGotham', confidence: 'provisional', sourceKind: 'compiled genealogy',
    citation: 'WikiTree profiles DeGotham-11 (Andrea) and DeGotham-7 (Henry), relationship panels and Sources; directly inspected 6 October 2026. Andrea’s source is Ancestry tree 32350506/person/18862723017; Henry’s is tree 24051471/person/1981864041. Underlying trees and original medieval records are not inspected.',
    url: 'https://www.wikitree.com/wiki/DeGotham-11',
    finding: 'Andrea’s profile reports birth in 1217 and names Henry Gulielmus deGotham as a child. Henry’s profile reports 1247 at Norton Lees, names Andrea as father, leaves the mother unknown, and names Roger as a child. The name, year and place give a provisional match to the imported Henry; this is a source-backed contributor-tree hypothesis, not established parentage.',
    limit: 'Both profiles cite contributor trees only. They are not independent corroborating witnesses, and no medieval document is supplied. A competing compilation, Diana J. Muir, Ancestors of Barbara Marilyn Austin (2018), printed pp. 173 and 183, instead assigns Henry to Thomas de Dutton and Phillippa de Standon. Those mutually different claims remain unresolved. The Dutton claim has not been added as another set of parents, and Andrea’s own parents remain unknown. This candidate does not resolve the earlier Needles/Parker conflicts or connect Tom to a biblical person.',
    next: 'Inspect the cited Ancestry tree sources and seek a dated Norton charter naming Henry and Andrea together. Compare the Dutton pedigrees and regional records before accepting either parent claim.',
  },
  {
    id: 'needles-william-identity-conflict', people: ['mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47', 'mft-807ec9be-5d73-4829-841b-ef6f291c5a7f', 'mft-839c0600-46b6-4cc8-b075-d01d833d4564'],
    title: 'Which William Needles connects the colonial line?', confidence: 'provisional', sourceKind: 'compiled genealogy',
    citation: 'Maryland State Archives, A Biographical Dictionary of the Maryland Legislature, vol. 426, p. 609, Edward Needles entry. Scanned page inspected 5 October 2026.',
    url: 'https://msa.maryland.gov/megafile/msa/speccol/sc2900/sc2908/000001/000426/pdf/am426--609.pdf',
    finding: 'The published biography names Captain John Needles as Edward’s father and gives his brother William as born about 1697, dead about 1726, and married to Elizabeth Tonnard in 1722. The imported William is instead recorded as dying in Kent, Delaware, on 18 October 1748 and as Ann Needles’s father.',
    limit: 'The original Talbot inventory now independently establishes a William Nedels deceased by 3 August 1726, with Elizabeth as administrator and Edward Nedels and Samuel Dudley as nearest kin. That family circle agrees with John’s 1723 will. He cannot father an Ann born in 1744. This conflicts with the imported 1748 death and later Kent record naming widow Hannah, although the Kent grant date alone cannot exclude delayed administration. The imported identity remains unresolved; the biography itself is a compiled account.',
    next: 'Identify the unnamed child in the Talbot estate account, then compare the nine-page Kent probate file. Establish the Delaware William’s parents and Ann’s Cranfill connection before relying on this medieval trail.',
  },
  {
    id: 'nedels-william-inventory-1726', people: ['mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47', 'mft-807ec9be-5d73-4829-841b-ef6f291c5a7f', 'mft-839c0600-46b6-4cc8-b075-d01d833d4564'],
    title: 'The Maryland William was already dead in 1726', confidence: 'probable', sourceKind: 'original record',
    citation: 'Maryland State Archives, Prerogative Court (Inventories), Liber BHA No. 6 / 11, folios 519–522; Huntington security microfilm MSA TE1-14, viewer images 490–491. Handwriting inspected 5 October 2026.',
    url: 'https://guide.msa.maryland.gov/pages/item.aspx?ID=TE1-14',
    finding: 'The inventory describes William Nedels, late of Talbot County, deceased. Edward Nedels and Samuel Dudley sign as nearest kin. Elizabeth Nedels appears as administrator and proves the inventory on 3 August 1726. These names agree with the circle in John’s 1723 will, which names sons Edward and William and son-in-law Samuel Dudley.',
    limit: 'William died by 3 August 1726; this is not an exact death date. The inventory does not state his birth, parents, Elizabeth’s maiden name, or a daughter Ann. Its family circle makes identification with John’s Maryland son probable, but supplies no connection to the Delaware William and Hannah. The 1748 grant alone cannot exclude delayed administration; the strongest conflict is with Ann’s reported 1744 birth and the imported 1748 death.',
    next: 'The 1727 account has now been inspected: it names Adam Browne and Elizabeth, his wife, as administrators and refers to one unnamed child. Identify that child and research the Kent William and Ann independently before using the imported John → William → Ann links.',
  },
  {
    id: 'nedels-william-bond-1726', people: ['mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47', 'mft-839c0600-46b6-4cc8-b075-d01d833d4564'],
    title: 'William’s administration bond predates the August inventory', confidence: 'probable', sourceKind: 'original record',
    citation: 'Maryland State Archives, Prerogative Court (Testamentary Proceedings), Liber 27, folio 328; Huntington security microfilm MSA TE1-79, viewer image 275, right-hand page. Talbot County returns, 1726; handwriting inspected 6 October 2026.',
    url: 'https://guide.msa.maryland.gov/pages/item.aspx?ID=TE1-79',
    finding: 'The Talbot County returns record William Nedels’s administration bond by Elizabeth Nedels, his administratrix. Peter Sharp and Richard Ecles are named as securities for £150 sterling. The bond is dated May 1726, establishing that this Maryland estate was already being administered before the August inventory oath.',
    limit: 'The entry does not identify a child, name William’s parents, or explicitly call Elizabeth his widow. The administrator and county agree with the later inventory and account, but the connection to the Delaware William and Ann remains unproved. The precise day and the securities’ name spellings should be compared with the underlying bond before being used as identity keys.',
    next: 'Inspect the other indexed proceedings entries at Liber 27 folios 81, 91, 189, 198 and 339, and continue seeking the unnamed child from the 1727 account. Keep the Talbot and Kent estates distinct while testing Ann’s parentage.',
  },
  {
    id: 'nedels-william-account-1727', people: ['mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47', 'mft-839c0600-46b6-4cc8-b075-d01d833d4564'],
    title: 'William’s estate account refers to one unnamed child', confidence: 'probable', sourceKind: 'original record',
    citation: 'Maryland State Archives, Prerogative Court (Accounts), Liber 8, folios 300–302; Huntington security microfilm MSA TE1-47, viewer images 423–424. Account sworn 31 May 1727; handwriting inspected 5 October 2026.',
    url: 'https://guide.msa.maryland.gov/pages/item.aspx?ID=TE1-47',
    finding: 'Adam Browne and Elizabeth, his wife, account as administrators of William Nedels, late of Talbot County, deceased. The account repeats the inventory total of £133 9s 10d and is sworn on 31 May 1727. Its concluding statement identifies the legal representatives as the administrators and one child, without naming that child.',
    limit: 'The matching inventory total, name, county, and administrator Elizabeth connect this account to the 1726 estate. Elizabeth is now Adam Browne’s wife; her earlier marriage to William is an inference, not an explicit statement here. The child’s name, sex, age, and later descendants remain unknown. This is not evidence that the child was Ann or the later Kent William, and does not establish a missing generation on Tom’s trail.',
    next: 'Check Testamentary Proceedings Liber 27, folio 328, and the 1729 land assessment cited in Talbot Liber PF 13 for the child’s identity. The land images on FamilySearch require a centre or affiliate library; the Kent estate packet still needs inspection.',
  },
  {
    id: 'needels-john-will-1723', people: ['mft-807ec9be-5d73-4829-841b-ef6f291c5a7f', 'mft-de0177fb-c4b9-4ea5-b61e-875db6fdec47'],
    title: 'John’s original will names four children', confidence: 'probable', sourceKind: 'original record',
    citation: 'Maryland State Archives, Prerogative Court (Wills), MSA S538-26, Liber WD 1 / 18, folios 198–199, viewer images 200–201. Handwriting inspected 5 October 2026.',
    url: 'https://guide.msa.maryland.gov/pages/series.aspx?id=S538',
    finding: 'John Nedells of Talbot County made his will on 11 May 1723. He names sons Edward and William and daughters Elizabeth Rankin and Mary Dudley. Elizabeth’s husband is John Rankin; Mary’s husband is Samuel Dudley. Edward and William are appointed executors. Witness oaths are recorded on 30 October and 5 November 1723.',
    limit: 'This establishes John’s stated relationship to a son William in the Maryland family. It does not identify that son as the Kent, Delaware William with widow Hannah, or name John’s own parents. The will gives no birth dates and does not establish the imported 8 August death date.',
    next: 'William’s Maryland inventory and account have now been checked. Identify the account’s unnamed child and inspect the later land assessment, then compare the family with the Kent estate packet before merging either William.',
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
