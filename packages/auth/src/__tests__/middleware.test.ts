import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { createMiddleware } from "../middleware";
import { UserRole } from "@avenick/database";

function makeSession(role: UserRole): Session {
  return {
    user: { id: "u1", email: "t@example.test", role } as Session["user"],
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
}

const anon = async () => null;
const as = (role: UserRole) => async () => makeSession(role);

const req = (path: string) => new NextRequest(`http://localhost${path}`);

describe("portal middleware — anonymous access", () => {
  it("redirects anonymous page requests to /login", async () => {
    const mw = createMiddleware("admin", anon);
    const res = await mw(req("/users"));
    expect(res!.status).toBe(307);
    expect(res!.headers.get("location")).toContain("/login");
  });

  it("returns 401 JSON (not a redirect) for anonymous API requests", async () => {
    const mw = createMiddleware("admin", anon);
    const res = await mw(req("/api/admin/users"));
    expect(res!.status).toBe(401);
    const body = await res!.json();
    expect(body).toEqual({ success: false, error: "Authentication required" });
  });

  it("lets health, readiness and status probes through unauthenticated", async () => {
    const mw = createMiddleware("seller", anon);
    for (const path of ["/api/health", "/api/ready", "/api/status"]) {
      const res = await mw(req(path));
      expect(res!.status).toBe(200);
      expect(res!.headers.get("location")).toBeNull();
    }
  });

  it("keeps the customer catalog APIs and payment webhook public", async () => {
    const mw = createMiddleware("customer", anon);
    for (const path of ["/api/products", "/api/products/some-slug", "/api/categories", "/api/payments/webhook"]) {
      const res = await mw(req(path));
      expect(res!.status, path).toBe(200);
    }
  });

  it("does not leak the customer /products public rule into the seller portal", async () => {
    const mw = createMiddleware("seller", anon);
    const res = await mw(req("/products/123"));
    expect(res!.status).toBe(307);
    expect(res!.headers.get("location")).toContain("/login");
  });
});

describe("portal middleware — cross-portal role isolation", () => {
  it("blocks a consumer from the admin portal API with 403 JSON", async () => {
    const mw = createMiddleware("admin", as(UserRole.CONSUMER));
    const res = await mw(req("/api/admin/users"));
    expect(res!.status).toBe(403);
    expect((await res!.json()).error).toBe("Insufficient permissions");
  });

  it("blocks a seller from admin pages with a redirect", async () => {
    const mw = createMiddleware("admin", as(UserRole.SELLER_OWNER));
    const res = await mw(req("/dashboard"));
    expect(res!.status).toBe(307);
    expect(res!.headers.get("location")).toContain("error=forbidden");
  });

  it("blocks an admin from the seller portal", async () => {
    const mw = createMiddleware("seller", as(UserRole.ADMIN));
    const res = await mw(req("/dashboard"));
    expect(res!.status).toBe(307);
  });

  it("admits the matching role", async () => {
    const mw = createMiddleware("admin", as(UserRole.SUPER_ADMIN));
    const res = await mw(req("/dashboard"));
    expect(res!.status).toBe(200);
    expect(res!.headers.get("location")).toBeNull();
  });

  it("admits company roles to the customer portal", async () => {
    const mw = createMiddleware("customer", as(UserRole.COMPANY_BUYER));
    const res = await mw(req("/b2b"));
    expect(res!.status).toBe(200);
  });
});
