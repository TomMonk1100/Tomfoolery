# Family tree and original-record continuation — 6 October 2026

## Map coverage

The first overlay included the 611 imported family people and all 21 previously
recorded biblical people from Genesis 4, 5 and 11. They have separate stable
IDs, searchable names, source details, and distinct biblical styling. Genesis
5 and 11 were checked against the King James text at
https://www.biblegateway.com/passage/?search=Genesis+5,Genesis+11&version=KJV .
The displayed relationships follow that textual tradition; no independently
documented connection to Tom has been established.

That first additive display overlay in `src/data/family-map.ts` adds 391 immediate
unknown parent positions across the family and biblical branches. Each appears
as a ? with a stable ID derived from its child's ID and position. These are
unfilled research positions, not new identified people or proven biological
relationships. Adam and Eve have no invented human parents. Unknown positions
do not have invented earlier parents. The imported JSON and asserted parent
links remain intact. The unknown modern-to-biblical gap has no generation count
and no edge joining the branches.

## William Nedels — original administration-bond entry

Original source: Maryland Prerogative Court, Testamentary Proceedings,
Liber 27, folio 328, Talbot County returns, 1726. Public security microfilm:
MSA TE1-79, https://guide.msa.maryland.gov/pages/item.aspx?ID=TE1-79 .
The actual viewer image is **275**, right-hand page, beginning “Talbot County
returns Continued.” Manuscript folios were visually calibrated against the
scans; image numbers are not folio numbers.

The entry records William Nedels's administration bond in common form by
Elizabeth Nedels, administratrix, with Peter Sharp and Richard Ecles as
securities for £150 sterling, dated May 1726. The month and year are clear.
The exact day and surname spellings need comparison with the original bond
before use as identity keys. This gives an earlier administration date than
the inventory oath of 3 August 1726. It does not name an heir, child, parents,
or explicitly call Elizabeth the widow. The unnamed child in the 1727 account
therefore remains unidentified; no new relative was attached to Tom's trail.

The entire two-folio image and a higher-resolution excerpt were inspected.
Local source PDF: `/private/tmp/muncie-probate/proceedings275.pdf`.
Rendered page: `proceedings275.png`; entry excerpt: `needels-bond328.png`.
Do not cite calibration pages as evidence for the Needels entry.

Next sources: Liber 27 folios 81, 91, 189, 198 and 339; the Talbot land
assessment cited in PF13; and independent Delaware/Cranfill evidence for Ann.
The restricted land volume and undigitized Kent packet remain access limits,
not grounds to invent a connection or bypass access controls.

## Pending account retained

This update includes Pip's original 1727 estate-account research from
`ancestry-research-2026-10-05.md`. Adam Browne and his wife Elizabeth administer
William's estate and the account mentions one unnamed child. Its identity,
sex, age and later descendants remain unknown. The account does not establish
that the child was Ann or the later Kent William.

## Coverage audit and correction

An audit against `src/data/family.ts` found 18 additional Italian research
people missing from the imported index. All 23 Italian research identities
are now represented in the main map: five existing IDs are reused and 18
are added without merging similar names. Total: **650 named people**, including
21 biblical people. Research parent and spouse assertions are added only
to the display overlay. Their original supported/probable/provisional status,
source type and explanation remain visible in relationship details. Original
imported records remain unchanged. Sibling leads are not converted into
additional parent assertions.

There are now **404 immediate ? parent positions**. Unknown parent positions are recomputed after those recorded research links
are added. Research profiles open their existing evidence section, including
when it starts collapsed. Complete verification passed: 322 tests, type checks,
asset checks and the 3,720-page production build. Browser checks confirmed
Concezio's profile navigation and Emma's probable parents / provisional child
links. Production publication still awaits explicit user approval after the
automatic approval review rejected the earlier push.

Liber 27 folio 339 (viewer image 281, left page) was also visually inspected.
Talbot returns dated 20 September 1726 include William Needels's inventory
of £133 9s 10d, matching the later estate-account amount. This entry adds
no heir identity or parent-child link. Folios 81, 91, 189 and 198 remain
research leads; nearby calibration scans are not evidence for those entries.

## Renewed path research and scope correction

Tom clarified that the aim is an actual sourced path toward biblical Adam and
Eve, allowing slight evidence as long as uncertainty is clear. A disconnected
biblical branch does not satisfy that research objective.

The map's former “All recorded” option meant all ancestors linked to the
selected person. It did not include unconnected branches. The corrected menu
separates “All my recorded ancestors” from “All recorded people & biblical
branch.” The latter selects whole-tree mode; `?view=all` preserves that scope
in a direct link. Browser inspection confirmed Tom, Adam, Eve and the new
candidate are all included.

### Andrea deGotham — provisional contributor-tree claim

Directly inspected WikiTree profiles:
- https://www.wikitree.com/wiki/DeGotham-11 : Andrea, reported 1217; Henry as child.
- https://www.wikitree.com/wiki/DeGotham-7 : Henry Gulielmus, reported 1247 at
  Norton Lees; Andrea as father, mother unknown, Roger as child.

The imported Henry (mft-fa80c8f6-5cd2-4356-91af-bc2f56f540b8) reports 1247 at
Norton, Derbyshire, and Rogerus born 1279 as child. This gives a provisional
identity match, not original-record proof. The public profiles cite Ancestry
member trees only. Andrea's cited tree is 32350506/person/18862723017;
Henry's is 24051471/person/1981864041. Opening Andrea's source led to the
Ancestry sign-in page; no credentials were entered. User was asked whether
Ancestry access is available; public research can continue independently.

The new display-only candidate ID is `candidate-andrea-degotham`. Its parent
claim has a dotted provisional edge and evidence link. The imported Henry's
parent array remains empty. The ancestry trail now reaches G26, but labels
Andrea and the extension as unverified. Existing Needles and Parker conflicts
remain displayed. Andrea's parents are unknown. No biblical connecting edge
was added. Current overlay: 651 named people / candidates and 405 immediate
unknown positions. The goal remains incomplete.

Competing source checked: Diana J. Muir, *Ancestors of Barbara Marilyn Austin*
(June 2018), printed pp. 173 and 183 (PDF pages 176 and 186). It assigns Henry
to Thomas de Dutton / Phillippa de Standon instead of Andrea. Its account is
not independent proof and was not imported as another parent set. URL:
https://www.researchgate.net/profile/Diana-Muir/publication/329991642_Ancestors_of_Barbara_Marilyn_Austin/links/5c280e7f92851c22a34e7f42/Ancestors-of-Barbara-Marilyn-Austin.pdf
The older Dutton pedigree and medieval regional records should be compared
before accepting that different claim. The Mary Ellen Roos and Alice
Mauleverer royal-parent leads also have substantial name/date/source conflicts;
no new royal parentage was assigned from those search results.

Verification: 323 tests, type checking, asset checks, and 3,720-page build pass.
Browser checks confirmed candidate profile/evidence navigation and the G26
trail label. These follow-up changes are local and queued for a future batch;
no new Netlify publishing credit was used. The preceding 650-person update
is already live at production commit d59255b.

### Prather branch — tentative extension, 6 October 2026

Added three display-only candidates and three provisional parent edges, all
linked to the new `prather-josiah-parent-candidate` evidence review. They
extend the imported Newman branch by two generations. Each candidate is
searchable and has its own source/review profile. Original imported parent
arrays and dates are unchanged. No mother is inferred from a spouse list.
Source inspected: https://multiwords.de/genealogy/Pr10%20Thomas%20Prather.html
rows Pr7-4 and Pr7-4-2. See the site review for the names, identity matches,
and date conflicts; linked RootsWeb source could not be retrieved. These
are conditional compiled claims requiring parish/probate and Virginia checks.

Overlay now 654 named people and 408 immediate unknown positions; the
Prather endpoints appear at G12 in selectable trails from Tom. Longest
candidate trail remains G26 through Andrea. The ancient connection remains
unestablished. Browser verified All recorded includes the biblical people
and each candidate, and candidate review navigation expands the correct
section. Full verification passed: 324 tests, types, assets, 3,720-page build.
Still local, queued with the preceding scope fix and Andrea candidate;
no additional production publication or Netlify credit used in this turn.

### Sprigg–Nuthall–Hyde route, 6 October 2026

Added 17 further distinct display-only candidate identities, each with an
explicit cited provisional parent edge and a linked review. This continues
John Smith Prather's proposed maternal route through Martha Sprigg into the
English pedigrees, without changing imported identities. The Newman/Josiah
match remains unresolved; the immigrant-to-English-family bridge is disputed.
No biblical connecting edge was added. Current overlay: 671 named people,
21 candidate identities, 425 immediate unknown positions. The new Warren
endpoint is G20 from Tom; longest overall trail remains G26 through Andrea.

Five reviews separate the family context, colonial parent claims, English
identity dispute, Hyde grouping, and earlier visitation generations. The
Council edition in Archives of Maryland vol. 5 p. 34 was inspected as a scan:
it names Eleanor among Cross Manor's John's children and identifies her
husband Thomas Sprigg. It does not name her mother. The scanned visitation
edition (Armytage/Rylands 1909), pp. 135–136 and 190, was inspected directly;
it shows the English family relationships, but does not name the immigrant
among the Nuthall children. Do not treat this omission alone as disproof or
assume the unlisted immigrant is the English son. Underlying manuscripts and
baptisms are still uninspected. Every proposed descent from Tom remains
conditional; neither source proves a route to a biblical person.

Sources and reproducible scan locations:
- https://www.ffish.com/family_tree/pedigrees/4068.htm — compiled family notes
  and quoted Thomas Prather will abstract, Liber 13 folio 379. Search-indexed
  passage inspected; direct web fetch failed. Original will not inspected.
- https://www.anamericanfamilyhistory.com/Maryland%20Families/Prather%20Family.html
  — Martha Yoakley will abstract and Prather family context.
- https://msa.maryland.gov/megafile/msa/speccol/sc2900/sc2908/000001/000426/html/am426--939.html
  — official biographical dictionary corrigenda, Josiah's family context.
- https://msa.maryland.gov/megafile/msa/speccol/sc2900/sc2908/000001/000005/pdf/am5--34.pdf
  — scanned printed Council edition. Local PDF /private/tmp/muncie-nuthall-council-34.pdf;
  embedded image extracted to /private/tmp/muncie-nuthall-council-source.png.
- https://archive.org/details/recordsociety58recouoft — catalogue title verified.
  Public download recordsociety58recouoft.pdf; local /private/tmp/muncie-cheshire-1613.pdf.
  Printed pp. 135–136 = PDF pages 151–152; p. 190 = PDF page 206.
  Rendered /private/tmp/muncie-hyde-p135.png, muncie-hyde-p136.png,
  muncie-nuthall-p190.png. Layout OCR /private/tmp/muncie-cheshire-1613-layout.txt.

Next: Warren of Poynton pp. 249–250 (PDF 265–266) has multiple Johns and
Laurences; identify which Laurence is Margaret Hyde's father before adding
his parents. The Hyde page identifies her father but gives no date or mother.
Do not merge the two Laurence generations. The Nuthall page omits the
immigrant; compare alleged baptism and 1644 family references. The Bacon
royal-parent claim is disputed and was not added. The direct seekingmyroots
Sprigg scan download timed out; never claim it was inspected.

Full verification: 325 tests, type checking, assets, 3,720-page build passed.
Browser confirms all 671 names and 425 gaps in All recorded; new candidate
profiles and G20/G19/G18 endpoints are discoverable. Changes remain local
with the earlier queued batch; no new production publish or credit used.


## Royal candidate extension — 6 October 2026

Added 17 distinct candidates, bringing the additive map to 688 named people (38 candidates) and 442 immediate unknown-parent positions. The candidate ancestry audit contains 211 ancestors, 213 missing-parent positions, and a longest trail of 28 parent links to Edward I; Eleanor of Castile is an alternative endpoint at the same depth. All candidate edges remain provisional. Raw imported data is unchanged and the biblical branch remains disconnected.

The displayed trail is Tom → Patrick → Gloria → Eleene White → Velma Miller → Walker Miller → Mary Sloan Boyd → James Boyd → Celia Prater → Nehemiah Prater → Newman Prather → Josiah Prather → John Smith Prather → Martha Sprigg → Eleanor Nuthall → John of Cross Manor → Mary Hyde → Robert Hyde → elder Robert Hyde → Margaret Warren → Margaret Legh → Eleanor Savage → Katherine Stanley → Joan Goushill → Elizabeth Fitzalan → Elizabeth de Bohun → William de Bohun → Elizabeth of Rhuddlan → Edward I. This is a chain of recorded assertions and conditional hypotheses, not independently proved descent.

Evidence checked:

- Cheshire visitation of 1580, Rylands edition 1882: printed p. 153 (PDF 170), Legh of Lyme, expressly connects Margaret, wife of Lawrence Warren, with Piers Legh and Eleanor Savage. Printed pp. 203–204 (PDF 220–221) show Eleanor under John Savage and Katherine Stanley. Printed p. 242 (PDF 259) independently shows Lawrence and Margaret Legh as a couple, and separates earlier Lawrences with other wives. The Warren chart does not list Margaret Warren/Hyde as their daughter: her maternal assignment is a compiled claim from Multiwords Hy14, supported only by marriage context, not upgraded to documentary proof.
- Public scan: https://archive.org/details/visitationchesh00fellgoog/page/n169/mode/1up . Downloaded PDF `/private/tmp/muncie-cheshire-1580.pdf`; OCR `/private/tmp/muncie-cheshire-1580-ocr.txt`; inspected images `/private/tmp/muncie-legh-p153.png`, `/private/tmp/muncie-warren-p242.png`, `/private/tmp/muncie-savage-220.png`, `/private/tmp/muncie-savage-221.png`.
- Multiwords Hy14: https://www.multiwords.de/genealogy/Hy14HamnetHyde.htm . The earlier Hyde material contains conflicting generations/dates; only the explicit Warren mother claim was used here.
- John Ravilious, 26 November 1999, cites Barnes British Roots of Maryland Families and Cheshire visitation p. 153 for the Warren/Legh identities; the cited Barnes volume is uninspected: https://groups.google.com/g/soc.genealogy.medieval/c/xJtgkHZDrmI/m/hHuGjcWGdu8J . Other branches in that discussion have later corrections; none were copied into Tom’s tree.
- Katherine Stanley parents: https://www.thepeerage.com/p70924.htm#i709239 . Joan Goushill parents: https://www.thepeerage.com/p1385.htm#i13849 . Elizabeth Fitzalan parents: https://www.thepeerage.com/p196.htm#i1959 . Elizabeth de Bohun parents: https://www.thepeerage.com/p10690.htm#i106899 . William de Bohun parents: https://www.thepeerage.com/p10182.htm#i101816 . Elizabeth of Rhuddlan parents: https://www.thepeerage.com/p10192.htm#i101916 . Each online parent claim was inspected, including its printed-source citations where supplied. The cited books and original records were not inspected; compiled claim status retained.

Four evidence reviews expose the supporting material and limits. The trail summary now identifies the current candidate endpoint and names the unresolved Prather, immigrant and Warren bridges. A meaningful regression check traces Edward I to Tom through these same disputed bridges, and confirms the biblical branch is not silently joined. No medieval legendary bridge has been added; user preference is pending. This batch is local and queued with earlier research for minimal publication.


## Continuous research route and distinct chronicle tradition (6 October 2026)

Added 29 source-cited royal candidates, taking the historical candidate trail to Egbert through Henry II, Matilda of Scotland, Margaret, Edward the Exile, Edmund Ironside, Æthelred II, Edgar, Edmund I, Edward the Elder, Alfred and Æthelwulf. Every added parent edge retains its source URL and provisional assessment. Broad dates avoid copied chronological errors. Agatha’s parents and Æthelwulf’s mother remain unknown; Æthelred’s first wife’s given name is explicitly uncertain.

Sources: The Peerage entries 101903, 101923 and 102006; Stewart Baldwin’s Henry Project profiles, including `henry002`, `matil002`, `matil001`, `marga000`, `edwar000`, `edmun002`, `aethe002`, `edgar000`, `edmun001`, `edwar001`, `aelfr000` and `aethe001`. Web profiles and their references inspected; original cited documents not all inspected. The earlier Prather, immigrant and Warren bridges remain unresolved.

A separate 35-person display layer preserves the exact sequence in J. A. Giles’s *Anglo-Saxon Chronicle*, G. Bell and Sons edition (1914), printed p. 48 (Wikisource validated transcription, djvu page 66). No hybridization with variants containing Creoda. Elmund’s identification with the king of Kent is disputed. The sequence includes Woden and a Sceaf–Noah relationship absent from Genesis. Every chronicle edge is marked **legendary tradition / provisional**, including the join to Noah; no historical proof is claimed. Source: https://en.wikisource.org/wiki/Page:The_Anglo-Saxon_Chronicle_(Giles).djvu/66. Scholarly comparison: https://fasg.org/projects/henryproject/data/ealhm000.htm.

The page offers an explicit proposed Tom → Adam & Eve route with sources and category labels at every step. Biblical parent links follow the existing Genesis layer; Eve is shown as Seth’s other parent rather than as Adam’s parent. The historical audit excludes every legendary and biblical person and removes their parent edges. The raw imported records remain unchanged. Unknown immediate parent positions stay visible; no guessed dates or spouses are supplied.

The map now includes all 752 named identities (611 imported, 18 additional Italian research, 67 provisional candidates, 35 chronicle names and 21 biblical names). “All my recorded ancestors & traditions” uses a finite data-derived depth rather than truncating at 30. Whole-map and focus actions preserve explicit evidence labels. This is a complete navigable **composite hypothesis/tradition**, not verified descent from Adam and Eve. Publication is batched into one main-branch push after local verification.


The composite route also exposes an imported chronology conflict: Mary Elizabeth Sloan Boyd (1836) is linked to James Madison Boyd (1837). This raw edge is preserved but reviewed as provisional, with a dedicated finding and an evidence link on the map and route. Resolving it is essential to validating this branch. Route jump links make Tom, Edward I, Egbert, the legendary Woden, Noah and Adam/Eve directly reachable without scrolling all 88 steps. The user’s request for biblical/tentative sourced links was taken to include a clearly labelled chronicle tradition after the optional preference question remained unanswered; no historical proof was inferred from that silence.


## Close-family original record batch after FamilySearch sign-in

Six new Etling/Taladay research people fill the previously unknown Muncie positions through generation 5; the map has 758 named identities, including 24 research identities beyond the import. Source and relationship confidence is separate from name coverage. Original 1938 marriage, 1930 household, 1920 marriage, Hines Brown’s 1963 death and 1900 household, and Mark’s 1950 household inspected. Luneta and Hines’s own NUMIDENT entries were inspected as indexes with no images. Exact citations, readings, limits and screenshots are in the latest NEXT-SESSION section and research ledger.

Luneta birth years remain disputed. The imported Mary Lamb maternity is contradicted by originals and the application; no replacement date is invented. Mark’s census names William Stockwell as household father; Eugene Leslie’s biological relationship remains unresolved and flagged. User testimony concerning Mark→Patrick and Fred’s upbringing role is preserved. The five-generation goal remains active because many imported relationships still need original-record corroboration. Changes are batched for one git-linked publication after all verification gates pass.
