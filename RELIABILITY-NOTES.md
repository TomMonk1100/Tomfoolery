# Leaderboard reliability notes

Updated September 4, 2026 with the `/api/scores` function changes.

## Checks added

- JSON bodies are read in chunks and capped at 2 KiB. Oversized bodies return
  `413`; malformed JSON and wrong-shaped score objects return `400`.
- `name` remains a 12-character sanitized label, `level` remains bounded to
  1–999, and the established `cadet`/`pilot`/`ace` values are retained.
- Stored arrays are treated as untrusted legacy data. Null roots, null rows,
  malformed rows, and the existing hidden `TEST PILOT` rows cannot break GET
  or POST. Valid legacy rows retain their public `{name, level, difficulty,
  ts}` shape and ranking.
- POST updates use a strong-consistency `getWithMetadata` read followed by a
  conditional `setJSON`: `onlyIfMatch` for an existing blob and `onlyIfNew`
  for the first write. A failed condition retries up to five times with a
  short backoff, so overlapping submissions are merged instead of silently
  overwriting one another. Persistent contention returns `503`.
- A warm function instance allows 12 POST attempts per client address per
  minute and returns `429` with `Retry-After` after that. This is a modest
  abuse control for a casual board, not a global quota or an anti-cheat
  system; separate serverless instances can have separate counters, and the
  client still supplies the score.

Focused regression coverage lives in `netlify/functions/scores.test.mjs` and
covers invalid payloads, bounded bodies, existing-score retention, corrupt
legacy data, and concurrent conditional-write conflicts. The package test
script includes the function tests so `npm run verify` runs them.

## API verification

The installed `@netlify/blobs` package is version 10.7.9. Its shipped type
definitions expose `getWithMetadata(..., { type: 'json', consistency })`,
`setJSON(..., { onlyIfMatch })`, `setJSON(..., { onlyIfNew })`, and the
`modified` result used by the function.

The implementation follows the current [Netlify Blobs conditional-write
documentation](https://docs.netlify.com/build/data-and-storage/netlify-blobs/),
which documents ETag reads and atomic `onlyIfMatch`/`onlyIfNew` writes. No live
leaderboard writes, deployment, or data migration were performed during this
review.

## Deliberate limits

The leaderboard remains a casual client-submitted board. A server-verifiable
run protocol, identity system, durable distributed rate limiter, and stronger
database semantics are outside this change and would require a separate
product and storage decision.
