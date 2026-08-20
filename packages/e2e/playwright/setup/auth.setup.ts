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

    await page.goto(url(persona.portal, "/login"), { waitUntil: "domcontentloaded" });

    await page.locator("#login-email, input[type=email]").first().fill(persona.email);
    await page.locator("#login-password, input[type=password]").first().fill(SEED_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Landing anywhere other than /login means credentials were accepted.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.context().storageState({ path: storageStatePath(name) });
  });
}
