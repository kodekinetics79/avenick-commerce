import { afterEach, describe, expect, it, vi } from "vitest";
import { signInWithCredentials } from "../client";

describe("relative credentials sign-in", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps CSRF and credential requests on the current deployment origin", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-test" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://production.example/" }), { status: 200 }));
    vi.stubGlobal("fetch", request);

    await expect(signInWithCredentials("buyer@example.test", "Password123!", "/orders"))
      .resolves.toEqual({ ok: true, error: undefined });

    expect(request).toHaveBeenNthCalledWith(1, "/api/auth/csrf", expect.any(Object));
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/api/auth/callback/credentials",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });

  it("surfaces an Auth.js credential error without redirecting across origins", async () => {
    vi.stubGlobal("fetch", vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-test" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://production.example/login?error=CredentialsSignin" }), { status: 200 })));

    await expect(signInWithCredentials("buyer@example.test", "wrong", "/orders"))
      .resolves.toEqual({ ok: false, error: "CredentialsSignin" });
  });
});
