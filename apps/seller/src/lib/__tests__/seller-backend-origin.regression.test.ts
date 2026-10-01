import { describe, expect, it } from "vitest";
import { SellerBackendUnreachableError, resolveSellerBackendUrl } from "../backend";

/**
 * `/quotes`, `/quotes/submit` and the submit-a-quote action all reach the seller
 * API through fetchSellerBackend. It runs on the server, where fetch has no
 * origin, so a bare path throws `Failed to parse URL` — which surfaced as a 500
 * with no message on every one of those pages in any deployment that sets
 * neither NEXT_PUBLIC_SELLER_BACKEND_URL nor a deployment-owned self origin.
 * The resolver must never substitute a request Host because this request carries
 * the seller's authentication cookies.
 */
describe("seller backend origin", () => {
  it("builds an absolute URL from the deployment-owned origin", () => {
    expect(
      resolveSellerBackendUrl("/api/seller/rfqs", {
        configuredBase: "https://backend.example.com/",
      }),
    ).toBe("https://backend.example.com/api/seller/rfqs");
  });

  it("supports the canonical localhost self-origin used outside production", () => {
    expect(resolveSellerBackendUrl("/api/x", { configuredBase: "http://localhost:13101" })).toBe(
      "http://localhost:13101/api/x",
    );
  });

  it("refuses rather than guessing a request host when there is no trusted origin", () => {
    expect(() => resolveSellerBackendUrl("/api/seller/rfqs", { configuredBase: "" })).toThrow(
      SellerBackendUnreachableError,
    );
  });
});
