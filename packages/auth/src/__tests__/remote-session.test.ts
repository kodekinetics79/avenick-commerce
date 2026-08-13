import { afterEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@avenick/database";
import { resolveRemotePortalSession } from "../remote-session";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BACKEND_URL;
});

describe("split-runtime session verification", () => {
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
});
