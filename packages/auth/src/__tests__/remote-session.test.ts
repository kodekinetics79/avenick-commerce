import { afterEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@avenick/database";
import { encode } from "next-auth/jwt";
import { resolveRemotePortalSession } from "../remote-session";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BACKEND_URL;
  delete process.env.NEXTAUTH_URL;
  delete process.env.AUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;
});

describe("split-runtime session verification", () => {
  it("decodes the signed portal cookie locally when Auth.js request context is unavailable", async () => {
    process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-authjs";
    const cookieName = "avenick.seller.session-token";
    const signed = await encode({
      secret: process.env.AUTH_SECRET,
      salt: cookieName,
      token: {
        sub: "seller-user",
        email: "seller@example.test",
        role: UserRole.SELLER_OWNER,
        language: "en",
      },
      maxAge: 60,
    });
    const fetcher = vi.fn();

    const session = await resolveRemotePortalSession(
      "seller",
      `${cookieName}=${signed}`,
      fetcher as typeof fetch,
    );

    expect(session?.user).toMatchObject({
      id: "seller-user",
      email: "seller@example.test",
      role: UserRole.SELLER_OWNER,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forwards only the matching portal cookie to the configured backend", async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://backend.example.test/";
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          user: { id: "u1", email: "buyer@example.test", role: UserRole.COMPANY_BUYER },
          expires: new Date(Date.now() + 60_000).toISOString(),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const session = await resolveRemotePortalSession(
      "customer",
      "avenick.customer.session-token=signed-token; preference=en",
      fetcher as typeof fetch,
    );

    expect(session?.user?.id).toBe("u1");
    expect(fetcher).toHaveBeenCalledWith(
      "https://backend.example.test/api/auth/session",
      expect.objectContaining({
        cache: "no-store",
        headers: { cookie: "avenick.customer.session-token=signed-token; preference=en" },
      }),
    );
  });

  it("fails closed for another portal, malformed data, and backend failure", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 }));
    expect(
      await resolveRemotePortalSession(
        "seller",
        "avenick.customer.session-token=signed-token",
        fetcher as typeof fetch,
      ),
    ).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();

    expect(
      await resolveRemotePortalSession(
        "customer",
        "avenick.customer.session-token=signed-token",
        fetcher as typeof fetch,
      ),
    ).toBeNull();

    const failed = vi.fn(async () => new Response(null, { status: 503 }));
    expect(
      await resolveRemotePortalSession(
        "customer",
        "avenick.customer.session-token=signed-token",
        failed as typeof fetch,
      ),
    ).toBeNull();
  });

  it("uses the deployment-owned auth origin instead of a request-controlled host", async () => {
    process.env.NEXTAUTH_URL = "https://auth-safe.example.test/";
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://legacy-backend.example.test";
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          user: { id: "u2", email: "admin@example.test", role: UserRole.ADMIN },
          expires: new Date(Date.now() + 60_000).toISOString(),
        }),
        { status: 200 },
      ),
    );

    await resolveRemotePortalSession(
      "admin",
      "avenick.admin.session-token=signed-token",
      fetcher as typeof fetch,
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://auth-safe.example.test/api/auth/session",
      expect.any(Object),
    );
  });
});
