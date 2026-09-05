import { describe, expect, it } from "vitest";
import { SellerBackendUnreachableError, resolveSellerBackendUrl } from "../backend";

/**
 * `/quotes`, `/quotes/submit` and the submit-a-quote action all reach the seller
 * API through fetchSellerBackend. It runs on the server, where fetch has no
 * origin, so a bare path throws `Failed to parse URL` — which surfaced as a 500
 * with no message on every one of those pages in any deployment that sets
 * neither NEXT_PUBLIC_SELLER_BACKEND_URL nor RENDER_EXTERNAL_URL. That is local
 * development and any Vercel project without the variable, so the whole quoting
 * capability was unreachable.
 */
describe("seller backend origin", () => {
  it("returns an absolute URL from the request host when nothing is configured", () => {
    expect(
      resolveSellerBackendUrl("/api/seller/rfqs", { configuredBase: "", host: "localhost:13101" }),
    ).toBe("http://localhost:13101/api/seller/rfqs");
  });

  it("never returns a relative path, which is what server-side fetch cannot parse", () => {
    const url = resolveSellerBackendUrl("/api/seller/rfqs", { configuredBase: "", host: "sell.example.com" });
    expect(() => new URL(url)).not.toThrow();
    expect(url.startsWith("/")).toBe(false);
  });

  it("assumes https for a public host and http only for loopback", () => {
    expect(resolveSellerBackendUrl("/api/x", { host: "sell.example.com" })).toBe("https://sell.example.com/api/x");
    expect(resolveSellerBackendUrl("/api/x", { host: "127.0.0.1:13101" })).toBe("http://127.0.0.1:13101/api/x");
  });

  it("honours the edge's forwarded protocol over the host heuristic", () => {
    expect(
      resolveSellerBackendUrl("/api/x", { host: "sell.example.com", forwardedProto: "http" }),
    ).toBe("http://sell.example.com/api/x");
    // A comma-joined chain keeps only the first hop's scheme.
    expect(
      resolveSellerBackendUrl("/api/x", { host: "sell.example.com", forwardedProto: "https, http" }),
    ).toBe("https://sell.example.com/api/x");
  });

  it("prefers an explicitly configured backend over the request host", () => {
    expect(
      resolveSellerBackendUrl("/api/seller/rfqs", {
        configuredBase: "https://backend.example.com/",
        host: "sell.example.com",
      }),
    ).toBe("https://backend.example.com/api/seller/rfqs");
  });

  it("refuses rather than guessing a host when there is no origin at all", () => {
    expect(() => resolveSellerBackendUrl("/api/seller/rfqs", { configuredBase: "", host: null })).toThrow(
      SellerBackendUnreachableError,
    );
  });
});
