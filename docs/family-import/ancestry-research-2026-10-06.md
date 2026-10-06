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
