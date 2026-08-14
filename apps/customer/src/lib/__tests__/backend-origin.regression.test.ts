import { afterEach, describe, expect, it, vi } from "vitest";
import { backendUrl, requestBaseUrl } from "../backend";

describe("server backend origin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts the exact authoritative Vercel deployment origin", () => {
    vi.stubEnv("VERCEL_URL", "avenick-candidate.vercel.app");
    const origin = requestBaseUrl({
      host: "internal.invalid",
      forwardedHost: "avenick-candidate.vercel.app",
      forwardedProto: "https",
    });
    expect(origin).toBe("https://avenick-candidate.vercel.app");
    expect(backendUrl("/api/b2b/purchase-orders", origin)).toBe(
      "https://avenick-candidate.vercel.app/api/b2b/purchase-orders",
    );
  });

  it("rejects an attacker-controlled forwarded host", () => {
    vi.stubEnv("VERCEL_URL", "avenick-candidate.vercel.app");
    expect(() => requestBaseUrl({
      host: "avenick-candidate.vercel.app",
      forwardedHost: "attacker.example",
      forwardedProto: "https",
    })).toThrow(/not trusted/);
  });

  it("rejects malformed host and protocol input", () => {
    vi.stubEnv("VERCEL_URL", "avenick-candidate.vercel.app");
    expect(() => requestBaseUrl({ forwardedHost: "https://attacker.example/path", forwardedProto: "https" })).toThrow(/malformed/);
    expect(() => requestBaseUrl({ forwardedHost: "avenick-candidate.vercel.app", forwardedProto: "javascript" })).toThrow(/malformed/);
  });

  it("fails closed when no request or configured origin exists", () => {
    expect(requestBaseUrl({})).toBe("");
    expect(backendUrl("/api/products", "")).toBe("/api/products");
  });

  it("keeps an explicitly configured backend authoritative", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://configured.example/");
    expect(backendUrl("/api/products", "https://attacker.example")).toBe(
      "https://configured.example/api/products",
    );
  });
});
