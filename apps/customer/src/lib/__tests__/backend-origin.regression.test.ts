import { describe, expect, it } from "vitest";
import { backendUrl, requestBaseUrl } from "../backend";

describe("server backend origin", () => {
  it("uses the incoming forwarded Vercel origin instead of a retired fixed backend", () => {
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

  it("fails closed when no request or configured origin exists", () => {
    expect(requestBaseUrl({})).toBe("");
    expect(backendUrl("/api/products", "")).toBe("/api/products");
  });

  it("keeps an explicitly configured backend authoritative", () => {
    const previous = process.env.NEXT_PUBLIC_BACKEND_URL;
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://configured.example/";
    try {
      expect(backendUrl("/api/products", "https://incoming.example")).toBe(
        "https://configured.example/api/products",
      );
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_BACKEND_URL;
      else process.env.NEXT_PUBLIC_BACKEND_URL = previous;
    }
  });
});
