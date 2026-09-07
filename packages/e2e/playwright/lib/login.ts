import { expect, type BrowserContext, type Cookie, type Page } from "@playwright/test";
import { url } from "../../targets.mjs";
import { PERSONA_SET } from "../../personas.mjs";

/**
 * The one way the harness signs a persona in.
 *
 * Sign-in is exercised as a genuine journey — form fill, submit, redirect —
 * rather than by forging a session cookie, because a forged cookie proves
 * nothing about whether sign-in works. Every spec that needs a session goes
 * through here so the trap below is encoded once, not rediscovered per spec.
 *
 * THE HARNESS TRAP THIS FILE EXISTS FOR. The storefront's header carries a
 * search form — a real GET form, so it works before hydration — and its submit
 * control is a plain `button[type="submit"]`. A login step written as "fill the
 * two fields, click the first submit button" clicks THAT button on the customer
 * portal: the browser lands on /search?q= with no session cookie, and every
 * protected page the run visits afterwards bounces to /login. Read from the
 * outside, that is a whole portal's authentication reported broken by a test
 * that never submitted the login form. Two rules close it:
 *
 *   1. Every locator is scoped to `form:has(input[type="password"])` — the
 *      only form on a login page that can possibly sign anyone in.
 *   2. A sign-in is not believed until a `*.session-token` cookie exists. A
 *      navigation away from /login without one is reported as a harness fault
 *      in its own words, never allowed to masquerade as a product defect.
 */

type PortalName = "customer" | "seller" | "admin";

export interface SignInPersona {
  email: string;
  portal: PortalName;
  label: string;
}

/**
 * The Auth.js session cookie each portal issues — `avenick.<portal>.session-token`
 * (packages/auth/src/remote-session.ts), with a `__Secure-` prefix over HTTPS.
 * Matching the suffix keeps the check true for every portal and both schemes.
 */
export const SESSION_COOKIE_PATTERN = /(?:^|[.-])session-token$/;

/** The session cookie held for a portal, preferring the one named for it. */
export async function findSessionCookie(context: BrowserContext, portal: PortalName): Promise<Cookie | undefined> {
  const session = (await context.cookies()).filter((cookie) => SESSION_COOKIE_PATTERN.test(cookie.name));
  return session.find((cookie) => cookie.name.includes(`.${portal}.`)) ?? session[0];
}

/**
 * Signs `persona` in through the real login form of its portal and returns the
 * session cookie the portal issued. Throws, with the reason, otherwise.
 */
export async function signIn(page: Page, persona: SignInPersona, password: string): Promise<Cookie> {
  const loginUrl = url(persona.portal, "/login");
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

  // Wait for hydration before typing. `fill()` sets the DOM value and dispatches
  // an input event, but React only records it once the client bundle has
  // hydrated — before that the component state stays empty and the form submits
  // blank credentials, which the server correctly rejects as "Invalid email or
  // password". Under parallel load that produced a failure that looked like bad
  // credentials while the account was perfectly fine.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {
    /* Best effort: the value check below is the real guarantee. */
  });

  const form = page.locator('form:has(input[type="password"])');
  await expect(
    form,
    `${loginUrl} renders no form with a password field, so nothing on it can sign ${persona.label} in`,
  ).toHaveCount(1);

  const emailField = form.locator('input[type="email"], #login-email').first();
  const passwordField = form.locator('input[type="password"]').first();

  await emailField.fill(persona.email);
  await passwordField.fill(password);

  // Confirm the values actually stuck. If hydration was still in flight the
  // first fill is silently discarded, so re-enter rather than submit blanks.
  if ((await emailField.inputValue()) !== persona.email) {
    await emailField.fill(persona.email);
    await passwordField.fill(password);
  }

  // The submit control OF THIS FORM — never the page's first submit button.
  await form.locator('button[type="submit"]').first().click();

  // Wait for the navigation only. Racing this against a locator fails: a
  // successful sign-in calls window.location.assign(), which destroys the
  // execution context and rejects any pending locator instantly.
  await page
    .waitForURL((current) => !isLoginPath(current.pathname), { timeout: 20_000 })
    .catch(() => {
      /* Still on /login — explained below. */
    });

  const landed = new URL(page.url());
  if (isLoginPath(landed.pathname)) {
    throw new Error(await explainRefusal(page, persona, loginUrl, landed));
  }

  const cookie = await findSessionCookie(page.context(), persona.portal);
  if (!cookie) {
    const names = (await page.context().cookies()).map((c) => c.name).join(", ") || "(none)";
    throw new Error(
      `HARNESS FAULT, not a product defect: ${persona.label} (${persona.email}) left ${loginUrl} for ` +
        `${page.url()} but holds no *.session-token cookie, so nothing signed in.\n` +
        `A navigation without a session means some other form on the page was submitted — on the ` +
        `storefront the header search posts to /search?q=. This helper scopes every locator to the ` +
        `password form precisely so that cannot happen; if you are reading this, that scoping broke.\n` +
        `Cookies present: ${names}`,
    );
  }
  return cookie;
}

function isLoginPath(pathname: string): boolean {
  return /^\/login(?:\/|$)/.test(pathname);
}

/**
 * The portal refused. Auth.js reports the precise reason as a `code` parameter
 * and the middleware as `error`, so read those rather than the rendered
 * banner, which depends on client hydration.
 */
async function explainRefusal(page: Page, persona: SignInPersona, loginUrl: string, landed: URL): Promise<string> {
  const code = landed.searchParams.get("code") ?? "";
  const error = landed.searchParams.get("error") ?? "";

  // Sign-in is rate limited per identifier AND per client IP (30 per 15
  // minutes). Repeated suite runs legitimately exhaust that budget.
  //
  // Do not retry it. The window is 15 minutes, so any backoff short enough to
  // sit inside a test timeout is far too short to clear it — an earlier
  // version burned 2.5 minutes of backoff and still failed. Detect the
  // server's own signal and report the truth immediately.
  if (code === "rate_limited") {
    return (
      `Sign-in is rate limited for ${persona.email} — the per-IP budget (30 attempts / 15 minutes) ` +
      `is exhausted.\nThis is the security control working, not a broken test. Wait for the window ` +
      `to roll over and re-run. Running the full suite repeatedly in quick succession will reproduce it.`
    );
  }

  if (error === "forbidden") {
    return (
      `${persona.label} (${persona.email}) signed in but the ${persona.portal} portal refused the ` +
        `account's role. The persona table maps this address to the wrong portal, or the account's ` +
        `role changed on the database.`
    );
  }

  const banner = await page
    .locator('[role="alert"]')
    .first()
    .innerText({ timeout: 2_000 })
    .catch(() => "");

  return (
    `Could not authenticate ${persona.label} (${persona.email}).\n` +
    `Started at: ${loginUrl}\n` +
    `Ended at:   ${page.url()}\n` +
    `Auth.js code: ${code || "(none)"}\n` +
    `Page said: ${banner.trim() || "(no error banner)"}\n` +
    `Persona set: ${PERSONA_SET} (E2E_PERSONA_SET). "Invalid email or password" cannot tell a wrong ` +
    `password from an address that does not exist on this database: check that E2E_SEED_PASSWORD ` +
    `matches the password the accounts were given, and that the persona set names the accounts the ` +
    `portals' database actually holds (see packages/e2e/personas.mjs).`
  );
}
