import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ERROR_CODE_VALUES, ErrorEnvelopeSchema, PageMetaSchema } from "@avenick/contracts/envelope";

/**
 * The v1 wrapper is the only thing standing between a generated Dart client
 * and the three incompatible response shapes the existing API answers with.
 * So what is tested here is not "does the handler run" — it is that NOTHING
 * gets out of it except the two envelopes the contract describes, whatever
 * happened inside.
 *
 * Every body asserted below is parsed through the CONTRACT's own schemas
 * rather than an inline shape written in this file. A test that restates the
 * envelope is a second source of truth for the envelope.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueUser: vi.fn(),
  checkRateLimit: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/database", () => ({ db: { user: { findUnique: mocks.findUniqueUser } } }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIpFrom: () => "203.0.113.7",
}));
vi.mock("@avenick/observability", () => {
  const log = {
    error: mocks.logError,
    info: mocks.logInfo,
    warn: mocks.logWarn,
    debug: vi.fn(),
    with: () => log,
  };
  return {
    log,
    instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }),
  };
});

import { ERROR_STATUS, V1Error, conflict, notFound } from "../errors";
import { route } from "../handler";
import { decodeCursor, encodeCursor, paginate } from "../pagination";

const PayloadSchema = z.object({ ok: z.literal(true), name: z.string() }).strict();

const handle = vi.fn();

const testRoute = route({
  route: "/api/v1/test",
  auth: "optional",
  body: z.object({ name: z.string().min(3) }).strict(),
  response: PayloadSchema,
  rateLimit: { rule: { name: "v1-test", limit: 5, windowMs: 60_000 } },
  handle,
});

const guardedRoute = route({
  route: "/api/v1/guarded",
  auth: "required",
  roles: ["CONSUMER"],
  response: z.object({ userId: z.string() }).strict(),
  handle: async (ctx) => ({ data: { userId: ctx.principal!.userId } }),
});

const pagedRoute = route({
  route: "/api/v1/paged",
  auth: "none",
  query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(2) }).strict(),
  response: z.array(z.object({ id: z.string() })),
  handle: async (ctx) => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const page = paginate(rows, ctx.query.limit, (row) => row.id);
    return { data: page.data, meta: page.meta };
  },
});

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://customer.test/api/v1/test", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function envelopeOf(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.checkRateLimit.mockResolvedValue({ ok: true, count: 1, limit: 5, resetAt: Date.now() + 60_000 });
  handle.mockImplementation(async (ctx: { body: { name: string } }) => ({
    data: { ok: true as const, name: ctx.body.name },
  }));
});

describe("the success envelope", () => {
  it("answers { data } and nothing else", async () => {
    const response = await testRoute(post({ name: "kettle" }));
    expect(response.status).toBe(200);
    const body = await envelopeOf(response);
    expect(Object.keys(body)).toEqual(["data"]);
    expect(body.data).toEqual({ ok: true, name: "kettle" });
  });

  it("carries the request id in the header, reusing an upstream one", async () => {
    const response = await testRoute(post({ name: "kettle" }, { "x-request-id": "req-from-the-edge" }));
    expect(response.headers.get("x-request-id")).toBe("req-from-the-edge");
  });

  it("replaces an upstream request id the contract could not carry", async () => {
    // 128 chars is the contract's ceiling. A longer or control-charactered id
    // would put a string in the error envelope that the Dart client refuses to
    // parse, turning every failure into an unparseable response.
    const response = await testRoute(post({ name: "no" }, { "x-request-id": "x".repeat(400) }));
    const body = await envelopeOf(response);
    const parsed = ErrorEnvelopeSchema.parse(body);
    expect(parsed.error.requestId).not.toBe("x".repeat(400));
    expect(parsed.error.requestId.length).toBeLessThanOrEqual(128);
  });

  it("attaches page metadata in the contract's { cursor, hasMore } shape", async () => {
    const response = await pagedRoute(
      new NextRequest("https://customer.test/api/v1/paged?limit=2", { method: "GET" }),
    );
    const body = (await response.json()) as { data: unknown[]; meta: unknown };
    expect(body.data).toHaveLength(2);
    const meta = PageMetaSchema.parse(body.meta);
    expect(meta.hasMore).toBe(true);
    // The cursor points at the last row RETURNED, never at the probe row.
    expect(decodeCursor(meta.cursor!)).toBe("b");
  });

  it("reports the last page with a null cursor", async () => {
    const response = await pagedRoute(
      new NextRequest("https://customer.test/api/v1/paged?limit=50", { method: "GET" }),
    );
    const body = (await response.json()) as { meta: unknown };
    expect(PageMetaSchema.parse(body.meta)).toEqual({ cursor: null, hasMore: false });
  });
});

describe("the error envelope", () => {
  it("has a status for every code the contract declares", () => {
    // A code with no status would be a failure this wrapper cannot serialise.
    for (const code of ERROR_CODE_VALUES) {
      expect(ERROR_STATUS[code], `no HTTP status mapped for "${code}"`).toBeGreaterThan(0);
    }
    expect(Object.keys(ERROR_STATUS).sort()).toEqual([...ERROR_CODE_VALUES].sort());
  });

  it("reports a schema failure as validation_failed with per-field paths", async () => {
    const response = await testRoute(post({ name: "no" }));
    expect(response.status).toBe(400);
    const parsed = ErrorEnvelopeSchema.parse(await envelopeOf(response));
    expect(parsed.error.code).toBe("validation_failed");
    // The path is the one the CLIENT sent, so the app can put the message next
    // to the input rather than in a banner.
    expect(parsed.error.fieldErrors?.name?.[0]).toMatch(/at least 3/i);
    expect(handle).not.toHaveBeenCalled();
  });

  it("names the body itself when the body is not JSON at all", async () => {
    const response = await testRoute(post("{not json"));
    expect(response.status).toBe(400);
    const parsed = ErrorEnvelopeSchema.parse(await envelopeOf(response));
    expect(parsed.error.code).toBe("validation_failed");
    expect(parsed.error.fieldErrors?.body).toBeDefined();
  });

  it("refuses an unknown key rather than ignoring it", async () => {
    // The request schemas are .strict(); a silently dropped field is a setting
    // the buyer believes they chose.
    const response = await testRoute(post({ name: "kettle", shippingAmount: 0 }));
    expect(response.status).toBe(400);
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers 401 for a guest where the route needs an account", async () => {
    const response = await guardedRoute(new NextRequest("https://customer.test/api/v1/guarded"));
    expect(response.status).toBe(401);
    expect(ErrorEnvelopeSchema.parse(await envelopeOf(response)).error.code).toBe("unauthenticated");
  });

  it("answers 403 for a session whose account was revoked, and never serves it as a guest", async () => {
    // The live re-read IS the revocation mechanism. Degrading a suspended
    // account to "guest" would quietly re-admit it everywhere a guest is
    // welcome, which is the opposite of revoking it.
    mocks.auth.mockResolvedValue({ user: { id: "usr_1" } });
    mocks.findUniqueUser.mockResolvedValue({ role: "CONSUMER", status: "SUSPENDED", deletedAt: null });
    const response = await testRoute(post({ name: "kettle" }));
    expect(response.status).toBe(403);
    expect(ErrorEnvelopeSchema.parse(await envelopeOf(response)).error.code).toBe("forbidden");
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers 403 for an active account whose role the route does not admit", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "usr_2" } });
    mocks.findUniqueUser.mockResolvedValue({
      role: "SELLER_OWNER",
      status: "ACTIVE",
      deletedAt: null,
      companyMember: null,
    });
    const response = await guardedRoute(new NextRequest("https://customer.test/api/v1/guarded"));
    expect(response.status).toBe(403);
  });

  it.each([
    { thrown: () => notFound("No such thing."), status: 404, code: "not_found" },
    { thrown: () => conflict("It moved on."), status: 409, code: "conflict" },
    { thrown: () => new V1Error("payment_required", "Pay first."), status: 402, code: "payment_required" },
    { thrown: () => new V1Error("upstream_unavailable", "The provider is down."), status: 503, code: "upstream_unavailable" },
  ])("maps a thrown $code onto $status", async ({ thrown, status, code }) => {
    handle.mockRejectedValue(thrown());
    const response = await testRoute(post({ name: "kettle" }));
    expect(response.status).toBe(status);
    expect(ErrorEnvelopeSchema.parse(await envelopeOf(response)).error.code).toBe(code);
  });

  it("answers 429 with a Retry-After the client can honour", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      ok: false,
      count: 6,
      limit: 5,
      resetAt: Date.now() + 30_000,
    });
    const response = await testRoute(post({ name: "kettle" }));
    expect(response.status).toBe(429);
    expect(ErrorEnvelopeSchema.parse(await envelopeOf(response)).error.code).toBe("rate_limited");
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(handle).not.toHaveBeenCalled();
  });

  it("never lets a Retry-After of zero invite an immediate retry", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: false, count: 6, limit: 5, resetAt: Date.now() });
    const response = await testRoute(post({ name: "kettle" }));
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
  });

  it("answers 500 for the unexpected, logs it, and leaks nothing of it", async () => {
    handle.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.4:5432 for user "avenick_prod"'),
    );
    const response = await testRoute(post({ name: "kettle" }));
    expect(response.status).toBe(500);
    const parsed = ErrorEnvelopeSchema.parse(await envelopeOf(response));
    expect(parsed.error.code).toBe("internal");
    const serialised = JSON.stringify(parsed);
    expect(serialised).not.toMatch(/ECONNREFUSED|10\.0\.0\.4|avenick_prod/);
    // The requestId is the only thing a client can usefully report, so it must
    // be there — and the fault must be in the log to be found by it.
    expect(parsed.error.requestId).toBeTruthy();
    expect(mocks.logError).toHaveBeenCalled();
  });

  it("does not log a 4xx as a fault", async () => {
    handle.mockRejectedValue(notFound("No such thing."));
    await testRoute(post({ name: "kettle" }));
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it("refuses to serve a payload its own contract does not describe", async () => {
    // This is the guard that makes response validation worth its cost: a route
    // that drifts from the published schema fails here instead of shipping a
    // body no generated client can parse.
    handle.mockResolvedValue({ data: { ok: true, name: "kettle", total: 42 } });
    const response = await testRoute(post({ name: "kettle" }));
    expect(response.status).toBe(500);
    expect(ErrorEnvelopeSchema.parse(await envelopeOf(response)).error.code).toBe("internal");
    expect(mocks.logError).toHaveBeenCalledWith(
      "v1 response violates its contract",
      expect.anything(),
      expect.objectContaining({ route: "/api/v1/test" }),
    );
  });
});

describe("cursor pagination helpers", () => {
  it("round-trips a key that a query string would otherwise mangle", () => {
    const key = "2026-09-05T00:00:00.000Z|id/with+chars=";
    expect(decodeCursor(encodeCursor(key))).toBe(key);
  });

  it("refuses a hand-edited cursor as a 400, never a 500", () => {
    expect(() => decodeCursor("not a cursor!!")).toThrow(V1Error);
    try {
      decodeCursor("not a cursor!!");
    } catch (error) {
      expect((error as V1Error).status).toBe(400);
      expect((error as V1Error).fieldErrors?.cursor).toBeDefined();
    }
  });

  it("never hands back the probe row it used to decide hasMore", () => {
    const page = paginate([{ id: "a" }, { id: "b" }], 1, (row) => row.id);
    expect(page.data).toEqual([{ id: "a" }]);
    expect(page.meta.hasMore).toBe(true);
    expect(decodeCursor(page.meta.cursor!)).toBe("a");
  });
});
