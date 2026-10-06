# Ancestry expedition, 5 October 2026

Explicit user goal: research backward from Adam Thomas Muncie (Tom), exploring a possible route to Adam and Eve and showing missing generations. The goal is active; there is no established modern-to-biblical connection.

## Pedigree audit

The imported account contains 173 distinct ancestors of Tom, 82 terminal parent paths, and a longest path of 25 parent links ending at Henry Degotham (reported 1247). Counts measure the imported assertions, not independent proof. The long path goes through Patrick, Mark Allen Stockwell, Dorothy Dean Macy, Curtis Lee Macy, Samuel A Macy, Nancy Cranfill, Greenberry Cranfill, Jonathan Cranfill, Ann Needles, the Needles/Needels/Nettles entries, Mary Parker, and the Parker/Gotham entries.

`ancestry.ts` computes paths from IDs and actual parent assertions. Missing-parent positions get stable `gap-<child ID>-parent-<slot>` identifiers. They are immediate research positions, not identified people or statements of biological parentage. No guessed number of earlier generations is created. The biblical gap has a null generation count and no connecting relationship.

## Checked leads

- **Colonial bridge conflict:** Maryland State Archives, *Biographical Dictionary of the Maryland Legislature*, vol. 426, p. 609, Edward Needles biography: Captain John’s son William is given as about 1697–about 1726, with wife Elizabeth Tonnard (1722). The imported William is 1697–1748, Kent, Delaware, father of Ann (1744). These cannot be merged on name/birth year alone. The archive HTML OCR was read, but the numerical text requires checking against its scan; the linked scan failed to render. No parent claim was replaced. [Archive biography](https://msa.maryland.gov/megafile/msa/speccol/sc2900/sc2908/000001/000426/html/am426--609.html). The Rock Clift nomination also describes William’s estate assessed in 1729; this is a pointer to the original Orphans Court record, not that record inspected. [Nomination](https://apps.mht.maryland.gov/medusa/PDF/NR_PDFs/NR-633.pdf).

- **Beauchief Abbey Cartulary**, charter 50, p. 105 (PDF page 67), folio 33v: transcription names Ada de Gotham witnessing the Norton quitclaim on 7 April 1350. Editorial note points to a 17 September 1352 Norton grant, Jeayes no. 1776 and Addy pp. 7–8. The transcription was read; the manuscript image was not retrieved. Identity with imported Adam Degotham (1330–1400) remains provisional. [Scholarly edition](https://doi.org/10.1017/S0960116311000121).
- Same edition p. 62 (PDF page 24): editorial note describes a 3 May 1308 grant to Thomas, son of Roger of Gotham; cites Hall/Thomas, Jackson Collection catalogue (1914), no. 299. Underlying grant not inspected. Do not identify its grantee with the tree’s Thomas born 1305 without resolving dates.
- [Stirnet Parker01](https://www.stirnet.co.uk/genie/data/british/pp/parker01.php) compares incompatible Collins and Familiae Minorum Gentium accounts. Thomas le Parker is placed in Edward III’s reign; wife Elizabeth daughter of Adam/Thomas/Roger according to Collins, or Joan sister/coheir of John Gotham according to FMG. This does not align straightforwardly with imported Thomas Parker 1471 and Elizabeth 1450. The original visitations and modern bridge still need checking.
- Genesis 4:1,25; 5:1–32; 11:10–26 were read in the KJV. A separate 21-person textual branch represents Adam, Eve, Seth through Noah, and Shem through Abram. Source kind is biblical narrative and confidence is textual tradition. It has no imported-family IDs, inferred calendar dates, or connecting parent edges. [Genesis 4](https://biblehub.com/kjvs/genesis/4.htm), [Genesis 5](https://biblehub.com/kjvs/genesis/5.htm), [Genesis 11](https://www.biblegateway.com/passage/?search=Genesis+11%3A10-12%3A4&version=KJV).

## Next original records

1. Verify the recent Stockwell/Macy parent links using the cited Indiana vital records and original census households.
2. Verify each Cranfill → Needles/Needels → Nettles link before treating the London/medieval trail as established. Check the Talbot County Maryland probate and the proposed London parish marriages/baptisms.
3. Retrieve Jackson Collection charter 299, Jeayes no. 1776, and the Derbyshire visitation. Compare the distinct Thomases and Adams without merging names.
4. Continue the separate Italian evidence work. Tom’s biological descent from Palmiero is not established by the imported Stockwell line.

Research overlays live separately from generated import JSON so rerunning the import preserves the original account and does not erase these findings.
