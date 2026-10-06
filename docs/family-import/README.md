# Muncie & Crook import — 5 October 2026

The user authorized importing all details from Kevin's shared MacFamilyTree,
including living relatives, into tommuncie.com. Adam Thomas Muncie is the user;
he goes by Tom and is the default focus. Kevin is his brother, not the user.
The password is not stored in this repository or any output artifact.

## Capture and completeness

Source: https://www.macfamilytree.com/kmuncie/Muncie-Crook/index.html

Read-only browser navigation captured the rendered person, family, event,
source, media and place pages. The compressed JSON is the original DOM-derived
capture, with fields, displayed text, observed links and source UUIDs retained.
The browser's image-asset tool downloaded 95 observed family photographs;
`media-assets.json` maps their original URLs to local files. No hidden app state
or guessed data endpoint was used. The shared tree was not modified.

Inventory checked against the complete indexes and statistics page:

- 611 unique people; 186 unique families; 238 source records.
- 2,026 event references on person pages; 160 events on family pages.
- 1,866 distinct event UUIDs. The family events also appear on person pages;
  these counts are references, not 2,186 distinct events.
- 74 linked media records (69 images and 5 record links); 686 linked place records.
- Every event summary's type, date and description matched its detailed page.
- Every displayed place title matched its event reference.
- All normalized internal links resolve to captured records.

Rebuild with `node scripts/import-shared-family.mjs`. The archived capture is
read-only input; regeneration is deterministic and preserves UUID identity.
The browser capture uses rendered text, so it is not a GEDCOM export and does
not claim to recover undisplayed relationship attributes.

## Identity and relationships

The previously researched Palmiero, Emiecia, Victor, Nora and Fred keep IDs
p001, p002, p004, p005 and p007 respectively. New people use stable source UUIDs
with an mft prefix. Similar names are not automatically merged. Mary and Albert
from the research leads are not in the imported index and remain research
profiles. Concezio and the older Italian candidates remain separately researched.

The shared tree explicitly records:

Adam Thomas Muncie → Patrick Eugene Leslie Stockwell Muncie → Mark Allen Stockwell.
Kevin has the same parents as Adam. Patrick's parents are Mark and Gloria Jean
Brown. Gloria also has a later family with Fred Richard Muncie, married in 1964;
Patrick is not a child in that family. No Fred → Patrick parent edge is added.
The user's biological-grandfather explanation agrees with this recorded path.
The displayed tree does not label a relationship biological/adoptive when its
rendered source does not specify that status. Mark's two separate parent groups
(Dorothy Dean Macy and Eugene Howard Leslie) are preserved without inventing a
marriage or adding a Stockwell-surnamed parent.

## Evidence and discrepancies

Imported fields and relationships are supported statements of a family-provided
compiled genealogy. That confidence means the shared tree explicitly records the
claim; it does not mean each underlying original document was inspected. Source
citations, source-page information, event details, notes, media and alternate names
remain navigable. The independent original-record research retains its own source
types and confidence on the same five stable IDs.

Examples deliberately retained for review:

- Palmiero's imported death location says Franklin, Warren County, Ohio; the
  inspected certificate records Camp Chase, Franklin County. Both are visible.
- Victor's shared tree birth date is 22 January 1898; the earlier supplied lead
  says 1899. The shared entry and research profile remain distinct assertions.
- Patrick has marriage events dated 10 April 1982 and 10 April 1983. Neither is
  discarded. Gloria likewise has multiple recorded birth dates/events.
- The tree has similarly named separate records, including two Lee Roy Sterling
  entries and two Melody records. UUIDs preserve them pending family review.
- Palmiero has a partner group with an unnamed partner and children Victor,
  Nora and Fred, plus a separate Emiecia partner group. The import does not
  silently assign the unnamed group's children to Emiecia. The independent
  census evidence identifying Fred as Emma's son is retained in his research profile.

## Site integration

The main explorer starts with Adam (Tom), supports selected family branches,
ancestor depth, siblings, children, pan, pinch/zoom, whole-tree fit, keyboard
navigation, search and full screen. Each of the 611 people has a full static
profile. All family, event, source, media and place records have static pages.
A text directory and ordinary links work without JavaScript. The existing
Italian research map remains expandable, with older provisional branches hidden
by default. The site's existing layout and unrelated pages remain in place.
