import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * The deployment blueprint must not pin a live hostname.
 *
 * render.yaml set NEXTAUTH_URL to a Vercel host on all three Render web
 * services, so each Render-hosted portal was told its auth origin lived on
 * another provider's deployment. NextAuth builds callback and redirect URLs
 * from that value, and resolveRemotePortalSession reads it first when deciding
 * where to verify a session — so a local decode failure would have sent the
 * visitor's session cookie to a deployment the service does not own. The code
 * already fails closed when the origin is unset; the blueprint was supplying a
 * wrong one, which is worse than none.
 *
 * Origins belong in per-service dashboard values (`sync: false`), never in a
 * file that every environment shares.
 */
const ORIGIN_VARS = [
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_BACKEND_URL",
  "NEXT_PUBLIC_CUSTOMER_PORTAL_URL",
  "NEXT_PUBLIC_SELLER_PORTAL_URL",
  "NEXT_PUBLIC_ADMIN_PORTAL_URL",
];

describe("deployment blueprint", () => {
  const blueprint = readFileSync(resolve(repoRoot, "render.yaml"), "utf8");

  it("pins no live hostname outside a comment", () => {
    const code = blueprint
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    const hosts = [...code.matchAll(/https?:\/\/[A-Za-z0-9.-]+/g)].map((m) => m[0]);
    expect(hosts, `render.yaml pins ${hosts.join(", ")}`).toEqual([]);
  });

  it.each(ORIGIN_VARS)("%s is supplied per service, never as a shared literal", (key) => {
    // Match the key and whatever follows it on the next non-empty line.
    const pattern = new RegExp(`- key: ${key}\\s*\\n\\s*(value|sync|fromService):\\s*(\\S+)`, "g");
    const settings = [...blueprint.matchAll(pattern)];
    for (const [, kind, value] of settings) {
      expect(
        kind === "value" && /^["']?https?:/.test(value ?? ""),
        `${key} is set to the literal ${value}; use "sync: false" so each service supplies its own`,
      ).toBe(false);
    }
  });
});
