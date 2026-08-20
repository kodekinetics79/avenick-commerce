import { test as setup, expect } from "@playwright/test";
import { url } from "../../targets.mjs";
import { PERSONAS, SEED_PASSWORD, storageStatePath, assertPasswordConfigured } from "../../personas.mjs";

/**
 * Signs each persona in through the real login form and caches the resulting
 * browser state, so certification specs start authenticated without repeating
 * the login journey in every test.
 *
 * The login itself is exercised as a genuine journey here — form fill, submit,
 * redirect — rather than by forging a session cookie. A forged cookie would
 * prove nothing about whether sign-in actually works.
 */

// Serial on purpose. Sign-in is rate limited per client, and six parallel
// logins trip that limit — producing failures that look like bad credentials
// but are really throttling. Serial sign-in also mirrors how a real operator
// would authenticate.
setup.describe.configure({ mode: "serial" });

for (const [name, persona] of Object.entries(PERSONAS)) {
  setup(`authenticate: ${persona.label}`, async ({ page }) => {
    assertPasswordConfigured();

    // Sign-in is rate limited per identifier AND per client IP. Repeated suite
    // runs legitimately exhaust the IP budget, which previously surfaced as a
    // confusing "still on /login" failure. Back off and retry instead of
    // treating a working security control as a broken test.
    const MAX_ATTEMPTS = 4;
    let lastReason = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await page.goto(url(persona.portal, "/login"), { waitUntil: "domcontentloaded" });

      await page.locator("#login-email, input[type=email]").first().fill(persona.email);
      await page.locator("#login-password, input[type=password]").first().fill(SEED_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();

      // Give the navigation a chance before inspecting the outcome.
      await page.waitForTimeout(1_500);

      if (!/\/login/.test(page.url())) {
        await page.context().storageState({ path: storageStatePath(name) });
        return;
      }

      lastReason = (await page.locator("body").innerText().catch(() => "")).slice(0, 300);

      const throttled = /too many/i.test(lastReason);
      if (!throttled) break; // A real credential rejection: fail fast, do not retry.

      if (attempt < MAX_ATTEMPTS) {
        // The window is 15 minutes; a short wait clears bursts, not the whole
        // budget, so this is bounded and honest rather than a spin.
        await page.waitForTimeout(attempt * 20_000);
      }
    }

    throw new Error(
      `Could not authenticate ${persona.label} (${persona.email}) at ${url(persona.portal, "/login")}.\n` +
        `Page said: ${lastReason || "(no message)"}\n` +
        `If this mentions rate limiting, the per-IP sign-in budget is exhausted — wait for the ` +
        `15-minute window to roll over. Otherwise check E2E_SEED_PASSWORD matches the seed's SEED_PASSWORD.`,
    );
  });
}
