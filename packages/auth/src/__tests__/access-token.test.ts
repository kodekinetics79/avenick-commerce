import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppSecretMissingError, KEY_PURPOSE, deriveKey } from "../app-secret";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  bearerTokenFrom,
  mintAccessToken,
  sessionFromAccessToken,
  verifyAccessToken,
} from "../access-token";
import { SESSION_ISSUED_AT_CLAIM, sessionIssuedAtSeconds } from "../session-revocation";

const SECRET = "test-auth-secret-not-a-real-one";
const NOW = Date.UTC(2026, 8, 8, 12, 0, 0);
const AUTH_AT = Math.floor(Date.UTC(2026, 8, 8, 11, 30, 0) / 1000);

const INPUT = {
  userId: "usr_1",
  role: "CONSUMER" as const,
  language: "EN",
  deviceId: "dev_1",
  authAtSeconds: AUTH_AT,
};

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
  delete process.env.NEXTAUTH_SECRET;
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

describe("minting and verifying", () => {
  it("round-trips the claims a guarded request needs", () => {
    const { token, expiresIn } = mintAccessToken(INPUT, NOW);
    expect(expiresIn).toBe(ACCESS_TOKEN_TTL_SECONDS);

    const verified = verifyAccessToken(token, NOW);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.claims.sub).toBe("usr_1");
    expect(verified.claims.role).toBe("CONSUMER");
    expect(verified.claims.did).toBe("dev_1");
    // The one claim the token is authoritative about.
    expect(verified.claims.authAt).toBe(AUTH_AT);
  });

  it("mints a distinct jti per token so a log can name one without printing it", () => {
    const a = mintAccessToken(INPUT, NOW);
    const b = mintAccessToken(INPUT, NOW);
    expect(a.jti).not.toBe(b.jti);
    expect(a.token).not.toBe(b.token);
  });

  it("refuses to sign without a secret rather than keying an HMAC on nothing", () => {
    delete process.env.AUTH_SECRET;
    expect(() => mintAccessToken(INPUT, NOW)).toThrow(AppSecretMissingError);
    expect(verifyAccessToken("a.b.c", NOW)).toEqual({ ok: false, reason: "no-secret" });
  });

  it("uses a key DERIVED per purpose, not AUTH_SECRET itself", () => {
    // A token signed with the raw secret must not verify: that separation is
    // what stops a value minted for one purpose being replayed as another.
    const { token } = mintAccessToken(INPUT, NOW);
    const [header, payload] = token.split(".");
    const rawSigned = `${header}.${payload}.${createHmac("sha256", SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url")}`;
    expect(verifyAccessToken(rawSigned, NOW)).toEqual({ ok: false, reason: "signature" });

    const derived = deriveKey(KEY_PURPOSE.accessToken)!;
    expect(derived.toString("hex")).not.toBe(Buffer.from(SECRET, "utf8").toString("hex"));
  });
});

describe("what a forged or stale token gets", () => {
  it("rejects a tampered payload — the role cannot be edited in transit", () => {
    const { token } = mintAccessToken(INPUT, NOW);
    const [header, payload, signature] = token.split(".") as [string, string, string];
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    claims.role = "SUPER_ADMIN";
    const forged = `${header}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;
    expect(verifyAccessToken(forged, NOW)).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects alg:none, and any algorithm this module does not sign with", () => {
    const { token } = mintAccessToken(INPUT, NOW);
    const [, payload] = token.split(".") as [string, string];
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    expect(verifyAccessToken(`${noneHeader}.${payload}.`, NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects a token whose signature is a different length", () => {
    // timingSafeEqual throws on a length mismatch; a forgery must not 500.
    const { token } = mintAccessToken(INPUT, NOW);
    const [header, payload] = token.split(".") as [string, string];
    expect(verifyAccessToken(`${header}.${payload}.AA`, NOW)).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it.each(["", "not-a-token", "a.b", "a.b.c.d"])("rejects the malformed input %o", (value) => {
    expect(verifyAccessToken(value, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("expires exactly at the TTL", () => {
    const { token } = mintAccessToken(INPUT, NOW);
    expect(verifyAccessToken(token, NOW + (ACCESS_TOKEN_TTL_SECONDS - 1) * 1000).ok).toBe(true);
    expect(verifyAccessToken(token, NOW + ACCESS_TOKEN_TTL_SECONDS * 1000)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("tolerates a minute of clock skew but not an hour", () => {
    const { token } = mintAccessToken(INPUT, NOW);
    expect(verifyAccessToken(token, NOW - 30_000).ok).toBe(true);
    expect(verifyAccessToken(token, NOW - 3_600_000)).toEqual({ ok: false, reason: "not-yet-valid" });
  });
});

describe("bearerTokenFrom", () => {
  const h = (value: string) => new Headers({ authorization: value });

  it("accepts the scheme in any case, as RFC 6750 requires", () => {
    expect(bearerTokenFrom(h("Bearer abc.def.ghi"))).toBe("abc.def.ghi");
    expect(bearerTokenFrom(h("bearer abc.def.ghi"))).toBe("abc.def.ghi");
  });

  it.each([
    ["no header at all", null],
    ["a different scheme", "Basic abc"],
    ["a bare token", "abc.def.ghi"],
    ["two credentials", "Bearer abc.def.ghi, Basic zzz"],
    ["an empty credential", "Bearer "],
  ])("returns null for %s", (_label, value) => {
    expect(bearerTokenFrom(value === null ? new Headers() : h(value))).toBeNull();
  });
});

describe("sessionFromAccessToken", () => {
  it("produces the same shape the cookie path does, carrying the issued-at", () => {
    const { token } = mintAccessToken(INPUT, NOW);
    const verified = verifyAccessToken(token, NOW);
    if (!verified.ok) throw new Error("expected a valid token");
    const session = sessionFromAccessToken(verified.claims);

    expect(session.user?.id).toBe("usr_1");
    // The revocation comparison must be able to date a bearer session exactly
    // as it dates a cookie one.
    expect(sessionIssuedAtSeconds(session)).toBe(AUTH_AT);
    expect((session as unknown as Record<string, unknown>)[SESSION_ISSUED_AT_CLAIM]).toBe(AUTH_AT);
    // The email is not carried: it is a mutable column, and the device already
    // has it from sign-in.
    expect(session.user?.email).toBeNull();
  });
});
