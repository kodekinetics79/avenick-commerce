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
  process.env.NEXTAUTH_URL = "https://avenick-commerce.onrender.com";
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

  it("falls back to the incoming origin when nothing is configured", async () => {
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
});
