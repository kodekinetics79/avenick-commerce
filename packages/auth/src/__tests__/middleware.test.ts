import { afterEach, describe, it, expect, vi } from "vitest";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("lets only the signed ERP ingress prefix reach admin route authentication", async () => {
    const mw = createMiddleware("admin", anon);
    expect((await mw(req("/api/integrations/inbound/ERP")))!.status).toBe(200);
    expect((await mw(req("/api/integrations")))!.status).toBe(401);
    expect((await mw(req("/api/integrations/inboundness")))!.status).toBe(401);
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

  it("verifies a backend-issued cookie when local JWT decoding is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            user: { id: "u1", email: "buyer@example.test", role: UserRole.COMPANY_BUYER },
            expires: new Date(Date.now() + 60_000).toISOString(),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const request = new NextRequest("http://localhost/b2b", {
      headers: { cookie: "avenick.customer.session-token=render-signed-token" },
    });
    const mw = createMiddleware("customer", anon);

    const res = await mw(request);

    expect(res!.status).toBe(200);
  });
});

describe("public catalog API contract", () => {
  it("serves /api/brands to anonymous visitors", async () => {
    // /brands is a public page that renders from this endpoint. If the API is
    // not public, an anonymous visitor gets a 401 behind a public route.
    const mw = createMiddleware("customer", anon);
    const res = await mw(req("/api/brands"));

    expect(res!.status).toBe(200);
    expect(res!.headers.get("location")).toBeNull();
  });

  it("keeps the other public catalog endpoints anonymous", async () => {
    const mw = createMiddleware("customer", anon);
    for (const path of ["/api/products", "/api/categories"]) {
      const res = await mw(req(path));
      expect(res!.status, `${path} should be public`).toBe(200);
    }
  });

  it("does not make the whole customer API public", async () => {
    const mw = createMiddleware("customer", anon);
    const res = await mw(req("/api/orders"));

    expect(res!.status).toBe(401);
  });

  it("does not expose brands on the seller or admin portals", async () => {
    for (const portal of ["seller", "admin"] as const) {
      const mw = createMiddleware(portal, anon);
      const res = await mw(req("/api/brands"));
      expect(res!.status, `${portal} must not treat /api/brands as public`).toBe(401);
    }
  });
});

describe("return path preservation through login", () => {
  it("preserves the query string in callbackUrl", async () => {
    // A bare pathname drops filters, variant selection and RFQ context, so the
    // visitor returns to a different page than the one they were sent from.
    const mw = createMiddleware("customer", anon);
    const res = await mw(req("/b2b/rfq/new?productId=p-1&supplier=s-9"));

    const location = new URL(res!.headers.get("location")!);
    expect(location.searchParams.get("callbackUrl")).toBe("/b2b/rfq/new?productId=p-1&supplier=s-9");
  });

  it("still sets a callbackUrl when there is no query string", async () => {
    const mw = createMiddleware("customer", anon);
    const res = await mw(req("/account/orders"));

    const location = new URL(res!.headers.get("location")!);
    expect(location.searchParams.get("callbackUrl")).toBe("/account/orders");
  });
});

describe("static-asset skip does not become an auth bypass", () => {
  it("still authenticates an API path that merely contains a dot", async () => {
    // `pathname.includes(".")` skipped middleware for any dotted path, so a
    // protected API route could be reached unauthenticated just by naming it
    // with a dot.
    const mw = createMiddleware("customer", anon);
    for (const path of [
      "/api/orders/abc.def",
      "/api/b2b/purchase-orders/x.y",
      "/api/orders/report.json",
      "/api/orders/archive.png",
    ]) {
      const res = await mw(req(path));
      expect(res!.status, `${path} must still require authentication`).toBe(401);
    }
  });

  it("still authenticates a page path that merely contains a dot", async () => {
    const mw = createMiddleware("admin", anon);
    const res = await mw(req("/users/john.doe"));

    expect(res!.status).toBe(307);
    expect(res!.headers.get("location")).toContain("/login");
  });

  it("lets genuine static assets through", async () => {
    const mw = createMiddleware("customer", anon);
    for (const path of ["/logo.svg", "/fonts/inter.woff2", "/site.webmanifest", "/robots.txt"]) {
      const res = await mw(req(path));
      expect(res!.status, `${path} should pass through`).toBe(200);
      expect(res!.headers.get("location")).toBeNull();
    }
  });

  it("does not treat a dotted directory segment as an asset", async () => {
    // "/assets.v2/orders" ends in a path segment, not an extension.
    const mw = createMiddleware("admin", anon);
    const res = await mw(req("/assets.v2/orders"));

    expect(res!.status).toBe(307);
  });
});
