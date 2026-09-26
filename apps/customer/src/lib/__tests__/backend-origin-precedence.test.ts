import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ headers: new Map<string, string>(), cookies: [] as Array<{ name: string; value: string }> }));

vi.mock("next/headers", () => ({
  headers: () => ({ get: (name: string) => store.headers.get(name) ?? null }),
  cookies: () => ({ getAll: () => store.cookies }),
}));

import { fetchBackendJson, getBackendBaseUrl } from "../backend";

const ENV = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store.headers = new Map();
  store.cookies = [];
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: ["ok"] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  // NODE_ENV is read-only in the type system; the trust check only relaxes
  // for localhost in development, and these hosts are not localhost.
  vi.stubEnv("NODE_ENV", "production");
  delete process.env.NEXT_PUBLIC_BACKEND_URL;
  delete process.env.RENDER_EXTERNAL_URL;
  delete process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL;
  delete process.env.CUSTOMER_URL;
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.NEXTAUTH_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  process.env = { ...ENV };
});

const arriveAs = (host: string) => {
  store.headers.set("x-forwarded-host", host);
  store.headers.set("x-forwarded-proto", "https");
};

describe("which origin a server-side read calls", () => {
  /**
   * The defect: `backendUrl(path, incomingBaseUrl())` evaluates its argument
   * before the function that would have ignored it. A request arriving with a
   * Host nobody listed threw — even when the origin to call was configured and
   * known — and the caller's catch turned that into an empty category list. It
   * is waiting for the first custom domain: add one, forget the trusted list,
   * and every server-side read on it silently renders nothing.
   */
  it("uses the configured origin even when the request arrives on an unlisted host", async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://avenick-commerce.onrender.com";
    arriveAs("www.avenick.com");

    await expect(fetchBackendJson("/api/categories")).resolves.toEqual(["ok"]);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://avenick-commerce.onrender.com/api/categories");
  });

  it("falls back to the exact deployment origin when no canonical origin is configured", async () => {
    process.env.VERCEL_URL = "avenick-commerce.onrender.com";
    arriveAs("avenick-commerce.onrender.com");

    await expect(fetchBackendJson("/api/categories")).resolves.toEqual(["ok"]);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://avenick-commerce.onrender.com/api/categories");
  });

  /** The security property this file must not weaken. */
  it("still refuses an untrusted incoming origin when there is nothing configured", async () => {
    arriveAs("attacker.example.com");

    await expect(fetchBackendJson("/api/categories")).rejects.toThrow(/not trusted/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never calls a host the request merely claimed", async () => {
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://avenick-commerce.onrender.com";
    arriveAs("attacker.example.com");

    await fetchBackendJson("/api/categories");
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain("attacker.example.com");
  });

  it("prefers NEXT_PUBLIC_BACKEND_URL over RENDER_EXTERNAL_URL", () => {
    process.env.RENDER_EXTERNAL_URL = "https://service.onrender.com";
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://api.avenick.com";
    expect(getBackendBaseUrl()).toBe("https://api.avenick.com");
  });
  it("reads the catalog on the configured canonical host when the public WWW alias is not listed", async () => {
    process.env.NEXTAUTH_URL = "https://avenick.com";
    arriveAs("www.avenick.com");
    store.cookies = [{ name: "session", value: "fixture-session" }];
    await expect(fetchBackendJson("/api/products?page=1")).resolves.toEqual(["ok"]);
    expect(fetchMock).toHaveBeenCalledWith("https://avenick.com/api/products?page=1", expect.objectContaining({
      headers: expect.objectContaining({ cookie: "session=fixture-session" }),
    }));
  });

  it("never sends cookies to a forged host when only the canonical customer origin is configured", async () => {
    process.env.NEXTAUTH_URL = "https://avenick.com";
    arriveAs("attacker.example.com");
    await fetchBackendJson("/api/products");
    expect(fetchMock.mock.calls[0]![0]).toBe("https://avenick.com/api/products");
  });

  it("prefers the explicit customer portal over the authentication origin", async () => {
    process.env.NEXTAUTH_URL = "https://avenick.com";
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL = "https://customer.example.com/";
    arriveAs("www.avenick.com");
    await fetchBackendJson("/api/products");
    expect(fetchMock.mock.calls[0]![0]).toBe("https://customer.example.com/api/products");
  });

  it.each(["https://user:pass@avenick.com", "https://avenick.com/unexpected", "javascript:alert(1)"])(
    "fails closed for an invalid canonical configuration: %s", async (origin) => {
      process.env.NEXTAUTH_URL = origin;
      arriveAs("www.avenick.com");
      await expect(fetchBackendJson("/api/products")).rejects.toThrow(/invalid/);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["//attacker.example.com/api/products", "\\\\attacker.example.com/api/products"])(
    "rejects an origin-changing API path: %s", async (path) => {
      process.env.NEXTAUTH_URL = "https://avenick.com";
      arriveAs("www.avenick.com");
      await expect(fetchBackendJson(path)).rejects.toThrow(/trusted application origin/);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

});
