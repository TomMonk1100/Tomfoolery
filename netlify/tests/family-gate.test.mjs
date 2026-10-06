import { describe, expect, it } from "vitest";
import {
  COOKIE_NAME,
  buildAuthCookie,
  expectedCookieValue,
  gatePage,
  gateResponse,
  parseCookies,
  passwordMatches,
  safeNextPath,
  timingSafeEqual,
} from "../edge-functions/family-gate-lib.ts";

const PASSWORD = "correct horse batter staple";

describe("timingSafeEqual", () => {
  it("accepts identical strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });
  it("rejects differing strings", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
  });
  it("rejects different lengths", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("accepts the right password", async () => {
    expect(await passwordMatches(PASSWORD, PASSWORD)).toBe(true);
  });
  it("rejects the wrong password", async () => {
    expect(await passwordMatches("nope", PASSWORD)).toBe(false);
  });
  it("rejects empty attempts", async () => {
    expect(await passwordMatches("", PASSWORD)).toBe(false);
  });
});

describe("parseCookies", () => {
  it("parses a cookie header", () => {
    const out = parseCookies("a=1; b=two; __Host-tf-family=xyz");
    expect(out.a).toBe("1");
    expect(out.b).toBe("two");
    expect(out[COOKIE_NAME]).toBe("xyz");
  });
  it("handles a missing header", () => {
    expect(parseCookies(null)).toEqual({});
  });
});

describe("safeNextPath", () => {
  it("allows family paths", () => {
    expect(safeNextPath("/family/person/abc/")).toBe("/family/person/abc/");
  });
  it("blocks protocol-relative URLs", () => {
    expect(safeNextPath("//evil.com/x")).toBe("/family");
  });
  it("blocks absolute URLs", () => {
    expect(safeNextPath("https://evil.com/")).toBe("/family");
  });
  it("blocks backslashes and empties", () => {
    expect(safeNextPath("/\\evil")).toBe("/family");
    expect(safeNextPath("")).toBe("/family");
    expect(safeNextPath(null)).toBe("/family");
  });
  it("strips fragments", () => {
    expect(safeNextPath("/family#top")).toBe("/family");
  });
});

describe("expectedCookieValue", () => {
  it("is deterministic hex", async () => {
    const v1 = await expectedCookieValue(PASSWORD);
    const v2 = await expectedCookieValue(PASSWORD);
    expect(v1).toBe(v2);
    expect(v1).toMatch(/^[0-9a-f]{64}$/);
  });
  it("differs per password", async () => {
    expect(await expectedCookieValue("one")).not.toBe(
      await expectedCookieValue("two"),
    );
  });
});

describe("buildAuthCookie", () => {
  it("sets hardened attributes", () => {
    const c = buildAuthCookie("abc123");
    expect(c).toContain(`${COOKIE_NAME}=abc123`);
    expect(c).toContain("Path=/");
    expect(c).toContain("Secure");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
  });
});

describe("gatePage", () => {
  it("is never indexed and carries no PII", async () => {
    const res = gatePage("/family");
    expect(res.status).toBe(401);
    const html = await res.text();
    expect(html).toContain("noindex");
    expect(html).not.toContain("Muncie");
  });
});

describe("gateResponse", () => {
  const next = async () =>
    new Response("secret content", { status: 200 });

  it("fails closed when no password is configured", async () => {
    const res = await gateResponse(
      new Request("https://tommuncie.com/family"),
      "",
      next,
    );
    expect(res.status).toBe(503);
  });

  it("shows the gate to anonymous visitors", async () => {
    const res = await gateResponse(
      new Request("https://tommuncie.com/family/person/x/"),
      PASSWORD,
      next,
    );
    expect(res.status).toBe(401);
  });

  it("serves content with a valid cookie", async () => {
    const value = await expectedCookieValue(PASSWORD);
    const res = await gateResponse(
      new Request("https://tommuncie.com/family", {
        headers: { cookie: `${COOKIE_NAME}=${value}` },
      }),
      PASSWORD,
      next,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("secret content");
  });

  it("rejects a forged cookie", async () => {
    const res = await gateResponse(
      new Request("https://tommuncie.com/family", {
        headers: { cookie: `${COOKIE_NAME}=forged` },
      }),
      PASSWORD,
      next,
    );
    expect(res.status).toBe(401);
  });

  function postForm(fields) {
    const body = new URLSearchParams(fields);
    return new Request("https://tommuncie.com/family/__auth", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  }

  it("sets the auth cookie on a correct password", async () => {
    const res = await gateResponse(
      postForm({ password: PASSWORD, next: "/family/person/x/" }),
      PASSWORD,
      next,
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/family/person/x/");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(COOKIE_NAME);
  });

  it("rejects a wrong password without setting a cookie", async () => {
    const res = await gateResponse(
      postForm({ password: "wrong", next: "/family" }),
      PASSWORD,
      next,
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.text()).toContain("didn\u2019t match");
  });
});
