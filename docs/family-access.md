# Working on the private family tree

The live family section is password protected. Agents working in this checkout
can still edit its local source and sign in normally to verify published pages.
There is no separate agent password, public bypass, or change to the gate.

## Access on Tom's Mac

`npm run family:check` signs in using the private `.env.family.local` file,
then checks the tree, one person, one record, and one family image. Each must
return 401 without a cookie and 200 after login. Credentials and cookies are
never printed; the session cookie stays in memory for this command only.

`npm run family:fetch -- /family/` saves the authenticated HTML to
`.family-access/latest.html`. Pass a person or record path to inspect that page,
or `/images/family/...` to save an image as `latest.bin`. Snapshots are private,
ignored by Git, and must not be uploaded or committed. They are for inspection;
relative assets still refer to the live site and will require authentication.

For browser work, open `https://tommuncie.com/family/` and enter the password
from the local credential file into the normal password form. Never paste the
password into chat, documentation, a URL, or a public file. Use a trusted browser
session with permission to read the local file. A login helper session does not
sign the browser in; its cookie is intentionally not exported.

The credential file has one entry, `FAMILY_PAGE_PASSWORD`, in dotenv format.
It was provisioned locally from Tom's supplied handoff on 6 October 2026. The
file has owner-only permissions and is not part of the repository. On another
machine, obtain the current password from Tom and create that private file
with owner-only permissions, or supply `FAMILY_PAGE_PASSWORD` in the process
environment. Never put its value in a command line. After a password rotation,
update the local credential and sign in again. A new checkout cannot recover a
password from Git.

## Local editing and preview

- `src/data/shared-family-index.json`, `src/data/shared-family-records.json`,
  and `src/data/shared-family.ts` contain the imported tree and stable IDs.
  Preserve the import; add research through the overlays rather than rewriting
  generated JSON.
- `src/data/ancestry-research.ts` contains sourced findings, their limits, and
  follow-up questions; `src/data/ancestry-relationships.ts` marks disputed links.
- `src/pages/family.astro`, `src/pages/family/person/[id].astro`, and
  `src/pages/family/record/[kind]/[id].astro` render the protected live routes.
- `public/images/family/` contains family images.
- Start the local preview with `npx astro dev --background`. Manage it with
  `npx astro dev status`, `npx astro dev logs`, and `npx astro dev stop`.
  Astro's preview does not run Netlify's edge gate; keep it local and do not
  expose or share it. Use `family:check` to verify the production gate.

## Continuity from 5–6 October 2026

Pip and Tom built a tree of 611 people, 186 families, 238 sources, 74 media
records, and 686 places, with 95 imported images. It starts with Adam (Tom);
Kevin remains his brother's person record. Keep the corrected Stockwell
parentage and the distinction between imported claims and verified records.
The ancestry explorer has 82 terminal trails, 173 recorded ancestors, and 175
stable missing-parent positions. The biblical branch remains separate, with
no proven link to the modern family.

The 1727 William Nedels estate account is retained in the research overlay
from last night's work. It identifies administrators Adam Browne and his
wife Elizabeth and one unnamed child. It does not prove that the child was
Ann or the later Delaware William. See `docs/family-import/NEXT-SESSION.md`
for the earlier research handoff, and
`docs/family-import/ancestry-research-2026-10-06.md` for the latest continuation.
Check Git and authenticated live content before assuming a finding is published.

The map overlay in `src/data/family-map.ts` includes all 611 family people and
21 biblical people, plus ? cards for immediate unknown parent positions. It
does not alter the imported tree or establish a modern-to-biblical connection.

## Publication and gate verification

Follow `AGENT-HANDOFF.md`: run `npm run verify`, stage explicit source paths,
then publish through Git on `main`. Never deploy `dist/` directly. Public
site checks still expect HTTP 200; `/family/` now correctly returns 401 to
anonymous checks. After publishing family changes, use `npm run family:check`
and an authenticated fetch/browser to confirm the actual new content.

Netlify's `FAMILY_PAGE_PASSWORD` is the production secret. The supplied handoff
reports its "Contains secret values" toggle was off; that dashboard setting
has not been verified or changed by this local setup. Never commit the password
or create an endpoint that returns it. Do not read the ignored `HANDOFF.md`.
