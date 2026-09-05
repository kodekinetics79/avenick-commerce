import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The storefront's anonymous selling endpoints must be on the public list.
 *
 * The view beacon shipped with everything green and measured nothing: the
 * route was public by design, middleware guards /api/*, and nothing had
 * exempted it, so every POST answered 401 and no row was ever written. Only an
 * end-to-end run found it. This pins the list so the next anonymous endpoint —
 * cart completions, recommendations — cannot repeat it silently.
 */
describe("customer public API paths", () => {
  const source = readFileSync(fileURLToPath(new URL("../middleware.ts", import.meta.url)), "utf8");
  // Anchored to PUBLIC_API_PATHS: PUBLIC_PATHS declares its own `customer:` list
  // first (page routes), and an unanchored match reads that one — which holds
  // no /api entries and fails every case for the wrong reason.
  const block = /PUBLIC_API_PATHS[\s\S]*?customer:\s*\[([^\]]*)\]/.exec(source)?.[1] ?? "";

  it.each(["/api/products", "/api/categories", "/api/brands", "/api/signals", "/api/cart"])(
    "%s is reachable without a session",
    (path) => {
      expect(block, `${path} is not on PUBLIC_API_PATHS.customer — anonymous shoppers get 401`).toContain(`"${path}"`);
    },
  );
});

describe("customer public page paths", () => {
  const source = readFileSync(fileURLToPath(new URL("../middleware.ts", import.meta.url)), "utf8");
  const block = /PUBLIC_PATHS[\s\S]*?customer:\s*\[([^\]]*)\]/.exec(source)?.[1] ?? "";

  it("the company-registration door is reachable without a session", () => {
    // The page renders its own sign-in prompt for anonymous visitors; bouncing
    // them to /login before it can is how a prospective B2B buyer meets a wall.
    expect(block).toContain('"/b2b/register"');
  });
});
