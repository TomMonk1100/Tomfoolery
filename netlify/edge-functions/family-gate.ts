// Password gate for the family-history section (/family/*, /images/family/*).
//
// Netlify Edge Function (Deno runtime). The shared password lives in the
// FAMILY_PAGE_PASSWORD environment variable, set in the Netlify dashboard —
// it is never in the repo. All decision logic is in family-gate-lib.ts so it
// can be unit-tested with vitest.

// Minimal shape of the Netlify edge Context we use, declared locally so
// `npm run typecheck` stays green without Deno remote types.
interface EdgeContext {
  next: () => Promise<Response>;
}

// Netlify injects this global in the edge runtime.
declare const Netlify: {
  env: { get: (key: string) => string | undefined };
};

import { gateResponse } from "../edge-functions-lib/family-gate-lib.ts";

export default async function handler(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const password = Netlify.env.get("FAMILY_PAGE_PASSWORD") ?? "";
  return gateResponse(request, password, () => context.next());
}
