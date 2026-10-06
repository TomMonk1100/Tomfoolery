## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Private family tree access

For family work, read `docs/family-access.md` and, if present, the local
`docs/family-import/NEXT-SESSION.md`. The local source remains editable even
though the live `/family` pages and `/images/family/*` require a password.
Run `npm run family:check` to verify live access, or
`npm run family:fetch -- /family/` to save a private page snapshot.
The helper reads the ignored `.env.family.local` on this Mac and uses the
normal login form. Never print or commit that file, the password, cookies,
or `.family-access/` snapshots. Never add an agent bypass to the public gate.
Do not open the unrelated ignored `HANDOFF.md`.

## Astro documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
