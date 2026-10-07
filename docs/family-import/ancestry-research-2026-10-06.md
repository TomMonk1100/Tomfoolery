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

## Further close-family corroboration — local batch pending publication

This continuation follows published `cefbf97`. The generated 611-person import is unchanged. The map still contains 758 named identities. The following additions are locally verified and unpublished, held for a larger research batch to conserve Netlify builds.

- **Etling 1900 original**, Bullskin Township, Fayette PA, ED5, sheet17A, family303, lines24–26, image152/250, DGS004115089 item2: Washington M. head (April1874, PA), Lunetta wife (February1876, Iowa), Earl son (June1897,3). https://www.familysearch.org/ark:/61903/3:1:S3HT-DYHQ-8S4 . Saved `docs/earl-etling-1900-household.png`. Supports probable expansion W. M. → Washington M.; no exact parental dates inferred.
- **Earl Pennsylvania birth index**, not an inspected original: https://www.familysearch.org/ark:/61903/1:1:HH5Q-JNW2 reports Earl Bernard, 24June1898, Fayette, parents W M / Lunetta Etling. Film1318017, DGS004283305 image319, source13, batchI02335-0. No original link available in the inspected view. Event type is birth, not baptism. Keep 1897/1898 conflict open.
- **Talada 1910 original**, Scioto Township, Delaware OH, ED55(index), sheet4A, family75, lines9–15, image1082/1124, DGS004973183: Ralph G. head46PA, May wife47OH, Blanche daughter6. https://www.familysearch.org/ark:/61903/3:1:33SQ-GRK4-HQY . Saved `docs/blanche-taladay-1910-household.png`. Probable R G → Ralph G. expansion, but Blanche6/1910 versus Belle18/1920 differs by about two years. Maiden Armstrong comes from the marriage, not this census.
- **Dorothy/Eugene marriage index**, https://www.familysearch.org/ark:/61903/1:1:D8BB-YF2M and spouse D8BB-YFPZ: Eugene Howard Leslie / wife Dorothy D. Macy, 11May1940, Marion IN, DGS007719300_002_M9S5-54H image355. No original link in inspected views. This is documentary evidence of a couple, superseding the earlier warning against assuming one from separate imported parent assignments. It does **not** prove Mark’s paternity. Added a symmetric probable partnership overlay; raw export unchanged.
- **Dorothy’s own NUMIDENT index**, https://www.familysearch.org/ark:/61903/1:1:6K32-CPG8: Dorothy Dean Macy / Dorothy D. Stockwell, application November1936, parents Curtis L Macy / Inez Beeler, birth11March1917Indianapolis, death8March2003Mesa. No original image. The birth year conflicts with import1919 and the 1920 original age; no silent correction.
- **Macy 1920 original**, Guilford Township, Hendricks IN, ED36, sheet17B, family419, lines54–60, image791/1130, T625reel436: Samuel A.56NC head, Luella M.49IN wife, Curtis L.28IN son, Inez22IN daughter-in-law, Dorothy D.9/12IN granddaughter. https://www.familysearch.org/ark:/61903/3:1:33S7-9R6F-HK9 . Saved `docs/dorothy-macy-1920-household.png`. Relationships are to Samuel; other biological links remain inferences where not independently corroborated.
- **Curtis/Inez 1916 marriage original**, Morgan IN, page297, image184/336, DGS007578359 item1, film2420002: https://www.familysearch.org/ark:/61903/3:1:3QS7-99XF-99Q1 . Application/license22Nov, ceremony27Nov, return28Nov1916. Curtis L Macy birth2Sep1891MarionCountyIN, parents S A Macy / **Martha Collins**. Inez Beeler birth15Oct1897BrooklynIN, parents **Henry Beeler** / **Francis Hale**; Henry signs corroborating affidavits. Saved `docs/curtis-inez-1916-marriage-application.png` and `docs/curtis-inez-1916-marriage-return.png`. Exact spouse birthdays match the import; Samuel and Frances are probable parental matches. Martha/Luella M Collins and Henry/William H Beeler may be variants but are not established. Those imported edges are now provisional, with source links; no replacement or extra biological parent added.
- **Curtis 1900 original**, Washington Township, Marion IN, ED202/sheet2B(index), household34, lines62–64, image567/721, DGS004118642 item1: https://www.familysearch.org/ark:/61903/3:1:S3HY-XXDS-XQ . Samuel A. May1863,37,NC; Luella M. November1870,29,IN; Curtis L. September1891,8,IN. Original age8 versus index9. Couple nine years married; Luella reports one child born/one living. Saved `docs/curtis-macy-1900-household.png`. Supports family/maternity inference but does not establish Martha/Luella equivalence.
- **Leslie 1920 original candidate**, Indianapolis Ward15, CenterTownship, ED256, sheet8A, household154, lines10–15, district image15/20 (DGS004965834 image130 in index), T625reel456: https://www.familysearch.org/ark:/61903/3:1:33S7-9R62-99M . Harry45 head, Ida40 wife, children Gerold/Letha/Harry/Eugene. Eugene explicitly son and Indiana-born. Index MFW1-67T interprets fractional age as2years8months/1917, conflicting with imported20October1919. Original fraction still needs careful comparison. Saved `docs/eugene-leslie-1920-household.png`. Both parent identities remain provisional; no claim that census proves Brechbiel or biological maternity.

The audit table now gives specific reviewed claims and links to findings instead of a long person-ID conditional. Original birth evidence remains pending for several close generations. Meaningful regression checks ensure the 1940 partnership is symmetric, does not prove Mark’s paternity, preserves imported parents and keeps name-conflict reviews visible. **Full `npm run verify` passed: 338 tests in32 files, typecheck/assets/build3720 pages.** Log `/private/tmp/close-family-records-verify.log`. Local browser checked table rows and new marriage finding/hash opening. Live normal password helper passed anonymous401/authenticated200 for family/person/record/image. No production push in this continuation.

## Tillman H. Leslie research handoff — local site overlay

Reviewed `tillman-leslie-research-handoff.md` supplied by Tom on 6 October 2026. The handoff is treated as research material, not as instructions to edit FamilySearch or any other external tree. Its findings are added to the site’s ancestry research ledger and left separate from the generated import. The imported people and relationships remain unchanged.

- Harry Carter Leslie’s 1900 marriage index explicitly names Tillman H. Leslie and Mollie Hovey as parents. Sarah A. Washtler’s imported parent link is now marked provisional and linked to this finding; her later marriage to Tillman makes her Harry’s stepmother in the handoff. “Mollie” is not merged with Mary J. Hovey.
- The inspected 1886 license names Emma C. Porter as Tillman’s second wife. The handoff calls the imported “Emma Catherine Leslie” a corrupted identity, but this single license does not establish that person’s identity or subsequent death/divorce. The site preserves the imported person pending corroboration.
- The inspected 1900 census original places a younger Tillman H. Leslie, born September 1881, as nephew in James Leslie’s household. The 1910 census index identifies a Tillman H. Leslie, age 28, in James M. Leslie’s household as James’s son; the original page confirms the grouping, but its relationship wording was not independently resolved. These two census relationships conflict. The handoff’s proposed parentage by older Tillman H. Leslie and Mollie Hovey, and James as the older Tillman’s brother, are now weaker hypotheses, not established conclusions. The 1881/1887 birth discrepancy remains.
- FamilySearch’s Find a Grave Index and the matching memorial have now been inspected: both report older Tillman’s death on 26 September 1899 (not the imported 1895), with burial at Camden Cemetery. The memorial also identifies Mary Jane “Mollie” Hovey Leslie as spouse and lists Harry and younger Tillman among her children. These are cemetery/community sources, not contemporary civil records; they support the proposed family group without resolving the census conflict.
- Highest-value next records are younger Tillman’s 1958 death certificate and James’s 1911 death certificate, both potentially naming parents. Also pursue the 1860 Hendricks County and 1880 household records, Harry’s 1950 death certificate, and the original 1871/1887 marriage records. Until then, do not add a parent or sibling link for younger Tillman or James.

### Census conflict reviewed in continuation

The handoff treated the 1900 “nephew” entry as the likely bridge from younger Tillman to older Tillman and treated James as older Tillman’s probable brother. Reviewing the 1910 record changes that assessment: its index lists younger Tillman as James’s son. The 1910 image was inspected for household grouping; the index’s relationship label is preserved as an index claim rather than presented as a confirmed handwritten reading. The records can reflect an enumeration error or a household relationship whose meaning is not otherwise documented, but either explanation remains a hypothesis. No parentage is selected from these conflicting entries.

The public web search did not locate either civil death certificate. A FamilySearch query for the younger Tillman with the surname spelling “Lessie,” 1958 death, and Carroll County returned no result. His memorial nevertheless cites an Ancestry Indiana death-certificate image; Ancestry redirects to a membership page here, so direct inspection remains an access lead. The Indiana State Library’s genealogy guidance says statewide 1899–2011 death certificates are available through Ancestry Library Edition, while county health departments may hold earlier records. A FamilySearch 1860 census search for James Leslie, born about 1850 in Hendricks County, returned only a James Leslie in Owen Township, Warrick County, who is not a demonstrated match. A parallel exact-name Tillman query returned no results. On 6 October 2026, I also checked the indexed [United States 1860 Census collection](https://www.familysearch.org/en/search/collection/1473181) for James/Lesley, birth years 1848–1852. Although the result heading showed 58 matches, the viewer exposed 40 entries across the first two pages and zero on the third. The inspected pages included three Indiana possibilities: James Leslie, indexed age 9, in Silver Creek Township, Clark County; James Leslie with birthplace recorded only as “Ind” in Owen Township, Warrick County; and M. J. Leslie, indexed age 9, in Washington Township, Whitley County. None is an established match to James M. Leslie of the 1910 Carroll County household or the proposed Hendricks County family. Because the collection search was indexed and its displayed count/pages did not agree, it does not establish that relevant records are absent. Inspecting the appropriate Hendricks and Carroll County 1860 census pages remains open work.

### Cemetery and marriage-record continuation

FamilySearch’s Find a Grave Index entry QV27-KK3L reports Howard Tillman Leslie born 27 February 1845 and died 26 September 1899; the corresponding [older Tillman memorial](https://www.findagrave.com/memorial/60576382/howard_tillman-leslie) gives the same dates and Camden Cemetery, Section B, Row 14. The [Mollie Hovey Leslie memorial](https://www.findagrave.com/memorial/127787038/mary_jane-leslie) reports death 12 September 1881 in Terre Haute and cites the Woodlawn Cemetery burial index. The [younger Tillman memorial](https://www.findagrave.com/memorial/60576393/tillman_howard-leslie) reports birth 12 September 1881 and death 20 December 1958, gives Camden Cemetery, Section C, Row 5, and lists the older Tillman and Mollie as parents. All three memorials list this family grouping. The younger Tillman’s memorial contributor says they used an Indiana death certificate from Ancestry image `44494_351202-00123` (person `3328130`), noting the certificate spells the surname “Lessie” and the contributor identifies it as “Leslie.” The linked image redirects to an Ancestry membership page in the available browser, so that certificate is cited by the contributor but remains uninspected. The same-day Mollie death / younger Tillman birth alignment and separate memorial evidence strengthen the family hypothesis, but do not establish biological parentage or prove cause/circumstances. The memorial lists are community-maintained, and the 1900/1910 census conflict remains open.

The Vigo County Public Library’s searchable marriage index (coverage 1818–1958) returns Howard Leslie and Mary J. Hovey on 13 December 1871. Its linked [license PDF](https://vigolibrary.org/local-history-resources-1/vigo-county-marriage/2802/100591.pdf), page 591, appears to be a different couple (Reuben Sterling and Sarah J. Kesler). A new FamilySearch index result, [27VH-LZ2](https://www.familysearch.org/ark:/61903/1:1:27VH-LZ2?lang=en), names Howard Leslie and Mary J. Hovey for a marriage license dated 14 December 1871, Vigo County, page 591; spouse entry QPQ6-T7PN agrees. It links to [the Vigo marriage ledger image](https://www.familysearch.org/ark:/61903/3:1:3QS7-L97W-685S?view=index&personArk=%2Fark%3A%2F61903%2F1%3A1%3A27VH-LZ2&cc=1410397&lang=en), image 332 of 352. At that point the viewer scan appeared too blurred to transcribe; a full-resolution download inspected 7 October 2026 resolved the handwriting. The original names Howard Leslie and Mary J. Hovey, dates the license 12 December, and records their marriage on 14 December. See the later dated transcription note below, which supersedes this initial access assessment. Howard/Tillman and Mary/Mollie are not equated, and no marriage relationship is added. Finding/source `leslie-hovey-1871-familysearch-marriage-lead` / `leslie-hovey-1871-marriage-index-image` records the lead. The [Indiana State Library Vigo County guide](https://www.in.gov/library/collections-and-services/genealogy/indiana-county-research-guides/vigo-county/) identifies the County Clerk for original marriage records; [VCPL’s service policy](https://vigolibrary.org/wp-content/uploads/2025/08/VCPL-Policy-Manual.pdf) says off-site marriage-record retrieval is available at no charge. Next obtain a sharper page 591 copy via VCPL Special Collections or the Clerk and inspect the original license return.

The site findings are in `src/data/ancestry-research.ts`; the Sarah-to-Harry review link is in `src/data/ancestry-relationships.ts`. They have not been published.

An 1880 FamilySearch census-index result for James Leslie (MHMF-SJ8; Jackson Township, Carroll County, sheet 66B, household 6089740) reports James, 30, wife Tannie, 26, and Olie Leslie, 8. The linked viewer is image 569/805. This is a plausible earlier James household, but Tannie differs from later Frances/Francis E. and Olie is not younger Tillman. The original image has not yet been read clearly enough to upgrade the index claims. The exact-name indexed 1880 query for Tillman Leslie surfaced a different Tilman, born about 1847, in Owen Township, Warrick County, with spouse Misouri; identity with the older Tillman is unproven and location/family details do not presently fit the proposed group. Neither search result resolves younger Tillman’s parents.

### Leslie descendants documented in a 1926 court opinion

`Smith v. Leslie`, 85 Ind. App. 186, 151 N.E. 17 (10 March 1926), reports that Kahel Leslie, age 20, lived with his father Tilman Leslie, mother Bessie Leslie, sisters Frances (7) and Esther (9), and two unnamed brothers (14 and 17) in Camden. The opinion describes the fatal workplace accident and the family’s compensation claim. A digitized Camden local history calls the eldest son Kahle Leslie and describes what appears to be the same accident, supporting—but not conclusively proving—the Kahel/Kahle spelling match. Its OCR says the Center Garage was built in 1928, after the appellate opinion’s 1926 date, so the book’s page/date and accident chronology need checking against the scan and newspaper/court file. No precise birth or accident date is inferred from Kahel’s age. A derivative Camden Cemetery listing separately reports Kahel W. Leslie, 1903–1924 (aged 21); this is consistent with a pre-1926 death, but no underlying memorial, marker image or grave record was found, and the age conflicts with the court opinion’s 20. This lead is not treated as a verified date. The named children are added below younger Tillman on the local research map; the generated import is unchanged. The two brothers remain unnamed. Sources: [Smith v. Leslie](https://case-law.vlex.com/vid/smith-v-leslie-no-888919078); [Camden 150 Years](https://www.delphilibrarydigital.com/uploads/1/0/3/4/103477448/camden_150_years_ocr.pdf); [Camden Cemetery listing](https://peoplelegacy.net/martha_m_edison_leonard-1e157s).

The next online paths are a reported death entry/certificate for Kahel, the 1920 and 1930 Camden census images for younger Tillman’s children, and contemporary Camden newspaper coverage. Indiana’s state library confirms that full 1899–2011 death certificates are available through Ancestry Library Edition; the family’s 1911 and 1958 parent-naming certificates remain behind that access route. Carroll County’s newspaper archive now routes through the Indiana Newspaper Archive behind library-card access. Further online searching did not surface those images or an alternate public transcription. The discrepancy between the local history’s 1928 garage chronology and the 1926 case is recorded for follow-up rather than reconciled by assumption.

### 1910 census index identifies Kahel’s household

A broad FamilySearch record search surfaced **Kahel W. Leslie** in the 1910 Carroll County census: [MKG9-X38](https://www.familysearch.org/ark:/61903/1:1:MKG9-X38), linked to [schedule image](https://www.familysearch.org/ark:/61903/3:1:33SQ-GRJS-WRJ), image 798 of 1,437, Jackson Township, sheet 2B, NARA T624. The index gives Kahel age 6, born Indiana; parents **Tilman H. Leslie (28)** and **Bessie B. Leslie (25)**; brothers **Carl M. (3)** and **William H. Leslie (1)**; and paternal grandparents **James M. (60)** and **Francis E. Leslie (56)**. The index describes Kahel as a grandson in James’s household. I opened the schedule, but the display resolution did not permit an independent transcription of all relevant handwritten entries; relationships are therefore attributed to the index summary, not claimed as freshly read from the image.

This likely identifies the two brothers named but not named in the 1926 court opinion. William’s age 1 in 1910 fits an age near 14–17 at an accident around 1924; Carl’s age 3 is less tidy, and the exact accident date is not known. They are included on the research map as probable siblings and possible matches to the court’s brothers, not asserted as a proved cross-record identity. Kahel’s 1910 age implies about 1904, which is compatible with death aged 20 around 1924 but not enough to settle the cemetery listing’s 1903–1924 dates.

This also strengthens the proposed descent through younger Tillman: the 1926 opinion names Tilman as Kahel’s father; the 1910 index gives a Tilman H., age 28, in the right family and place. Matching that man to the imported younger Tillman remains probable because the 1900 census calls younger Tillman James’s nephew while the 1910 index calls him James’s son (Kahel’s grandfather is explicitly indexed as James). No older Tillman/Mollie parent edge is established by this finding.

FamilySearch’s own exact-name result for Kahel plus the restrictive 1903 birth year / 1924 death year / Carroll County filters returned zero; removing those restrictions surfaced the 1910 census entry. This is a reminder that a failed constrained search is not evidence the record is absent. The 1910 index now names the next lines to pursue: Carl M. and William H. Leslie in the 1920/1930 censuses and their own vital/marriage records. Source is recorded in `src/data/family.ts` as `leslie-kahel-1910-census-index`; finding `kahel-leslie-1910-household` was added to the website’s research overlay.

Next: Eugene’s 1943 uploaded marriage certificate or archival Wyoming marriage; Mark birth and Dorothy’s later Stockwell marriage; Curtis birth/Samuel-Luella marriage and Inez birth; Gloria/Brown/White close households and G5 originals. FamilySearch source records labelled NUMIDENT on Curtis’s page were his **children’s** applications, not Curtis’s own: 6K32-CPGF principal Dorothy, 6K3P-B881 principal Rex. The 1946 marriage81QQ-F6PZ is child Samuel Henry Macy’s, not Curtis’s own. Avoid repeating those as direct parent proof.

### Additional Leslie search audit — 6 October 2026

### Carroll County archive and 1916 county-history index follow-up — 7 October 2026

The official [Delphi Public Library Carroll County Newspapers page](https://www.delphilibrary.org/ccnewspapers)
now says the migrated newspaper archive is part of the Indiana Newspaper
Archive and requires a Delphi library-card number. The old
`carrollcountyin.newspaperarchive.com` URL fails DNS, but that is an obsolete
address, not evidence that no newspaper item exists. No card application or
identifying information was submitted. The older Indiana Bicentennial legacy
page still describes the former free interface and is stale on access.

The 1916 Odell county-history name index points to **Philip Leslie**, pages
283–284. The Archive.org OCR full text reports that Philip was born in 1836 in
Tippecanoe County to John Leslie and Catherine Mikesell, married Sarah Jane
Murphy in 1863, moved to Carroll County in 1865, and had six children named
Francis, Dora, Nevada T., Roscoe, Raymond, and Mabel. It says John and Catherine
had thirteen children and later moved to Illinois. This creates a useful
collateral research lead. A FamilySearch 1850 census search returned a
potentially matching household in Perry Township, Tippecanoe County: John
Lesley, 50, Pennsylvania; Catharine, 46, Pennsylvania; Philip, 14, indexed as
born Iowa; plus Susan (20), Levi (18), Isaac (16), Joseph (11), Catharine (8),
Luvina (4), and Sarah (2), all indexed with Iowa birthplaces. The same image is
indexed as household 5, image
https://www.familysearch.org/ark:/61903/3:1:S3HT-6QY3-JW2 and Philip's record
is MHVH-2RJ. The age and parents' birthplace fit the book sketch, but the
schedule image has not yet been transcribed. “Iowa” may represent period
abbreviation “IA” for Indiana, but this needs confirmation. The census does not
state household relationships. No relationship to Tillman H., James M., or
younger Tillman Howard Leslie is established. The biography is secondary,
probably family-supplied, and online OCR can contain errors. The 1916 title and
full text are at
https://archive.org/details/in-carroll-1916-odell/ and
https://archive.org/stream/in-carroll-1916-odell/in-carroll-1916-odell_djvu.txt.
Locate printed pages 283–284 in the scan and verify the reading before treating
individual details as established. Site finding
`carroll-leslie-philip-local-history-1916` records this explicitly as an
unconnected lead. Continue with the 1850 Tippecanoe household and the original
1863 marriage, then compare the 1860 and 1870 census records before testing any
relationship.

The USGenWeb Census Project’s [Hendricks County 1870 surname index](https://www.us-census.org/pub/usgenweb/census/in/hendricks/1870/indx-l.txt) was reviewed from the full name-sorted index. It has no Leslie entry and one Lesley entry, David, age 56, born Scotland; that man is not a fit for James M. Leslie (born about 1850 in Indiana) or older Tillman H. Leslie (born 1845). This narrows the published-index lead but cannot establish where the target men lived or rule out indexing/transcription errors. Original 1860 schedules and neighboring-county searches remain open. The index records its transcriber Meredith Thompson and proofreader Sally Hibbard, and points researchers to page transcription files for complete census details.

A [FamilySearch Ancestors profile for Mary Jane Hovey](https://ancestors.familysearch.org/en/LCXQ-N6K/mary-jane-hovey-1845-1920) reports a Mary Jane Hovey (1845–1920), married to Edgar Mantlebert Shepherd in 1867, living in Fayette Township, Vigo County, in 1880, and mother of five children. This could be a different woman from the Find a Grave memorial’s proposed Mollie Hovey Leslie (reported 1848–1881); the overlapping names and Vigo County context create an identity-collision lead. The profile is compiled genealogy and does not identify the Leslie Mollie or prove these women are the same. No identity merge or parent edge is made. Resolve by inspecting the original 1867 Shepherd–Hovey marriage, 1880 Fayette Township schedule, Woodlawn burial index entry, and the still-unverified 1871 Leslie–Hovey marriage.

FamilySearch’s 1880 census collection was queried for Tillman Leslie, Harry Leslie, Harry Lesley, and Hovey. Tillman, Harry, and Harry/Lesley restrictive-name searches returned no matches; the broad Hovey search returned 3,005 results across 61 pages and is not a useful negative without residence/name refinements. These search outcomes are recorded only as search leads, not as evidence of absence. The collection itself provides index and original images, and census schedules include household relationships; the next useful attempt is a residence-specific search around Fayette Township/Vigo County plus the original schedule. The 1870 index and this search audit have been added to the local website research overlay. No imported tree edits or external FamilySearch Tree edits were made.

### Further Leslie continuation — 6 October 2026

The official City of Terre Haute cemetery PDF, “Search the Old CEM Database,” is now located at [the city-hosted PDF](https://cms2.revize.com/revize/terrehautein/Documents/Services/Cemeteries/Search%20the%20Old%20CEM%20Database/cemetery-12-11-2012-formatted-for-printing.pdf). This is the combined Woodlawn/Highland Lawn database last updated through December 2012, not the underlying burial register. In its surname entries (PDF p. 311 for Hovey, p. 385 for Leslie), the only Woodlawn Leslie entry shown is “Infant of H,” interred 18 September 1873; the other Leslie entries are at Highland Lawn. The Hovey entries do not include Mollie/Mary Jane Leslie. This city index therefore fails to corroborate the Find a Grave memorial’s stated Woodlawn burial for Mollie, reported dead in 1881. It does not prove she was not buried there: a different recorded name, omission, or location remains possible. Interment.net explains that the city PDF combines two cemeteries and provides its converted surname pages; use its details as a guide, while citing the city PDF as the primary database source. Finding `mollie-hovey-woodlawn-city-index-audit` records the discrepancy without changing identity or relationships.

The handoff led to a residence-specific FamilySearch search that identified and enabled visual inspection of the original 1930 Camden schedule: NARA T626, ED 8, sheet 3B, household 82, image 178. It lists Tillman, Bessie and children William N., Esther R. and Frances E.; Fannie E. Leslie appears as a 76-year-old widowed lodger born Ohio. The 1940 Camden schedule (NARA T627, ED 8-8, sheet 4A, household 72, line 13, image 228) places Fanny Leslie, age 87, widowed and Indiana-born, in the same household cluster and records her as “Aunt.” The same place, widow status, surname and other household members make a cross-record match plausible, but age, birthplace and relationship conflict. She remains a provisional research identity (`p037`), not merged with Francis E. Leslie, and no aunt/parent edge is created. The census schedules are recorded as `leslie-camden-1930-census` and `leslie-camden-1940-census`; finding `leslie-camden-household-1930-1940` describes the comparison. Continue by comparing the 1900/1910 James household, locating Fannie in 1920, and pursuing James/Fannie death or burial records.

Best next actions: inspect 1860 Hendricks/Carroll original schedules; inspect 1880 Vigo/Carroll records and original 1867/1871 marriage evidence; seek the 1911 James and 1958 younger Tillman certificates through an authorized library resource; find Fannie in 1920 and compare death/burial records; and compare the city PDF with the original Woodlawn register and Mollie’s death record. No paid request, application, external tree edit, or production publication was made.

### 1880 Harry Leslie census-index continuation — 6 October 2026

A focused search of FamilySearch’s Indiana 1880 census index surfaced **Hary C. Lesley**, age 6, at Terre Haute, Vigo County: ED 211, sheet 379A, line 27, household 6421766; index MHSG-2G6, image 764 of 790. The index gives parents Mary Lesley and Howard Lesley, both born Indiana, and siblings Faney B. and Jessey Lesley. The index attaches the record to the Harry Carlton Leslie profile (LV8V-NG7), whose name/age/place are a plausible match to Harry Carter Leslie. That attachment is derivative, not identity proof. The linked image is an 1880 schedule page and was opened, but the scan is too soft for reliable independent reading of the names.

Harry’s separately indexed 1900 marriage to Ida M. Brechbiel (4YM2-6KT2), now rechecked in the FamilySearch result details, names Tillman H. Leslie and Mollie Hovey as his parents and reports his birth in Vigo County. Together, these indexes strengthen the case for Harry’s parentage while leaving a name-form puzzle: Mary/Mollie and Howard/Tillman might be variant or expanded forms, but are not yet equated. The 1880 entry implies a birth year of 1874, slightly different from the commonly reported 1875. No imported names or parent links were edited. Source `leslie-harry-1880-indiana-census-index` and finding `harry-lesley-1880-terre-haute-index` record the conflict. Next, obtain a sharper original schedule and compare it with the 1871 Tillman–Hovey marriage, Harry’s 1950 death record, and the 1900 original schedule.

The 1860 search now has a direct, free original-image route: NARA microfilm publication M653, reel 265, Hendricks County, digitized at [Internet Archive](https://archive.org/details/populationschedu265unit) by the Allen County Public Library Genealogy Center. The item metadata identifies the county reel; its images are browsable but have no OCR/name search. FamilySearch’s tested 1860 index queries for James Leslie and James Lesley in Hendricks County produced no matching entries. This is an index limitation/search audit, not evidence that the family was absent. The scan contains 882.9 MB of source images, so browse targeted township segments and any alternate spellings rather than treating the search as complete. Website access finding: `leslie-hendricks-1860-census-access`.

A 1920 census index search for Fannie Leslie also remains unresolved. FamilySearch’s 1920 collection was queried for Fanny in the Camden/Jackson/Carroll location with a 1852–1855 birth range (no match), then Fannie across Indiana with a 1850–1858 birth range (one generic “Leslie” result with no indexed given name). A broad Fannie Leslie search returned many unrelated nationwide entries. These are only index outcomes and do not exclude a differently indexed Fannie, Francis, Frances, or initials-only entry. The 1920 household and Fannie’s death/burial remain open record leads.

### 1850 Hendricks County Lasley index lead — 6 October 2026

The S-K Publications [1850 Hendricks County surname index](https://www.skcensus.com/1850-census-index-hendricks-county-indiana/) has no Leslie or Lesley entry but lists **LASLEY** at schedule pages 136A and 136B. The derivative index provides locators only; the pages have not yet been mapped to the manuscript images. The free original route is NARA M432, reel 150, [Internet Archive item 7thcensus0150unit](https://archive.org/details/7thcensus0150unit), contributed by the Allen County Public Library Genealogy Center. I opened the reader and confirmed it contains the Hendricks County 1850 schedules, but have not located either cited page or read a relevant Lasley household. This is a spelling/access lead, not evidence that a Lasley is related to James or Tillman Leslie. The site records it as `leslie-hendricks-1850-index-variant`; source entries are `leslie-hendricks-1850-index-variant` and `hendricks-1850-census-reel`. Next step: map pages 136A/B to the scans, inspect both households, and compare candidates with 1860/1870 evidence.

A full-resolution inspection of the original 1850 Danville schedule resolves the earlier FamilySearch index ambiguity. NARA M432 reel 150, FamilySearch image 279/350 is stamped page 136; image 280 is its unnumbered reverse. On the numbered face, the final two lines list John Lasley, 29, and Eliza Lasley, 33, under household number 792. The reverse continues that household with three boys: the name appears to read “Tilman A.”, 5; James M., 3; and James M., 4/12. Their birthplace is Indiana. FamilySearch indexes the first boy as “Jig?an A” (MHJV-SJ4), and splits the two James rows into separate entries (MHJV-SJH, MHJV-SJC). The original schedule confirms the ages are separate rows and makes “Tilman A. Lasley” an age/place candidate for the imported Tillman H. Leslie (born 1845); surname and middle initial differ, so identity remains provisional. The 1850 schedule does not specify kinship, so John and Eliza are not added as parents, and no identity or relationship edge was added. S-K’s 136A/136B index locator is now mapped to these adjacent images. Site findings `leslie-hendricks-1850-lasley-candidates` and `leslie-hendricks-1850-index-variant` were updated. For 1860, use approximate ages 15 for Tilman and 10 or 13 for the two distinct James entries as search targets only; test each boy independently and compare John and Eliza household candidates before assigning any identity. Then check 1870 schedules and independent Tillman records.

### Indiana death-index search for James M. Leslie — 6 October 2026

A FamilySearch search of the Indiana, Death Index, 1882–1920 (collection 1947977), for Leslie entries with indexed birth years 1848–1852 returned 26 records but did not surface James M. Leslie’s reported 1911 death. The indexed James Leslie near that birth range died in 1894. Supplemental James Leslie and James Lesley searches bounded to deaths 1909–1913 each returned four results; the indexed male James entries were James S. Leslie, born 1833/died 1913, and James Lesley, born 1837/died 1913, not a match to the target. One distinct candidate by timing is David Leslie, age 63, indexed as dying 23 December 1911 in Muncie ([record VZ7Q-7CR](https://www.familysearch.org/ark:/61903/1:1:VZ7Q-7CR?lang=en)); the detail page cites WPA book CH-8, page 38, City Health Office, Muncie, and says no image is available. David’s name and age do not match James M., so no identity or relationship is inferred. These are derivative, constrained searches, not proof that James’s death registration is absent or missing from the collection. Finding/source `leslie-james-1911-indiana-death-index-audit` records the search boundary and the register-page lead. Next, obtain the underlying registration through an authorized library collection or relevant local register; compare parents, age, residence, and informant with the 1910 Carroll household.

### FamilySearch death indexes and certificate access — 6 October 2026

The FamilySearch Indiana Deaths and Burials, 1750–1993 collection was searched for Tillman Leslie, Indiana, 1957–1959; it returned zero. A 1911 Indiana James Leslie query returned J. H. Leslie (index HP7S-YH3Z), whose record names Mary White Cotton as spouse and Lida J. Watkins as child; this is unrelated to James M. Leslie of Carroll County. This broad collection is not complete, so neither result establishes that a certificate is absent. The Indiana State Archives’ [vital-records guide](https://www.in.gov/iara/services-for-public/search-archives-holdings/vital-records/?a=311686) confirms that unofficial copies of Indiana death certificates from 1899–2011 are available through Ancestry; the public [Indiana death certificates collection](https://www.ancestry.com/search/collections/60716) was accessible, but record search required signing in. No login or order was made. Site findings `leslie-james-1911-indiana-death-index-audit` and `leslie-parentage-death-certificate-access`, and source entry `indiana-death-certificates-ancestry-access`, record the audit and route. The next high-value evidence is the full image for James’s reported 1911 death and younger Tillman’s reported 1958 death; compare named parents with the 1850 Lasley candidate and the conflicting 1900/1910 relationship labels.

### Original 1910 Leslie household transcription — 6 October 2026

Downloaded the original FamilySearch/NARA T624 image 798 at full resolution and read Jackson Township, ED 35, sheet 2B, household 51, lines 69–75. The schedule lists James M. Leslie, head, 60; Francis E., wife, 56; Tilman H., son, 28; Bessie B., daughter-in-law, 25; and Kahel W. (6), Carl M. (3), and William H. (1) as grandsons. The relationship handwriting is legible in the high-resolution scan and agrees with the index. This is now an original-record finding, not an index-only claim. It strengthens the 1910 household assertion that James was younger Tillman’s father, but the 1900 original calls Tillman James’s nephew. The contradiction remains unresolved; neither census connects James to older Tillman H. Leslie (1845–1899), and no family-tree relationship was added. Findings `tillman-howard-leslie-1900-census`, `james-leslie-probable-brother`, and `kahel-leslie-1910-household`, plus the corresponding source records/person facts, were updated. Next prioritize James’s 1911 death certificate and younger Tillman’s 1958 certificate for named parents; use the 1860 Hendricks schedule age targets as supporting comparison, not as a substitute. Original schedule: [FamilySearch image 798](https://www.familysearch.org/ark:/61903/3:1:33SQ-GRJS-WRJ?view=index&personArk=%2Fark%3A%2F61903%2F1%3A1%3AMKG9-X38&action=view&cc=1727033&lang=en).

### Leslie 1920 household and older-woman census trail — 6 October 2026

FamilySearch’s 1920 census index places Taunie Leslie, 66, widowed and Ohio-born, in Deer Creek Township household 42 with Tillman, Bessie and their children. It labels her Tillman’s “Aunt.” The same household index has Wm, 10, as a son and Kobel, 16, alongside Carl, Ester and Frances. The original scan (image 844/1,157) is too soft here to independently transcribe the names or relationships. Records: [Taunie index MFQ2-PT9](https://www.familysearch.org/ark:/61903/1:1:MFQ2-PT9?lang=en), [Wm index MFQ2-PRB](https://www.familysearch.org/ark:/61903/1:1:MFQ2-PRB?lang=en), [Taunie-linked original schedule image](https://www.familysearch.org/ark:/61903/3:1:33SQ-GR6F-B2?view=index&personArk=%2Fark%3A%2F61903%2F1%3A1%3AMFQ2-PT9&action=view&cc=1488411&lang=en).

The index trail suggests Wm Leslie (1920, age 10) and William N. Leslie (1930, age 21, son of Tillman/Bessie) may be the William H. Leslie aged 1 in the 1910 index. The age and family context fit, but the middle initial changes H/N and the name is not independently resolved. Kobel Leslie (1920, age 16) may likewise be Kahel/Kahle (age 6 in 1910); this is only an age/name-variant lead pending a sharper schedule. Do not merge by these index matches alone.

Taunie 1920 (66), Tannie 1880 (26), Fannie 1930 (76) and Fanny 1940 (87) form a plausible age/place sequence; the 1910 index has Francis E. Leslie, 56, Ohio-born, as James M. Leslie’s wife. However, relationship labels conflict: “Aunt” in 1920 and 1940, lodger in 1930, wife in 1910. This remains a provisional identity hypothesis, not a proven link to James or Mollie and not a basis for a kinship edge. The local overlay now records the 1920 source and these leads. Next inspect sharper original schedules, locate James’s 1911 registration, and search death/burial records for Francis/Fannie/Tannie/Taunie. No tree merge, external FamilySearch edit, or publication was made.

### 1860 index audit — no Hendricks match surfaced yet

In FamilySearch’s 1860 census collection, the query for James Leslie with indexed birth 1848–1852 returned five Indiana results: Clark, Warrick, Whitley, Jefferson and Morgan counties; none was in Hendricks. The Tillman Leslie query (birth 1843–1847, Indiana residence) returned one fuzzy result in Putnam County, index M4NG-G3M. Its details identify an unnamed/illegible female, age 13, Kentucky-born, so it is not the older Tillman candidate. The schedule scan was opened and remains too soft for name transcription. This is a constrained index audit only, not evidence that James or Tillman was absent. Source `leslie-putnam-1860-index-mismatch`; updated lead `leslie-hendricks-1860-census-access`. Next: manually browse NARA M653 reel 265, township by township, including near-name and unindexed boys; compare full households against the 1850/1870 candidates and seek James’s 1911 and younger Tillman’s 1958 death certificates. FamilySearch results: [M4NG-G3M index](https://www.familysearch.org/ark:/61903/1:1:M4NG-G3M?lang=en), [linked image](https://www.familysearch.org/ark:/61903/3:1:33S7-9B9J-9821?view=index&personArk=%2Fark%3A%2F61903%2F1%3A1%3AM4NG-G3M&action=view&lang=en).

### Mark Stockwell birth-record access audit — 6 October 2026

FamilySearch Historical Records was searched for Mark Allen Stockwell, birth
year 1940; the result page returned zero matches. This is only a search result,
not evidence that his certificate is absent. The [Indiana State Library
genealogy FAQ](https://www.in.gov/library/collections-and-services/genealogy/brochures-and-maps/genfaqs/?a=189359)
says public Indiana birth certificates dated 1907–1940 are available through
Ancestry Library Edition and Ancestry.com. Mark’s grave marker reports 5
November 1940, and Dorothy Macy / Eugene Howard Leslie’s marriage index is dated
11 May 1940, but neither record proves Mark’s biological father. The overlay
records the search boundary and access lead as `mark-birth-certificate-access`.
Next inspect the certificate for Mark A. Stockwell, Muncie, or Leslie under the
5 November date; if unavailable, check the county register and delayed/amended
record indexes. No parent edge or date was changed.

### Pietrabbondante register access audit — 6 October 2026

FamilySearch’s official [Italy, Isernia civil registration
collection](https://www.familysearch.org/en/search/collection/3049866)
includes a browse path to Pietrabbondante, where the 1840 packet locates the
candidate parents of Ohio Concezio Mangini. Its waypoints list 1810 onward
marriages and later birth, marriage, and death registers. Opening the 1810
marriage volume produced the site’s image-restriction notice: viewing requires
a FamilySearch Center or affiliate library. This is a lawful access route, not
a record of the Mancini family. The 1840 packet’s extract reports that the
groom Concezio Eduardo Mancini was baptized/born in 1809, so a marriage volume
starting in 1810 should not be assumed to contain his parents’ marriage.

A name search for Vincenzo Mancini with a 1770–1790 birth range returned no
result, but it was limited to indexed birth events and cannot establish
absence. Finding `pietrabbondante-record-access` records the collection path,
restriction, and search boundary. At an authorized center/library, check the
1810–1865 Pietrabbondante birth/death registers and indexes for later events of
Vincenzo Mancini and Giuseppa Di Pinto; use the 1839 parish extract in the 1840
marriage packet to identify the pre-1809 parish register for their marriage
and earlier generations. Keep the Ohio connection and all proposed parent
links provisional.

### Leslie line continuation — public index and township audits — 6 October 2026

Indiana State Library's free [Indiana Legacy](https://digital.statelib.lib.in.us/legacy/)
was searched for Kahel/Kahle Leslie. The combined query “Kahel Leslie” returned
no entries. “Kahel” alone produced an unrelated VINE obituary for Annie F.
Monroe whose remarks mention her parents George and Mrs. Kahel. The VINE death
search for “Kahle” returned three entries indexed as Kahler (Mary E twice and
one unnamed entry); the 17 obituary results were not indexed as the Leslie
family. A separate [Hoosier State Chronicles](https://newspapers.library.in.gov/)
search found no exact-phrase hits for “Kahel Leslie,” “Kahle Leslie,” or
“Tillman Leslie” in its 1920s corpus. Its one-word “Kahel” hit was an
Indianapolis News picture-frame advertisement from 15 December 1920. These
searches provide no death or accident article. Both indexes have incomplete
local newspaper/vital-record coverage, so their results do not establish that
the 1924 certificate or newspaper notice is absent. Finding
`kahel-leslie-indiana-legacy-audit` records the query scope and false positives.

The [Indiana State Archives catalog](https://researchindiana.iara.in.gov/solr/axaem/Series)
was searched for Industrial Board records. Series 76-28, “Historical and
Archival Agency Records -- Inactive,” describes two boxes (1.4 cubic feet) of
inspection reports dated 1925–1930 and workplace inspection reports, not
individual compensation case files. The appellate opinion in Smith v. Leslie
gives the appeal number 12,261; the Indiana [Workers' Compensation Board
public-record request page](https://wcbgateway.wcb.in.gov/WCBToolsAngular/recordsearch)
is the next agency route to ask about the underlying Industrial Board claim
and award. Its current page says accident and attending-physician reports
require signed authorization from an employee, employer, or legal
representative. No request was submitted and no file was inspected. Finding
`kahel-leslie-compensation-file-access` records this route and its access
limits. Next check Carroll County's 1924 death register for Kahel, Kahle,
Kobel, and initial variants; pursue the public portions of the claim/award
through authorized archival or agency access. The death year remains
provisional.

The 1860 FamilySearch browse path was also checked at image-index level for
Hendricks County's Danville Township, where the 1850 Lasley candidates were
indexed, and Center Township. Across all 23 Danville and 35 Center Image
Index pages, no Leslie, Lesley, or Lasley entry surfaced. This was a
surname-index scan, not a line-by-line read of the original census schedule
and not proof the family was absent. Other Hendricks townships, unindexed
entries, alternate names and handwriting remain open. The site records
`leslie-danville-1860-index-page-audit`; continue with the rest of reel
M653/265 and compare full households with the 1850 and 1870 evidence.

### Additional Hendricks surname-index checks

The Allen County Public Library Genealogy Center's searchable [1853
Hendricks index](https://www.genealogycenter.info/search_hendricks1853.php)
covers only white male inhabitants over 21 and records only first and last
names. Fuzzy surname searches for Lasley and Leslie each returned zero; the
combined Lasley/Tillman search also returned zero. This does not test the
proposed 1850 Lasley boys, who would have been under 21 in 1853. The county
index result cannot establish absence or identity; finding
`leslie-hendricks-1853-adult-male-index-audit` records the scope and limits.

The Plainfield-Guilford Public Library's 1845 Hendricks voters transcription
was searched for Lasley and returned no hit. A Hendricks genealogy blog's
summary of the 1847 county-coroner election lists “J.G. Lasley” with two
votes. The latter is a tally of candidate votes, not an identified voter or
proof of residence, and it does not connect that person to the 1850 schedule
or the later Leslie line. Both records are contextual leads only; no person
or relationship has been added from them.

The Franklin Township portion of the same 1860 FamilySearch Image Index was
also reviewed across all 29 images for Leslie, Lesley, and Lasley; no matching
indexed names surfaced. The site finding `leslie-danville-1860-index-page-audit`
now covers Danville (23 pages), Center (35), and Franklin (29). This remains an
index-only check: other Hendricks townships and original schedule handwriting
are still unreviewed.

Two further 1860 FamilySearch Image Index sets were reviewed across every
visible image: Guilford Township (42 images) and Liberty Township (45 images).
Neither exposed Leslie, Lesley, or Lasley among its indexed names. The local
finding `leslie-danville-1860-index-page-audit` now documents five township
sets; it remains an index review only, not a census-schedule transcription or
countywide negative result.

### Kahel Leslie death-record access route

The Indiana State Library's official [Carroll County guide](https://www.in.gov/library/collections-and-services/genealogy/indiana-county-research-guides/carroll-county/)
lists its online death-index resources only through 1920 and names the Carroll
County Health Department as custodian for original death records. The
Department's [Vital Records page](https://www.in.gov/localhealth/carrollcounty/vital-records/)
describes its certificate process and applicant eligibility. This gives a
specific official route for testing the tentative 1924 Kahel/Kahle cemetery
date; it does not show that a 1924 record exists. No request was submitted.
Site finding: `kahel-leslie-1924-carroll-death-access`. Next determine whether
the county allows an index-only inquiry and what applicant category may obtain
a certificate before making any request.

The S-K index's page-numbering note clarifies that an A side is the numbered
page and the B side is its unnumbered reverse immediately following it on the
film. This narrows the 1850 LASLEY lead to the adjacent face/reverse pair for
stamped page 136; it still does not map that page to a scan number. See
`leslie-hendricks-1850-index-variant`.

### 1860 Lashley and 1868 Lasley local leads

The Plainfield-Guilford Public Library transcription of the Hendricks County
November 1860 voters list includes “Lashley, J.G., Center Township” (PDF p. 46,
printed list p. 45). A separate 1868 Hendricks County directory transcription
lists “Lasley John J” among carpenters and builders at Amo. The voter list has
no exact Lasley or Leslie entry. These are separate spelling and locality
leads only: “J.G.” and “John J.” differ, the directory page was not inspected,
and neither source gives a household or a relationship to the 1850 John and
Eliza Lasley family. No person or relationship has been added. Next inspect
original 1860 Center Township schedules for Lashley/Lasley variants, then check
the directory image and local land, tax, probate, and marriage records before
linking either adult to the 1850 candidates. Site findings:
`leslie-hendricks-1860-lashley-voter-lead`, `hendricks-1860-voters-lashley`,
and `hendricks-1868-directory-john-lasley`.

A FamilySearch 1860 collection search for the selected Hendricks County
residence and surname Lashley returned zero indexed records. This conflicts
with the independent voters-list transcription’s Lashley entry, so the index
negative cannot rule out an 1860 household and makes original schedule review
more valuable. Finding `leslie-danville-1860-index-page-audit` now includes
this search and its limitation.

### Howard Lasley Civil War lead

Indiana Archives and Records Administration's statewide Adjutant General index returns two Civil War entries for Howard Lasley, each age 18: 117th Indiana Infantry, Company B (record 109646) and 132nd Indiana Infantry, Company H (record 109647). The county library's 2026 Archival Collection Master Index, page 15, under Hendricks County Military, lists a certificate of honorable service for Private Howard Lasley, 132nd Regiment, dated 15 December 1864. These details make Howard a useful local Lasley research lead. The state index county facet returned zero, so it should not be used to exclude a Hendricks connection.

Neither the service file nor the certificate has been inspected. The roster entries could reflect successive service, but that is not yet proven. Howard is not a person in the family overlay and is not linked to John or Eliza Lasley or the boys in the 1850 household. Site records: `hendricks-howard-lasley-civil-war-index`, `leslie-hendricks-howard-lasley-military-lead`. Next inspect/request the certificate in Plainfield Public Library Acid Free Box 14 and compare it with the Adjutant General service cards and original 1850/1860 household records.

### Howard Laslie / Howard Tillman Leslie identity hypothesis

A targeted roster and headstone-card search substantially strengthens the possible match between the 1850 Hendricks County Lasley child and older Howard Tillman Leslie. The IARA Adjutant General index has Howard Lasley, age 18, Company B, 117th Indiana Infantry (entry 109646), and Howard Lasley, age 18, Company H, 132nd (109647). The NPS unit history gives the 117th's service as 17 September 1863 through 23–27 February 1864, fitting an age-18 recruit born about 1845. A transcription of the federal RG 92/M1845 headstone-card index lists Howard Laslie/Leslie, Pvt., Company B, 117th Indiana, buried at Camden, died 26 September 1899, with a headstone contract dated 25 August 1902; its alternate Laslie entry says “See Howard Leslie.” This matches the exact death date and Camden Cemetery reported for older Howard Tillman Leslie by the community Find a Grave memorial. The 1850 original includes a possible “Tilman A.” Lasley, age 5, in Hendricks County, compatible by age and place.

Taken together, this is now a probable identity hypothesis, not merely an unlinked lead. Still, surname and middle-initial/name conflicts remain, the federal card has only been inspected through a derivative transcription, and older Tillman's birth/burial details remain community-memorial claims. The 132nd entry/certificate may reflect later service but has not been matched to the 117th soldier. The site adds no identity merge and no parent/sibling edge. Finding `leslie-howard-lasley-tillman-identity-hypothesis`; source `leslie-howard-headstone-card-transcription`. Next inspect NARA M1845 roll 13, the two state service cards/rosters, and the library certificate; seek a primary 1899 death/burial record and review the 1850/1860 household evidence.

### FamilySearch headstone-card transcript and conflicting burial date

The federal NARA M1845 collection is now located through FamilySearch record V6HW-F5W, image 527 of 842 (DGS 7847132), card image ark 3:2:77TD-V5JJ. The record's full-text OCR reports Howard Leslie, Private, Company B, 117th Indiana Infantry, Camden, Indiana, died 26 September 1899; Vermont Marble Company supplied the headstone under contract dated 25 August 1902. The image viewer displays a contract restriction and does not show the card; these details are from the collection index/OCR, not a visual reading. IARA's Adjutant General index entry 109646 independently lists Howard Lasley, age 18, Company B, 117th. Together with the 1850 age-five “Tilman A.” Lasley candidate and the older Howard Tillman Leslie memorial's 1845 birth / 1899 death / Camden burial, this creates a strong but provisional identity hypothesis. No merge or parent/sibling edge added.

A material conflict surfaced: PeopleLegacy's Howard Leslie results list “Howard T Leslie,” 1845–1895, Camden Cemetery. This conflicts with the federal card OCR and Find a Grave's 1899 death date. PeopleLegacy provides no underlying marker image/citation in the result. The card image is not accessible here, and the Find a Grave item is community-maintained, so the discrepancy remains unresolved. Site findings: `leslie-howard-lasley-tillman-identity-hypothesis`, `leslie-howard-tillman-cemetery-date-conflict`; source `leslie-howard-headstone-card-transcription`, `leslie-peoplelegacy-older-tillman-dates`. Next secure Camden Cemetery's lot/ledger card and inspect Section B, Row 14 marker; compare the 1899 death registration, obituary, NARA service cards, and original 1860 schedule before identifying the records.


### Earlier Hendricks Lasley and James Leslie death-record routes

FamilySearch's 1840 census index lists Aaron Lassley in Hendricks County,
Indiana, page 32 (NARA M704; index XHBK-WJT). The linked original schedule
viewer did not finish loading, so no household counts or original handwriting
were read. Aaron is recorded as an unlinked locality/surname lead only; the
index does not connect him to John and Eliza Lasley, their 1850 household, or
the later Leslie line. Reopen the schedule through another accessible image
provider before drawing anything from its household composition. Site source
and finding: `leslie-aaron-lassley-1840-census-index`,
`leslie-aaron-lassley-1840-locality-lead`.

A focused FamilySearch Indiana Death Index search for James Leslie, Carroll
County, 1911 returned no result. The Indiana State Library's official Carroll
County guide lists a WPA death index for 1882–1920 and identifies the Carroll
County Health Department as custodian of original death records. This creates
a more specific next route: search the physical WPA volume at the Indiana State
Library or Allen County Public Library for James/Jas/J.M. Leslie and variants,
then use any register reference to locate the 1911 certificate. No county
request was submitted; the Health Department page has applicant eligibility
requirements. Site finding `leslie-carroll-1911-death-index-access`, source
`carroll-county-death-index-access`.


### 1860 Brown Township image-index audit

I used the FamilySearch 1860 Hendricks County image viewer to check all 50
Brown Township image-index pages, searching the visible entries for Leslie,
Lesley, Lasley, Lashley, Lassley and Tillman variants. No candidate appeared.
This is a derivative index check, not a transcription of the manuscript
schedules, and does not exclude a name/index error or a household elsewhere.
The earlier note that Brown Township did not expose an image index was stale;
the page counter and index table were available and all 50 pages were reviewed.
Finding `leslie-danville-1860-index-page-audit` now covers six of the 17
FamilySearch Hendricks township/place sets: Danville (23), Center (35),
Franklin (29), Guilford (42), Liberty (45), and Brown (50). Eleven sets and
the original schedule transcription remain open.


### Complete FamilySearch 1860 Hendricks image-index pass

The FamilySearch browse hierarchy lists 17 Hendricks County township/place
sets. I reviewed every image-index page in each set, 427 pages total: Brownsburg
(4), Brown (50), Center (35), Clay (30), Danville (23), Eel River (4), Edriver
(31), Franklin (29), Guilford (42), Liberty (45), Marian (31), Middle (35),
New Winchester (4), North Salem (3), North Salem Ed River (1), Union (24), and
Washington (36). I searched the visible index rows for Leslie, Lesley, Lasley,
Lashley, Lassley and Tillman variants. No candidate surfaced. This fully closes
the FamilySearch *image-index* survey for Hendricks County; it does not read
the 427 handwritten census schedule pages or exclude indexing errors. The
separate J.G. Lashley voters transcription makes that limit concrete. No
family relation or identity exclusion follows. Source finding
`leslie-danville-1860-index-page-audit` updated. The next step is now an
original-schedule inspection targeted to the 1850 John/Eliza Lasley household
and separate boys; the index-negative search itself should not be repeated.


### Original 1880 Terre Haute schedule read for Hary C. Lesley

FamilySearch image 764/790 for the 1880 census index MHSG-2G6 is a readable
original NARA T9 schedule: Vigo County, Terre Haute, ED 211, sheet 379A, page
1, family 5, lines 25–30, enumerated 9 June 1880. I read Howard Lesley, 35,
carpenter, born Indiana; wife Mary, 31, born New York; Hary C., 6; Fanny B.,
2; and Jessey, 1, all children born Indiana. Kate Snedeker, 15, is listed as
a servant. This independently confirms the index's household names and
relationships. M.W. Hovey, 35, and W.S. Hovey, 33, follow in separate
households; adjacency alone does not establish kinship.

The household strengthens, but does not prove, the hypothesis that Hary is
Harry Carlton Leslie and Howard may be the older Tillman Leslie. Harry's 1900
marriage index names Tillman H. Leslie and Mollie Hovey as parents, while this
schedule names Howard and Mary (Mary born New York). The Mary/Mollie, Howard/
Tillman and birthplace differences remain unresolved. No person merge or
family relationship was added. Updated findings
`harry-lesley-1880-terre-haute-index` and source
`leslie-harry-howard-household-1880-original`. Next compare the 1871 Leslie–
Hovey marriage and original 1900 marriage return, then locate independent
military/death evidence for Howard before considering an identity link.


### Original 1871 Howard Leslie–Mary J. Hovey marriage ledger transcribed

FamilySearch image 332/352 is the original Vigo County marriage register,
page 591 (Vigo Marriage Records, 4 March 1869–9 January 1872). A full-resolution
JPG download inspected 7 October 2026 resolves the previously reported blur.
The handwritten license names Howard Leslie and Mary J. Hovey and is dated
12 December 1871. The return signed by James W. Green states that he joined
them in marriage on 14 December 1871. This explains why indexes differ: the
FamilySearch record assigns 14 December to its license event and the county
library index gives 13 December, while the original distinguishes license
issuance (Dec. 12) from the marriage (Dec. 14). The indexed names are confirmed
by the original. This is a strong name-level match for the 1880 Howard and Mary
Lesley household, but it supplies no Howard middle name or Mary maiden name
beyond Hovey. Harry's 1900 marriage index instead names father Tillman H.
Leslie and mother Mollie Hovey; Mary/Mollie and Howard/Tillman remain hypotheses.
Do not merge people or add parent/spouse edges until an independent identity
record resolves those conflicts. Site finding `leslie-hovey-1871-familysearch-
marriage-lead` and source `leslie-hovey-1871-marriage-index-image` updated;
compare with Harry's original 1900 marriage return and the two Tillman death
records.


### Harry and Ida Leslie 1900 marriage image access check

Reopened FamilySearch record 4YM2-6KT2 on 7 October 2026. The index reports
Harry C. Leslie, born Vigo County, with indexed parents Tillman H. Leslie and
Mollie Hovey, and marriage to Ida M. Brechbiel on 21 March 1900 in White
County. Selecting “Check Image Availability” confirms the image exists but is
restricted to a FamilySearch center or affiliate library; it is not available
in this home session. No attempt was made to bypass the restriction. The
1900 parental names remain index evidence, and the original return is still
the next high-value record to compare against the original 1871 license/return
and 1880 Howard/Mary Lesley census. Source `harry-leslie-marriage-1900-index`
and finding `harry-leslie-parents-1900` updated to distinguish indexed claims
from an uninspected original and to record the access route.


### Mapped the Center Township 1860 schedule segment to the NARA reel

A new pass through FamilySearch browse confirmed that Center Township has 35
Image Index pages. Its first index page includes schedule Page Number 24; the
last index page includes 58 and 59. Internet Archive reel 265 can be navigated
by page number: image n25 visibly shows census schedule page 24, headed “The
Town of Danville,” Hendricks County, enumerated 4 June 1860. The schedule
heading is verified; its household rows have not yet been transcribed. These
bookends identify pages 24–59 as the priority original-schedule span for the
1850 Danville Lasley household and the independent 1860 Center Township voter
lead “J.G. Lashley.” Treat the range as a working map and confirm each scan’s
caption while reviewing; the FamilySearch index remains negative for all
Leslie/Lesley/Lasley/Lashley/Lassley/Tillman variants. No relationship has
been added. Updated `leslie-hendricks-1860-census-access`; next read original
schedule pages 24–59 and compare complete households against 1850/1870.

### Verified the next Center Township schedule headings and searched death indexes

Internet Archive reel images n25–n28 visibly show Hendricks County Center
Township schedule pages 24–27. Page 24 identifies “The Town of Danville” and
the 4 June 1860 enumeration date. I checked the page headings, but did not
complete a legible transcription of the household rows; these pages therefore
do not yet establish whether the Leslie/Lasley family is present.

I also searched the Indiana State Library Indiana Legacy VINE Death index for
James Leslie; it returned no matches. The FamilySearch Indiana Death Index,
1882–1920, queried for James Leslie, death 1910–1912, returned Emma J. Leslie
(born 1887, Terre Haute, 1911), which does not fit James M. Leslie of Camden.
These are bounded index searches, not proof the 1911 certificate or any death
record is absent. Updated `leslie-hendricks-1860-census-access` with these
limits; continue the original schedule review and pursue the certificate in
Ancestry Library Edition or an authorized archive resource.

### Continued the original schedule review through page 33

Later on 7 October, I checked the original schedule headings and household
heads for Center Township pages 29–33 (Archive images n30–n34). The pages
remain in Hendricks County; page 33 records enumeration on 6 June 1860. I
found no clearly legible Lasley, Lashley, Leslie, or Lesley household head in
this bounded span. Page 28 was only partly inspected, and pages 34–59 remain
unreviewed; this is not a complete negative for Center Township. No family
identity or relationship was added. Updated `leslie-hendricks-1860-census-
access`; next resume with page 28’s unread rows and pages 34–59, recording
complete candidate households before comparing them with the 1850 schedule.

### Continued the reel review through Archive image n38

On 7 October, I continued through Internet Archive images n35–n39. The
handwritten schedule numbers visible in that reel stretch are 56, 55, 36, 37,
and 38, so the image order does not track the census page numbers monotonically.
The pages identify Center Township, Hendricks County. I screened the readable
household-head rows on pages 55–38; no clearly legible Lasley, Lashley, Leslie,
or Lesley match appeared. Portions of pages remain offscreen or unchecked, and
this is not a complete name-by-name census search. No identity or relationship
was added. Finding `leslie-hendricks-1860-census-access` now records the image
and schedule numbers separately. Continue from n39, capturing each handwritten
page number, and return to page 28 and the still-unreviewed rows before treating
the Center Township segment as screened.

The next scan, Internet Archive image n40, is handwritten schedule page 39,
Center Township, enumerated 8 June 1860. Its visible household heads were
reviewed and none clearly reads Lasley, Lashley, Leslie, or Lesley. Rows below
the inspected viewport remain unchecked. The bounded result is recorded in
`leslie-hendricks-1860-census-access`; continue at image n41.

Image n41 shows handwritten Center Township schedule page 40, enumerated 8
June. I reviewed its visible household heads; no clear
Lasley/Lashley/Leslie/Lesley spelling appeared. Continue at image n42, verify
its handwritten page number, then proceed through the remaining mapped span;
page 28 and unchecked rows still need review.

Continued through Archive images n42–n46. The handwritten schedule pages are
42, 41, 43, 44, and 45; the headings identify Center Township and dates 8–9
June 1860. I reviewed the visible household heads on each, and none clearly
reads Lasley, Lashley, Leslie, or Lesley. Individual page rows outside the
viewport remain unchecked, so this does not establish that the surnames are
absent from every household. Updated `leslie-hendricks-1860-census-access`;
resume at image n47 and continue confirming the handwritten page number on
every scan.

Archive image n47 is handwritten Center Township schedule page 46, dated
9 June 1860. The visible household heads show no clear target spelling. The
bounded scan note now includes page 46; resume at image n48. Pages 28 and
unread rows still require review.

Continued through Archive images n48–n50, showing handwritten schedule pages
47–49 in Center Township. Their headings date the sheets 9–11 June 1860. I
reviewed the visible household heads; none clearly reads Lasley, Lashley,
Leslie, or Lesley. Many individual rows remain untranscribed. Updated
`leslie-hendricks-1860-census-access`; resume at n51 and continue mapping the
reel images to handwritten pages. Page 28 and other unchecked rows remain.

Archive image n51 shows handwritten Center Township schedule page 50, dated
11 June 1860. Its visible household heads contain no clearly legible target
spelling. Updated the bounded finding; resume at image n52 and keep the
handwritten schedule number distinct from the Archive image number.

Archive image n52 is handwritten Center Township schedule page 51, also dated
11 June. Its visible household heads show no clear target spelling. The local
finding now includes the bounded visible-name check through page 51; resume at
image n53. Rows remain untranscribed, and page 28 still needs its unread rows.

### Liberty Township boundary and schedule continuation — 7 October

The original headings correct the assumed township boundary: Archive image
n60 is handwritten schedule page 59, headed Liberty Township, while page 58
remains a previously reviewed Center Township sheet. Images n61–n74 show handwritten Liberty Township
pages 60–73; the visible headings date the sequence across mid-to-late June
1860. I checked
the visible household rows and found no clearly legible Lasley, Lashley,
Leslie, or Lesley spelling. Viewer crops leave many rows unchecked, so this is
not a complete transcription or proof of absence. Updated
`leslie-hendricks-1860-census-access`. Images n78–n89 continue Liberty Township
through handwritten schedule page 88; the visible portions contain no clearly
legible target surname, but rows remain unchecked. A further pass corrected the page-24
caption: Archive image n25 page 24 is headed Center Township, with Danville as
the post office, not “The Town of Danville.” Image n75 is another handwritten
page 24 but is headed Danville Township; images n76–n89 return to Liberty
Township pages 75–88. Page numbers repeat and the reel jumps between township
segments, so record each handwritten page and heading separately rather than
infer continuous coverage. Resume at n90. No person or relationship was
added.

### Continued 1860 Hendricks County original schedule scan — 7 October

Archive image n104 shows handwritten schedule page 103, Liberty Township,
Hendricks County. Images n105–n116 show Guilford Township, Hendricks County,
with handwritten pages 104–115, enumerated 25–27 June 1860; the post office is
Plainfield. The visible household portions on n105–n116 show no clearly
legible Lasley/Lashley/Leslie/Lesley candidate. Many rows extend below the
viewer crop and have not been transcribed. This confirms that the reel changes
townships after page 103; it does not demonstrate absence from the census.
Updated `leslie-hendricks-1860-census-access`. Resume at image n117 and continue
checking handwritten captions, then return to the unreviewed Center Township
page 28 and its unchecked rows. No identity or relationship was added.

Indiana State Library guidance confirms that full images for Indiana death
certificates 1899–2011 are available through Ancestry Library Edition at the
library, and Indiana Archives and Records Administration says unofficial copies
through 2011 may be obtained on Ancestry. This confirms the earlier access lead,
not the existence or contents of either target certificate. No paid request or
certificate order was placed. Sources: Indiana State Library, “Birth, Marriage,
and Death Records in Indiana” (rev. Sept. 2024), and IARA “Census & Vital
Records,” accessed 7 October 2026.

### Continued Guilford Township 1860 schedule review — 7 October

Archive images n117–n126 continue Guilford Township, Hendricks County, on
handwritten schedule pages 116–125. Image n127 is also headed Guilford
Township; its handwritten schedule number is blank or unreadable. Visible
household portions on n117–n127 show no clearly legible
Lasley/Lashley/Leslie/Lesley candidate. These are partial visual checks:
substantial rows remain below the viewer crop and have not been transcribed.
No identity or relationship was added. Resume at image n128 and continue
checking township and page captions.

### Guilford Township census review continued — 7 October

Archive images n128–n134 remain in Guilford Township, Hendricks County. The
handwritten schedule number on n128 is unclear; n129–n134 show schedule pages
128–133. Visible household portions contain no clearly legible
Lasley/Lashley/Leslie/Lesley candidate. Rows below the viewer crop remain
unchecked, so the negative observation is limited to what is visible. Resume
at image n135 and continue to check headings and page numbers. No person or
relationship was added.

### Guilford Township Lasley surname lead — 7 October

Archive images n135–n144 show Guilford Township, Hendricks County, with the
Plainfield post office and handwritten schedule pages 134–143. On image n138,
handwritten page 137, two consecutive household heads appear to read Ambrose
Lasley (26, farmer, born Indiana) and Alfred Lasley (30, farmer, born North
Carolina). The apparent Ambrose household also includes Amanda and Elizabeth;
the lower rows and exact household details still need transcription. The Allen
County Public Library Genealogy Center's 1853 special census index (white males
over 21) returned no fuzzy matches for Lasley or Lesley. This is a derivative
index negative, not proof of absence. Hendricks County's searchable marriage
license index covers books 13–59, whose listed dates begin in 1904, so it does
not resolve the earlier Lasley marriages. A volunteer transcription of county
marriages lists Lydia H. Lasley–James W. Bray (5 April 1838) and Rebecca
Lasley–Oliver Craven (1 January 1838); these entries are not yet verified from
the original license book and do not establish a tie to the 1860 men.

Added separate provisional research finding
`leslie-lasley-guilford-census-candidates`. The candidates remain unconnected
to the Leslie line and no tree identities or relationships were added. Next:
read the complete page 137 household rows at higher resolution, verify the 1838
marriages in Hendricks County Marriage License Book 2 (1837–1845), then compare
the Lasley households across 1850/1870 census and county tax, land, probate, and
voting records. Resume the broader reel at image n145.

### Warrick County Leslie/Lasley records surfaced — 7 October

An 1830 Warrick County transcription lists Benjamin, John, Theophilas, and
Israel Lasley in Skelton Township (pp. 540 and 544). Israel's entry has one
male aged 20–30 and no available female tally. The transcription contains age
counts, not names of additional household members. A separate 1998 query
asserts an Israel Lasley/Leslie born about 1810, with a son William; this is an
unsourced lead. A transcription of Warrick Marriage Book B lists Israel Leslie
and Agnus Staton on 25 May 1829. The 1850 Owen Township transcription then
lists Israel Leslie (40, Kentucky) and Agnes (38, Kentucky) with children
including William, David, and Shelton; the 1860 Owen Township transcription
lists Isreal Leslie (52, Kentucky), Agnis Staton (50), David (15), and Shelton
(14). In the 1870 Lane Township transcription, Agnes Laslie (58, Kentucky)
appears with Louisa (14) and L.A. (10); Israel does not appear in that
household. This sequence supports a probable working identity within Warrick
records, but none of these transcriptions has yet been checked against original
schedules or the marriage book, and they do not connect Israel's family to
Tom's tree.

The same Warrick marriage transcription lists James Lesley–Catharine Hodges
(20 March 1832, p. 16), Benjamin Lesley–Emily Gentry (23 July 1822, p. 6),
Theopholis K. Lesley–Betsy Reed (21 September 1825, p. 8), and John Hodges–
Cinthia Leslie (26 February 1836, p. 22). A 1850 census transcription lists a
separate John Leslie household (age 64, Kentucky) with Shelton aged 23, as
well as the Israel/Agnes Leslie household. An unsourced compiled profile claims
James S. Leslie married Catherine Hodges and had a child Tillman. The overlap
is a research route only: no original marriage or census image was examined,
no households were linked, and the compiled parentage is not established. The
site findings `leslie-warrick-1830-lasley-households`,
`leslie-israel-warrick-1830-1860-household-hypothesis`, and
`leslie-warrick-james-catharine-1832-marriage-lead` record these leads without
adding people or family edges. Next inspect original M19/M432 schedules and
Warrick Marriage Book B pp. 12 and 16; search probate/guardianship and later
census records for Israel, James, Catherine, and their reported children.

### Original 1830 Warrick schedule checked for Israel Lasley — 7 October

FamilySearch image 505 of 769 (NARA M19, roll 28), handwritten schedule page
273, was inspected for the indexed Israel Lasley entry. The original schedule
shows the household head written as Israel Lasley and one tally in the male age
columns; no female tally is recorded on that row. The assignment to age 20–30
comes from the derivative transcription and still needs a closer full-resolution
check. The schedule names no other household members and says nothing about
kinship. This upgrades the existence and spelling of the 1830 head from
derivative-only to original-image confirmed, without proving continuity to the
later Israel Leslie households or any connection to Tom's line. Updated
`leslie-israel-warrick-1830-1860-household-hypothesis` and
`leslie-warrick-1830-lasley-households`; no family identities or relationships
were added. Next inspect the original 1850 schedule and marriage-book image for
Israel/Agnes, then the other 1830 Lasley households and the Warrick James/
Catharine lead.

### Warrick 1840 surname cluster — 7 October

The volunteer transcription of the 1840 Warrick County census was searched
across its seven township lists for Leslie, Lesley, Lasley, Laslie, and
Lashley. No hits appeared outside Skelton. Skelton entries name Benjamin
Leslie and John Leslie on schedule page 75, Israel Leslie on page 81, and James
Leslie on page 85. The Israel household has one male in the 30–40 age bin and
one female in the 20–30 bin, matching the broad age progression from the 1830
Israel Lasley head and the presumed Agnes marriage. The 1840 enumerator's
original schedule has not yet been inspected, and these age tallies do not name
or prove any relationships. This provides a plausible census-to-census
continuity hypothesis for the Israel record and identifies separate John,
Benjamin, and James research candidates. Updated
`leslie-israel-warrick-1830-1860-household-hypothesis`,
`leslie-warrick-1830-lasley-households`, and
`leslie-warrick-james-catharine-1832-marriage-lead`; no family edges added.
1820 Warrick transcription searches did not find Leslie, Lesley, Lasley, or
Lashley. Next inspect original M704 pages 75, 81, and 85, then trace each 1840
head separately in deeds, probate, 1850 census, and marriage records.

Follow-up to the 1840 route found that the 1850 Warrick census transcription
contains three separate Leslie households close together in Owen Township:
John (household 176, schedule p. 143), Benjamin (household 200, p. 146), and
Israel (household 208, p. 147). Benjamin, age 51 and born Kentucky, is shown
with Milla and six children aged 10–20; John, age 64 and born Kentucky, has
children including Shelton, 23; Israel, age 40 and born Kentucky, appears with
Agnes and children including William, David, and Shelton. These details expand
the Warrick surname cluster and suggest family grouping as a hypothesis, but
the census only gives household membership, and this material remains a
volunteer transcription until checked against NARA M432 images. The 1832 James
Lesley–Catharine Hodges marriage and 1840 James Leslie head remain separate
leads; no relationship is proved. Updated
`leslie-warrick-1830-lasley-households` and
`leslie-warrick-james-catharine-1832-marriage-lead`. The
published 1870 surname index has additional separate Laslie households and an
1880 transcription route; next inspect those by original census image and
follow descendants, then pursue the Warrick probate/land and marriage records.

### 1860 Warrick Leslie households and Amos Benjamin lead — 7 October

The 1860 Owen Township volunteer transcription also lists a separate
Benjamin Leslie household (numbers 232–235) with wife Milly/Emily Gentry and
two children at home, followed by a James Leslie household with wife Netty
Hodges and four young children. The compiler's notes say Benjamin and James
were sons of Amos Benjamin Leslie and add marriage/relationship details that
do not appear in the census itself. The same transcription separately lists
John Leslie (74, Kentucky) and the younger Marion Boon Leslie (28), and Nancy
I. Leslie in a Dimmitt household. An 1850 transcription has John (64,
Kentucky), Benjamin (51, Kentucky), and Israel (40, Kentucky) in separate
Owen Township households. The 1850 and 1860 ages/names may identify a local
Leslie cluster, but this remains a working hypothesis: schedules and
transcriptions do not establish family ties, and no connection to Tom's line
is proved. The 1860 James (reported age 37, married in 1850) cannot be the 1832
James Lesley groom if those dates are accurate. Added separate provisional
finding `leslie-warrick-1860-benjamin-james-households`; no tree links added.
The public Warrick Will Book 1 index lists no Leslie testator; its compiler
warns wills may be in unindexed courthouse “shucks,” so this negative result
does not exclude estate evidence. Next compare the original 1850 and 1860
household images, verify the original marriage records, and continue into
Warrick land/probate and the separately indexed 1870 Laslie families.

### Warrick 1870 household clusters — 7 October

The full volunteer township transcriptions now resolve the 1870 surname-index
references. In Lane Township, Thomas Laslie (40, Indiana-born) appears with
Sally A. and five children on p. 545; David Laslie (25), wife Rachel (20), and
son Andrew J. (1) appear on p. 547; Peter Laslie (17) and Lucrecia (17) on
p. 548; and Agnes Laslie (58, Kentucky-born), Louisa (14), and L.A. (10) on
p. 549. Agnes and the younger Louisa are compatible with the 1860
Israel/Agnes household, and David/Rachel is supported by a separate 1868
marriage-index entry, but schedules and indexes do not prove those identities
or relationships.

In Owen Township, Benjamin Leslie (69) and Milley (67) appear on p. 597 with
Mary (27); Catherine Hodge (35) and two daughters are also enumerated in that
household. The next household is James Leslie (46, birthplace transcribed NC)
with Nettie (44) and children whose ages broadly progress from the 1860
James/Netty household, but the age and birthplace differences need original
image review. On p. 600 are Shelton Leslie (28) and family, and William Leslie
(35) with Nancy J. and sons John T. (13), James M. (11), and Henry T. (two
months). Peter Leslie (26) and Elizabeth A. (22) with James F. (1) appear on
p. 602. Page 603 contains three particularly relevant neighboring entries:
Tilman Leslie (23) with a woman transcribed as “MO” (21) and Louisa J. (3);
Nelson Leslie (21) and Eliza A. (17); and Catherine Leslie (56) with Rachel
(19), Hannah (17), Mary (15), and Louis (13). The age pattern makes a possible
Catherine/Tillman/Nelson group and the 1832 James Lesley–Catharine Hodges
marriage a priority hypothesis to test; the census itself does not state
relationships, and “MO” is not securely identified as Missouri Chambers.

In Skelton Township, Samuel Laslie (45) and Arlanda R. (37) appear with their
reported children on pp. 635–636. Martin (11) and Lucretia (10) Laslie are
enumerated within an Allen household on pp. 646–647. These are separate
candidate families. Added finding `leslie-warrick-1870-separated-households`
with no people or relationships. Next inspect original M593 schedule images
for the cited pages, obtain original marriage entries for Tilman/Missouri and
David/Rachel, and compare 1850/1860/1880 records before identifying households
or connecting this Warrick cluster to Tom’s tree.

A separate 1870 Owen household offers a followable descendant route. William
Leslie, 35, and Nancy J., 33, appear with sons John T. (13), James M. (11), and
Henry T. (two months) on page 600. A local family-history page transcribes a
1900 Owen household for William Leslie, born December 1836, age 63, and wife
“Nana,” born February 1840, age 60; the age and birthplace are compatible
with the 1870 couple, but “Nana” is not yet identified as Nancy. A volunteer
Warrick marriage index lists John T. Leslie and Licetta Hall in 1882, and a
Shiloh Cemetery transcription identifies John Tillman Leslie (1857–1939) with
Licetta Hall (1859–1935). This makes 1870 John T. a plausible candidate for
John Tillman Leslie and points to the 1880 Owen original schedule (T9 reel 321,
ED 066, p. 353B, IA image 0108) as an immediate test. None of these original
records has been inspected; no identity or kinship edge was added. Finding
`leslie-warrick-william-john-tillman-continuity` tracks the source trail.
Next read the 1870, 1880, and 1900 original schedules and the 1882 marriage
record, then follow all children through later census, vital, probate, and land
records. Keep this family separate from the Tilman/Catherine cluster until a
record explicitly links them.

### Mary J. Hovey: possible 1850 Shelby County household — 7 October

FamilySearch's 1850 Indiana census index has Mary Jane Hovey, age 2, in
Marion Township, Shelby County, household 31, with Daniel Hovey (27), Ruth
Hovey (24), and John K. Hovey (8 months), page 347, image 347/391. The duplicate
index records MHVW-G31 and MHVW-9VR refer to the same page/household, not two
independent sources. This offers possible Hovey family-of-origin candidates
for the woman indexed as Mary J. Hovey in Vigo and named on the original 1871
Howard Leslie marriage return; it does not establish that the women are the
same or that Daniel and Ruth are parents.

The later trail is contradictory. The 1860 index places a Mary J. Hovey, age
12, in Lucina Hovey's Vigo County household; the 1870 index reports age 27;
the inspected 1880 Howard/Mary Lesley schedule reports Mary age 31 and born in
New York. The 1850 index says Indiana. Full original schedules must be
compared before these are treated as one person. An interactive FamilySearch
search for Mary Hovey, birth 1848–1849, found no results when constrained to
that precise year range; this narrow search is not evidence of absence. See
`leslie-mary-hovey-1850-family-candidate`. Next trace Daniel, Ruth, and John K.
Hovey in 1860/later records; obtain legible 1850 and Vigo originals; and compare
the 1871 return, 1880 schedule, and reported 1881 death/burial records. No
identity merge or relationship edge is made.

### 1910 Camden trade-paper lead — 7 October

The digitized issue transcription for *The Billboard*, vol. 22, no. 28 (9 July
1910), p. 37, includes a “For Sale or Trade” notice signed “TILLMAN LESLIE,
Jr., Box 131, Camden, Indiana.” It offers an Edison X. machine, a 20-foot-front
ticket office and booth, a piano, and a back drop or fly. Added provisional
finding `tillman-leslie-jr-billboard-camden-1910` for younger Tillman Howard
Leslie because the name, town, and era align. The smaller ad has not yet been
independently transcribed from a close, full-resolution view. “Jr.” does not
establish the advertiser’s identity, parentage, or relationship to older
Tillman H. Leslie; do not add an occupation, identity merge, or family edge.
Inspect the scan at readable magnification and seek independent corroboration
in Camden directories, census, and local papers.

The official Indiana Bicentennial page describes a free Carroll County
newspaper-image archive covering county papers from the 1830s onward, but its
listed `carrollcountyin.newspaperarchive.com` host did not resolve in the
current browser. Treat availability as unverified and the historic page as a
discovery lead, not an accessible archive. Continue through other official
library and archive holdings without bypassing a login or paywall.
