import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs config module, no types
import { imageOriginsFrom } from "@avenick/config/image-hosts";

const repoRoot = join(fileURLToPath(new URL("../../../", import.meta.url)), "../../");
const PORTALS = ["customer", "seller", "admin"] as const;

/**
 * `remotePatterns` and the Content-Security-Policy answer the same question —
 * may the browser load this image? — and they disagreed.
 *
 * All three portals allow `www.mennekes.org` in remotePatterns. Only the
 * customer portal passed it to the CSP. So the admin and seller portals blocked
 * the very images their own configuration promised to serve: no product photo
 * on the admin products list, and none on the approval screens where a person
 * is meant to look at a product before approving it. Found on production, in a
 * console nobody had open; the page around the empty box was perfectly fine.
 *
 * The object-storage hosts had the same hole waiting. They are computed from
 * env for remotePatterns and were in no portal's CSP at all, so the first
 * uploaded product photo would have been invisible in production.
 */
describe("image origins", () => {
  it.each(PORTALS)("%s derives its CSP img-src from its own remotePatterns", (portal) => {
    const source = readFileSync(join(repoRoot, "apps", portal, "next.config.mjs"), "utf8");

    expect(source, `${portal} no longer declares one remoteImagePatterns list`).toMatch(
      /const remoteImagePatterns = \[/,
    );
    expect(source, `${portal} passes remotePatterns from somewhere other than the shared list`).toMatch(
      /remotePatterns: remoteImagePatterns/,
    );
    // The point of the change: no hand-written second list.
    expect(source, `${portal} hand-writes its CSP image origins again — they will drift`).toMatch(
      /imgSrc: imageOriginsFrom\(remoteImagePatterns/,
    );
  });

  it("turns patterns into origins", () => {
    expect(
      imageOriginsFrom([
        { protocol: "https", hostname: "www.mennekes.org", pathname: "/fileadmin/**" },
        { protocol: "https", hostname: "*.avenick.com" },
        { protocol: "https", hostname: "media.example.com", port: "9000" },
      ]),
    ).toEqual(["https://www.mennekes.org", "https://*.avenick.com", "https://media.example.com:9000"]);
  });

  it("keeps http origins out of a production policy, and allows localhost in development", () => {
    const patterns = [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "cdn.example.com" },
    ];
    expect(imageOriginsFrom(patterns)).toEqual(["https://cdn.example.com"]);
    expect(imageOriginsFrom(patterns, { isDev: true })).toEqual([
      "http://localhost:*",
      "https://cdn.example.com",
    ]);
  });

  it("defaults a missing protocol to https, skips junk, and never repeats an origin", () => {
    expect(
      imageOriginsFrom([
        { hostname: "cdn.example.com" },
        { protocol: "https", hostname: "cdn.example.com" },
        { protocol: "ftp", hostname: "old.example.com" },
        { hostname: "  " },
        null,
        undefined,
      ]),
    ).toEqual(["https://cdn.example.com"]);
  });

  it("survives an empty or missing list", () => {
    expect(imageOriginsFrom([])).toEqual([]);
    expect(imageOriginsFrom(undefined)).toEqual([]);
  });

  it("keeps the policy free of duplicates when a portal repeats a base origin", async () => {
    // @ts-expect-error — plain .mjs config module, no types
    const { securityHeadersRoute } = await import("@avenick/config/security-headers");
    const route = securityHeadersRoute({ imgSrc: ["https://placehold.co", "https://www.mennekes.org"] });
    const csp = route.headers.find((h: { key: string }) => h.key === "Content-Security-Policy").value as string;
    const imgSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("img-src"))!;

    expect(imgSrc).toContain("https://www.mennekes.org");
    expect(imgSrc.match(/https:\/\/placehold\.co/g)).toHaveLength(1);
  });
});
