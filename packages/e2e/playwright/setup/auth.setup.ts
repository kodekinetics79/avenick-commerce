import { test as setup } from "@playwright/test";
import { PERSONAS, SEED_PASSWORD, storageStatePath, assertPasswordConfigured } from "../../personas.mjs";
import { signIn } from "../lib/login";

/**
 * Signs each persona in through the real login form and caches the resulting
 * browser state, so certification specs start authenticated without repeating
 * the login journey in every test.
 *
 * The login itself is exercised as a genuine journey — form fill, submit,
 * redirect, session cookie — by `lib/login.ts`, which is also where the
 * storefront's header-search trap is encoded. A forged cookie would prove
 * nothing about whether sign-in actually works.
 */

// Serial on purpose. Sign-in is rate limited per client, and six parallel
// logins trip that limit — producing failures that look like bad credentials
// but are really throttling. Serial sign-in also mirrors how a real operator
// would authenticate.
setup.describe.configure({ mode: "serial" });

for (const [name, persona] of Object.entries(PERSONAS)) {
  setup(`authenticate: ${persona.label}`, async ({ page }) => {
    assertPasswordConfigured();

    // Throws with the server's own reason — rate limiting, a refused role, or
    // an address this database does not hold — rather than cascading into a
    // confusing run of assertion failures downstream.
    await signIn(page, persona, SEED_PASSWORD);

    await page.context().storageState({ path: storageStatePath(name) });
  });
}
