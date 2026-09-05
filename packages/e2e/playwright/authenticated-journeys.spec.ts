import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { url } from "../targets.mjs";
import { PERSONAS, PERSONA_SET, SEED_PASSWORD, assertPasswordConfigured } from "../personas.mjs";
import { findSessionCookie, signIn, SESSION_COOKIE_PATTERN } from "./lib/login";
import { assertConsoleHygiene, assertHealthyDom, attachWatch, settle, watchPage } from "./lib/page-health";

/**
 * The signed-in journeys, as the product owner drove them by hand.
 *
 * Three personas — a buyer, a seller owner and the platform admin — sign in
 * through the real login form and walk their portal's core pages. Every stop
 * must answer 200 on its own URL (no bounce to /login, no detour to /pending),
 * render no error surface and no untranslated message key, and log no
 * defect-class console error. Two stops are named because they are the two
 * that broke: seller /settings (a 500 — a server component handed a client
 * component an icon component) and admin /shipping-zones.
 *
 * Self-contained on purpose. It does not depend on the `auth-setup` project,
 * so a persona the active database does not hold (Seller B, on the shared
 * one) cannot take these journeys down with it; and it runs in its own
 * Playwright project with tracing off, because every request here carries a
 * session cookie and a trace would record it.
 *
 * Sign-in goes through lib/login.ts, where the harness trap that produced a
 * false "every page bounces" is encoded: locators scoped to the password form,
 * and no sign-in believed without a session cookie.
 */

interface Stop {
  path: string;
  /** Where the stop legitimately lands, when that is not its own path. */
  landsOn?: RegExp;
}

const stops = (paths: string[]): Stop[] => paths.map((path) => ({ path }));

const JOURNEYS: { persona: string; stops: Stop[] }[] = [
  {
    persona: "buyer",
    stops: [
      { path: "/account", landsOn: /^\/account\/orders$/ },
      ...stops(["/account/orders", "/cart", "/wishlist", "/products"]),
    ],
  },
  {
    persona: "sellerOwner",
    stops: stops([
      "/dashboard",
      "/products",
      "/inventory",
      "/orders",
      "/shipments",
      "/returns",
      "/quotes",
      "/payouts",
      "/invoices",
      "/analytics",
      "/documents",
      "/settings",
    ]),
  },
  {
    persona: "admin",
    stops: stops([
      "/dashboard",
      "/sellers",
      "/sellers/pending",
      "/products",
      "/categories",
      "/brands",
      "/shipping-zones",
      "/orders",
      "/shipments",
      "/companies",
      "/rfqs",
      "/finance",
      "/settlements",
      "/users",
      "/settings",
      "/audit",
    ]),
  },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const journey of JOURNEYS) {
  const persona = PERSONAS[journey.persona];
  if (!persona) {
    throw new Error(
      `Persona "${journey.persona}" has no address in the "${PERSONA_SET}" persona set (E2E_PERSONA_SET), ` +
        `and the signed-in journeys need it. See packages/e2e/personas.mjs.`,
    );
  }

  test.describe(`${persona.label} — signed-in journey`, () => {
    // Serial: sign-in runs first, and a refused sign-in skips the pages rather
    // than reporting every one of them as a bounce.
    test.describe.configure({ mode: "serial" });

    let context: BrowserContext;
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext();
      page = await context.newPage();
    });

    test.afterAll(async () => {
      await context?.close();
    });

    test(`signs in as ${persona.email} through the login form and holds a session cookie`, async () => {
      assertPasswordConfigured();
      const cookie = await signIn(page, persona, SEED_PASSWORD);
      expect(cookie.name).toMatch(SESSION_COOKIE_PATTERN);
      expect(cookie.httpOnly, "the session cookie must be HttpOnly").toBe(true);
      expect(await findSessionCookie(context, persona.portal), "the context lost the session cookie").toBeTruthy();
    });

    for (const stop of journey.stops) {
      test(`${persona.portal} ${stop.path} renders`, async ({}, testInfo) => {
        const label = `${persona.label} at ${persona.portal} ${stop.path}`;
        const watch = watchPage(page);
        try {
          const response = await page.goto(url(persona.portal, stop.path), { waitUntil: "load" });
          await settle(page);
          await attachWatch(testInfo, `${journey.persona}${stop.path.replace(/[/?=&]/g, "-")}.json`, watch);

          expect(response, `${label}: no response`).toBeTruthy();

          const landed = new URL(page.url());
          expect(
            landed.pathname,
            `${label}: bounced to ${landed.pathname}${landed.search} — the session was not honoured`,
          ).not.toMatch(/^\/login(?:\/|$)/);
          expect(landed.pathname, `${label}: sent to /pending — the seller profile is not ACTIVE`).not.toBe("/pending");
          const expected = stop.landsOn ?? new RegExp(`^${escapeRegExp(stop.path.split("?")[0])}$`);
          expect(landed.pathname, `${label}: landed on ${landed.pathname} instead`).toMatch(expected);

          expect(response!.status(), `${label}: answered HTTP ${response!.status()}`).toBe(200);

          await assertHealthyDom(page, persona.portal, label);
          assertConsoleHygiene(watch, persona.portal, label);
        } finally {
          watch.dispose();
        }
      });
    }
  });
}
