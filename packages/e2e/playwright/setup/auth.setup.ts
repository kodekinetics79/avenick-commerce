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

    // Sign-in is rate limited per identifier AND per client IP (30 per 15
    // minutes). Repeated suite runs legitimately exhaust that budget.
    //
    // Do not retry it. The window is 15 minutes, so any backoff short enough to
    // sit inside a test timeout is far too short to clear it — an earlier
    // version burned 2.5 minutes of backoff and still failed. Detect the
    // server's own signal and report the truth immediately.
    await page.goto(url(persona.portal, "/login"), { waitUntil: "domcontentloaded" });

    await page.locator("#login-email, input[type=email]").first().fill(persona.email);
    await page.locator("#login-password, input[type=password]").first().fill(SEED_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for the navigation only. Racing this against a locator fails: a
    // successful sign-in calls window.location.assign(), which destroys the
    // execution context and rejects any pending locator instantly.
    await page
      .waitForURL((u) => !/\/login/.test(u.toString()), { timeout: 20_000 })
      .catch(() => {
        /* Still on /login — determined below. */
      });

    if (!/\/login/.test(page.url())) {
      await page.context().storageState({ path: storageStatePath(name) });
      return;
    }

    // Auth.js reports the precise reason as a `code` parameter. Read that rather
    // than the rendered banner, which depends on client hydration.
    const code = new URL(page.url()).searchParams.get("code") ?? "";
    if (code === "rate_limited") {
      throw new Error(
        `Sign-in is rate limited for ${persona.email} — the per-IP budget ` +
          `(30 attempts / 15 minutes) is exhausted.\n` +
          `This is the security control working, not a broken test. Wait for the ` +
          `window to roll over and re-run. Running the full suite repeatedly in ` +
          `quick succession will reproduce it.`,
      );
    }

    const banner = await page
      .locator('[role="alert"]')
      .first()
      .innerText()
      .catch(() => "");

    throw new Error(
      `Could not authenticate ${persona.label} (${persona.email}).\n` +
        `Started at: ${url(persona.portal, "/login")}\n` +
        `Ended at:   ${page.url()}\n` +
        `Auth.js code: ${code || "(none)"}\n` +
        `Page said: ${banner.trim() || "(no error banner)"}\n` +
        `Check that E2E_SEED_PASSWORD matches the SEED_PASSWORD used by the seed.`,
    );
  });
}
