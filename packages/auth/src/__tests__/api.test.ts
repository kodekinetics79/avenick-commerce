import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { z } from "zod";
import { guarded, jsonOk, jsonErr, ApiError, parsePagination, paginationMeta } from "../api";
import { UserRole } from "@avenick/database";

const durableUser = vi.hoisted(() => ({ role: "ADMIN", status: "ACTIVE", deletedAt: null as Date | null }));
vi.mock("@avenick/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@avenick/database")>();
  return { ...actual, db: { user: { findUnique: vi.fn(async () => ({ ...durableUser })) } } };
});

function makeSession(role: UserRole, id = "user-1"): Session {
  durableUser.role = role;
  durableUser.status = "ACTIVE";
  durableUser.deletedAt = null;
  return {
    user: { id, email: "t@example.test", role } as Session["user"],
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
}

const req = (url = "http://localhost/api/test") => new NextRequest(url);

describe("guarded()", () => {
  it("returns 401 when there is no session", async () => {
    const handler = guarded({ auth: async () => null }, async () => jsonOk({}));
    const res = await handler(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Authentication required");
  });

  it("returns 403 when the role is not allowed", async () => {
    const handler = guarded(
      { auth: async () => makeSession(UserRole.CONSUMER), roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      async () => jsonOk({}),
    );
    const res = await handler(req());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Insufficient permissions");
  });

  it("rejects a suspended durable user even when the JWT still has an allowed role", async () => {
    const session = makeSession(UserRole.ADMIN);
    durableUser.status = "SUSPENDED";
    const handler = guarded({ auth: async () => session, roles: [UserRole.ADMIN] }, async () => jsonOk({}));
    expect((await handler(req())).status).toBe(403);
  });

  it("invokes the handler for an allowed role and sets x-request-id", async () => {
    const handler = guarded(
      { auth: async () => makeSession(UserRole.ADMIN), roles: [UserRole.ADMIN] },
      async ({ userId, role }) => jsonOk({ userId, role }),
    );
    const res = await handler(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { userId: "user-1", role: "ADMIN" } });
  });

  it("propagates an incoming x-request-id", async () => {
    const incoming = new NextRequest("http://localhost/api/test", {
      headers: { "x-request-id": "trace-me-123" },
    });
    const handler = guarded({ auth: async () => makeSession(UserRole.ADMIN) }, async () =>
      jsonOk(null),
    );
    const res = await handler(incoming);
    expect(res.headers.get("x-request-id")).toBe("trace-me-123");
  });

  it("maps ApiError to its status without leaking a stack", async () => {
    const handler = guarded({ auth: async () => makeSession(UserRole.ADMIN) }, async () => {
      throw new ApiError("Order already fulfilled", 409);
    });
    const res = await handler(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Order already fulfilled");
  });

  it("maps ZodError to a 400 validation message", async () => {
    const handler = guarded({ auth: async () => makeSession(UserRole.ADMIN) }, async () => {
      z.object({ qty: z.number().int().positive() }).parse({ qty: -2 });
      return jsonOk(null);
    });
    const res = await handler(req());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Validation failed/);
    expect(body.error).toMatch(/qty/);
  });

  it("masks unexpected errors as a generic 500 with a requestId", async () => {
    const handler = guarded({ auth: async () => makeSession(UserRole.ADMIN) }, async () => {
      throw new Error("secret internal detail: db password xyz");
    });
    const res = await handler(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toMatch(/secret/);
    expect(body.requestId).toBeTruthy();
  });

  it("awaits promised route params (Next 15 style) and accepts plain params (Next 14 style)", async () => {
    const handler = guarded({ auth: async () => makeSession(UserRole.ADMIN) }, async ({ params }) =>
      jsonOk(params),
    );
    const promised = await handler(req(), { params: Promise.resolve({ id: "abc" }) });
    expect((await promised.json()).data).toEqual({ id: "abc" });
    const plain = await handler(req(), { params: { id: "def" } });
    expect((await plain.json()).data).toEqual({ id: "def" });
  });
});

describe("response helpers", () => {
  it("jsonOk wraps data and optional meta", async () => {
    const res = jsonOk([1, 2], { meta: { page: 1, limit: 2, total: 10, totalPages: 5 } });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([1, 2]);
    expect(body.meta.totalPages).toBe(5);
  });

  it("jsonErr sets status and error", async () => {
    const res = jsonErr("Nope", 418);
    expect(res.status).toBe(418);
    expect((await res.json()).error).toBe("Nope");
  });

  it("returns NextResponse instances", () => {
    expect(jsonOk(null)).toBeInstanceOf(NextResponse);
  });
});

describe("parsePagination", () => {
  it("applies defaults", () => {
    const p = parsePagination(new URLSearchParams());
    expect(p).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("clamps limit to the maximum and page to >= 1", () => {
    const p = parsePagination(new URLSearchParams("page=-5&limit=100000"));
    expect(p.page).toBe(1);
    expect(p.limit).toBe(100);
  });

  it("ignores non-numeric input", () => {
    const p = parsePagination(new URLSearchParams("page=abc&limit=xyz"));
    expect(p).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("computes skip", () => {
    const p = parsePagination(new URLSearchParams("page=3&limit=10"));
    expect(p.skip).toBe(20);
  });
});

describe("paginationMeta", () => {
  it("computes totalPages with a floor of 1", () => {
    expect(paginationMeta({ page: 1, limit: 20, skip: 0 }, 0).totalPages).toBe(1);
    expect(paginationMeta({ page: 1, limit: 20, skip: 0 }, 41).totalPages).toBe(3);
  });
});
