import { test, expect } from "@playwright/test";
import { url, PUBLIC_PORTAL_ROUTES } from "../targets.mjs";
import { assertConsoleHygiene, attachWatch, settle, watchPage } from "./lib/page-health";

/**
 * Console hygiene on every public route of every portal.
 *
 * Certifies what a screenshot cannot show and a build cannot know: that the
 * page logged no defect-class error and that no resource was refused. The
 * defects it encodes reached the product owner's hands after every unit test,
 * typecheck and build had passed —
 *
 *   - MISSING_MESSAGE in the console: an admin navigation label rendered its
 *     message key on every page;
 *   - a Content Security Policy that named neither Google Fonts origin, so
 *     every typeface the design system declares was silently replaced by a
 *     system fallback across all three portals. A fallback face is still a
 *     face, so nothing looked broken; the console had one line about it.
 *
 * Unauthenticated and read-only, so it can be pointed at any environment. The
 * per-page assertions live in lib/page-health.ts, shared with the signed-in
 * journeys; the one admitted class of noise — the production CSP upgrading
 * http://localhost fetches to an https://localhost nobody serves — is admitted
 * only when the target itself is loopback, and explained there.
 */

const PORTALS = ["customer", "seller", "admin"] as const;

for (const portal of PORTALS) {
  test.describe(`${portal} — console hygiene`, () => {
    for (const route of PUBLIC_PORTAL_ROUTES[portal]) {
      test(`${route} loads with a clean console and no refused resource`, async ({ page }, testInfo) => {
        const watch = watchPage(page);

        const response = await page.goto(url(portal, route), { waitUntil: "load" });
        await settle(page);

        const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "_");
        await attachWatch(testInfo, `${portal}-${slug}.json`, watch);

        expect(response, `no response for ${portal} ${route}`).toBeTruthy();
        expect(response!.status(), `${portal} ${route} answered HTTP ${response!.status()}`).toBeLessThan(400);

        assertConsoleHygiene(watch, portal, `${portal} ${route}`);
      });
    }
  });
}
