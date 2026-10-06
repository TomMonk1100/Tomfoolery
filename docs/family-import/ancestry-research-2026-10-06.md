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
