import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE SECURITY FIX, on both credentials.
 *
 * Before `User.sessionsValidAfter` was read, a NextAuth session cookie survived
 * a password reset for the remainder of its thirty-day maxAge — the redeem
 * route said so in its own comment. These tests are the proof that it no longer
 * does, and that the bearer path added alongside it is subject to exactly the
 * same rule rather than being a second door around it.
 */

const durableUser = vi.hoisted(() => ({
  role: "CONSUMER" as string,
  status: "ACTIVE" as string,
  deletedAt: null as Date | null,
  sessionsValidAfter: null as Date | null,
}));

vi.mock("@avenick/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@avenick/database")>();
  return { ...actual, db: { user: { findUnique: vi.fn(async () => ({ ...durableUser })) } } };
});

const { guarded, jsonOk } = await import("../api");
const { mintAccessToken } = await import("../access-token");
const { SESSION_ISSUED_AT_CLAIM } = await import("../session-revocation");

const SECRET = "guarded-test-secret";
const SIGNED_IN_AT = Date.UTC(2026, 8, 1, 9, 0, 0);
const RESET_AT = new Date(Date.UTC(2026, 8, 2, 9, 0, 0));

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
  durableUser.role = "CONSUMER";
  durableUser.status = "ACTIVE";
  durableUser.deletedAt = null;
  durableUser.sessionsValidAfter = null;
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

/** A cookie session, as `config.ts` now stamps it. */
function cookieSession(issuedAtMs: number | null): Session {
  const session = {
    user: { id: "usr_1", email: "buyer@example.test", role: "CONSUMER" },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as unknown as Record<string, unknown>;
  if (issuedAtMs !== null) session[SESSION_ISSUED_AT_CLAIM] = Math.floor(issuedAtMs / 1000);
  return session as unknown as Session;
}

function bearerRequest(token: string) {
  return new NextRequest("http://localhost/api/test", {
    headers: { authorization: `Bearer ${token}` },
  });
}

const plainRequest = () => new NextRequest("http://localhost/api/test");
const okHandler = async () => jsonOk({ reached: true });

describe("the web path: a cookie session against sessionsValidAfter", () => {
  it("refuses a session issued BEFORE a password reset — the stolen cookie", async () => {
    durableUser.sessionsValidAfter = RESET_AT;
    const handler = guarded({ auth: async () => cookieSession(SIGNED_IN_AT) }, okHandler);
    const res = await handler(plainRequest());

    expect(res.status).toBe(401);
    // 401, not 403: the account is healthy, this credential is not, and the
    // client's correct move is to sign in again.
    expect((await res.json()).error).toMatch(/session has ended/i);
  });

  it("admits the session the owner created AFTER the reset", async () => {
    durableUser.sessionsValidAfter = RESET_AT;
    const handler = guarded(
      { auth: async () => cookieSession(RESET_AT.getTime() + 60_000) },
      okHandler,
    );
    expect((await handler(plainRequest())).status).toBe(200);
  });

  it("refuses a session it cannot date once a cutoff exists", async () => {
    // A cookie minted before the authAt claim shipped is exactly the cookie a
    // reset is trying to kill.
    durableUser.sessionsValidAfter = RESET_AT;
    const handler = guarded({ auth: async () => cookieSession(null) }, okHandler);
    expect((await handler(plainRequest())).status).toBe(401);
  });

  it("leaves every session alone while the cutoff is NULL", async () => {
    // The migration must not sign the userbase out on the day it lands.
    durableUser.sessionsValidAfter = null;
    const undated = guarded({ auth: async () => cookieSession(null) }, okHandler);
    expect((await undated(plainRequest())).status).toBe(200);
    const ancient = guarded({ auth: async () => cookieSession(0 + 1000) }, okHandler);
    expect((await ancient(plainRequest())).status).toBe(200);
  });
});

describe("the bearer path is opt-in, and never inferred", () => {
  const token = () =>
    mintAccessToken(
      {
        userId: "usr_1",
        role: "CONSUMER",
        language: "EN",
        deviceId: "dev_1",
        authAtSeconds: Math.floor(SIGNED_IN_AT / 1000),
      },
      Date.now(),
    ).token;

  it("refuses a valid bearer token on a route that did not opt in", async () => {
    // The whole point of the flag: an existing cookie-only route must not start
    // accepting a phone-held credential because a header showed up.
    const handler = guarded({ auth: async () => null }, okHandler);
    const res = await handler(bearerRequest(token()));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Authentication required");
  });

  it("accepts it once the route says allowBearer", async () => {
    const handler = guarded({ auth: async () => null, allowBearer: true }, okHandler);
    const res = await handler(bearerRequest(token()));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ reached: true });
  });

  it("tells the handler which credential arrived", async () => {
    const seen: string[] = [];
    const handler = guarded({ auth: async () => null, allowBearer: true }, async (ctx) => {
      seen.push(ctx.credential);
      return jsonOk(null);
    });
    await handler(bearerRequest(token()));
    const cookie = guarded({ auth: async () => cookieSession(SIGNED_IN_AT) }, async (ctx) => {
      seen.push(ctx.credential);
      return jsonOk(null);
    });
    await cookie(plainRequest());
    expect(seen).toEqual(["bearer", "cookie"]);
  });

  it("refuses a forged bearer token", async () => {
    const handler = guarded({ auth: async () => null, allowBearer: true }, okHandler);
    expect((await handler(bearerRequest("not.a.token"))).status).toBe(401);
  });

  it("prefers the cookie when both are presented", async () => {
    const handler = guarded(
      { auth: async () => cookieSession(SIGNED_IN_AT), allowBearer: true },
      async (ctx) => jsonOk({ credential: ctx.credential }),
    );
    const res = await handler(bearerRequest(token()));
    expect((await res.json()).data.credential).toBe("cookie");
  });
});

describe("both credentials meet the same live re-read", () => {
  const token = (authAtMs: number) =>
    mintAccessToken(
      {
        userId: "usr_1",
        role: "CONSUMER",
        language: "EN",
        deviceId: "dev_1",
        authAtSeconds: Math.floor(authAtMs / 1000),
      },
      Date.now(),
    ).token;

  it("refuses a bearer token issued before the account's cutoff", async () => {
    durableUser.sessionsValidAfter = RESET_AT;
    const handler = guarded({ auth: async () => null, allowBearer: true }, okHandler);
    const res = await handler(bearerRequest(token(SIGNED_IN_AT)));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/session has ended/i);
  });

  it("admits a bearer token minted after it", async () => {
    durableUser.sessionsValidAfter = RESET_AT;
    const handler = guarded({ auth: async () => null, allowBearer: true }, okHandler);
    expect((await handler(bearerRequest(token(RESET_AT.getTime() + 60_000)))).status).toBe(200);
  });

  it("refuses a suspended account on the bearer path, as it does on the cookie path", async () => {
    // The token's own claims say CONSUMER/ACTIVE. The database is the authority.
    durableUser.status = "SUSPENDED";
    const bearer = guarded({ auth: async () => null, allowBearer: true }, okHandler);
    expect((await bearer(bearerRequest(token(SIGNED_IN_AT)))).status).toBe(403);
    const cookie = guarded({ auth: async () => cookieSession(SIGNED_IN_AT) }, okHandler);
    expect((await cookie(plainRequest())).status).toBe(403);
  });

  it("enforces the role list against the LIVE role, not the token's claim", async () => {
    durableUser.role = "CONSUMER";
    const handler = guarded(
      { auth: async () => null, allowBearer: true, roles: ["ADMIN"] as never },
      okHandler,
    );
    // A token minted while the user was an admin does not survive the demotion.
    const adminToken = mintAccessToken(
      {
        userId: "usr_1",
        role: "ADMIN",
        language: "EN",
        deviceId: "dev_1",
        authAtSeconds: Math.floor(SIGNED_IN_AT / 1000),
      },
      Date.now(),
    ).token;
    expect((await handler(bearerRequest(adminToken))).status).toBe(403);
  });
});
