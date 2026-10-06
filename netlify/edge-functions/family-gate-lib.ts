// Pure, testable core of the family-history password gate.
//
// The family section (/family/*, /images/family/*) holds PII for living and
// recently-living relatives, so it must not be readable without the shared
// password. This module keeps every decision testable under vitest (Web
// Crypto only — no Deno or Netlify imports), while family-gate.ts wires it
// to the Netlify Edge Functions runtime.

export const COOKIE_NAME = "__Host-tf-family";
const GATE_CONTEXT = "tomfoolery-family-gate-v1";
const AUTH_PATH = "/family/__auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** HMAC of a fixed context string under the password — the cookie value. */
export async function expectedCookieValue(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(GATE_CONTEXT));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison (both sides are hashed first). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function passwordMatches(
  attempt: string,
  password: string,
): Promise<boolean> {
  if (!attempt || !password) return false;
  const [a, b] = await Promise.all([sha256Hex(attempt), sha256Hex(password)]);
  return timingSafeEqual(a, b);
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name && !(name in out)) out[name] = decodeURIComponent(value);
  }
  return out;
}

/**
 * Where to send the visitor after a successful login. Only same-origin
 * paths are allowed, blocking open-redirect abuse of the `next` field.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "/family";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/family";
  if (trimmed.includes("\\")) return "/family";
  return trimmed.split("#")[0] || "/family";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The password prompt. Carries no family names, photos, or PII of its own. */
export function gatePage(nextPath: string, failed = false): Response {
  const safeNext = escapeHtml(safeNextPath(nextPath));
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Family — private · Tomfoolery</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #FAF6EE; color: #2E2A23;
    font-family: ui-sans-serif, system-ui, sans-serif; padding: 1.5rem;
  }
  .gate {
    width: min(26rem, 100%); background: #FFFDF8;
    border: 1px solid #E4DCCB; border-radius: 14px;
    padding: 2rem; box-shadow: 0 12px 40px rgba(80, 66, 40, .10);
  }
  .kicker {
    font-family: ui-monospace, monospace; font-size: .72rem;
    letter-spacing: .22em; text-transform: uppercase; color: #8A7A5C;
  }
  h1 { font-size: 1.4rem; margin: .6rem 0 .4rem; }
  p { font-size: .92rem; line-height: 1.55; color: #5C5344; margin: 0 0 1.2rem; }
  label { display: block; font-size: .8rem; margin-bottom: .35rem; color: #5C5344; }
  input {
    width: 100%; box-sizing: border-box; font-size: 1rem;
    padding: .65rem .8rem; border: 1px solid #D8CFB8; border-radius: 8px;
    background: #fff; color: inherit;
  }
  button {
    margin-top: .9rem; width: 100%; font-size: 1rem; font-weight: 600;
    padding: .7rem; border: 0; border-radius: 8px; cursor: pointer;
    background: #2E2A23; color: #FAF6EE;
  }
  .error {
    font-size: .85rem; color: #9A3B26; background: #F9E9E2;
    border: 1px solid #E8C4B2; border-radius: 8px;
    padding: .55rem .75rem; margin-bottom: 1rem;
  }
</style>
</head>
<body>
  <main class="gate">
    <span class="kicker">Tomfoolery</span>
    <h1>The family notebook is private</h1>
    <p>This section holds our family history. Enter the family password to read it.</p>
    ${failed ? '<p class="error" role="alert">That password didn\u2019t match. Try again.</p>' : ""}
    <form method="post" action="${AUTH_PATH}">
      <input type="hidden" name="next" value="${safeNext}" />
      <label for="password">Family password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required autofocus />
      <button type="submit">Unlock</button>
    </form>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function notConfiguredPage(): Response {
  return new Response(
    "<!doctype html><html><head><meta name=robots content=\"noindex,nofollow\">" +
      "<title>Family — unavailable</title></head><body style=\"font-family:sans-serif;padding:3rem\">" +
      "<h1>The family section isn\u2019t available right now.</h1>" +
      "<p>The password hasn\u2019t been configured on the server yet. Nothing here is readable until it is.</p>" +
      "</body></html>",
    { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export function buildAuthCookie(cookieValue: string): string {
  return (
    `${COOKIE_NAME}=${cookieValue}; Path=/; Max-Age=${COOKIE_MAX_AGE}; ` +
    `Secure; HttpOnly; SameSite=Lax`
  );
}

/**
 * Decide the response for a request under the gated paths.
 * `next` continues to the static file when the visitor is authenticated.
 */
export async function gateResponse(
  request: Request,
  password: string,
  next: () => Promise<Response>,
): Promise<Response> {
  // Fail closed: without a configured password nobody reads anything.
  if (!password) return notConfiguredPage();

  const url = new URL(request.url);

  if (url.pathname === AUTH_PATH && request.method === "POST") {
    const form = await request.formData();
    const attempt = String(form.get("password") ?? "");
    const nextPath = safeNextPath(String(form.get("next") ?? "/family"));
    if (await passwordMatches(attempt, password)) {
      const response = new Response(null, {
        status: 303,
        headers: { Location: nextPath },
      });
      response.headers.set(
        "Set-Cookie",
        buildAuthCookie(await expectedCookieValue(password)),
      );
      return response;
    }
    return gatePage(nextPath, true);
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  const presented = cookies[COOKIE_NAME];
  if (
    presented &&
    timingSafeEqual(presented, await expectedCookieValue(password))
  ) {
    return next();
  }
  return gatePage(url.pathname);
}
