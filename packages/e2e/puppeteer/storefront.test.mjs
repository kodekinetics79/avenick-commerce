import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";

import { url, FORBIDDEN_ON_PUBLIC_PAGES, PUBLIC_CUSTOMER_ROUTES } from "../targets.mjs";

/**
 * Puppeteer suite, driven by the built-in `node --test` runner.
 *
 * Puppeteer has no test runner of its own, and adding a third one (on top of
 * vitest and Cypress) would not earn its keep — so this uses the Node runner
 * that ships with the repo's Node 22 baseline. No extra dependency.
 *
 * Same scope rule as the other suites: unauthenticated, read-only.
 */

let browser;

before(async () => {
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
});

after(async () => {
  await browser?.close();
});

describe("storefront reachability", () => {
  for (const route of PUBLIC_CUSTOMER_ROUTES) {
    test(`public route renders: ${route}`, async () => {
      const page = await browser.newPage();
      try {
        const response = await page.goto(url("customer", route), {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });

        assert.ok(response, `no response for ${route}`);
        assert.ok(
          response.status() < 400,
          `${route} returned HTTP ${response.status()}`,
        );

        const body = await page.evaluate(() => document.body.innerText);
        assert.doesNotMatch(body, /Application error/i, `${route} rendered an error boundary`);
        assert.doesNotMatch(body, /This page could not be found/i, `${route} rendered a 404 body`);
      } finally {
        await page.close();
      }
    });
  }
});

describe("D-01 — no credentials on unauthenticated login pages", () => {
  // Expected to FAIL until the credential strings are removed from all three
  // login pages. See AVENICK_GATE_1_WORKTREE_AUDIT_2026-08-17.md.
  for (const portal of ["customer", "seller", "admin"]) {
    test(`${portal} login page leaks no credentials`, async () => {
      const page = await browser.newPage();
      try {
        await page.goto(url(portal, "/login"), {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });

        const rendered = await page.evaluate(() => document.body.innerText);

        for (const secret of FORBIDDEN_ON_PUBLIC_PAGES) {
          assert.ok(
            !rendered.includes(secret),
            `${portal} login page renders credential string "${secret}" (defect D-01)`,
          );
        }
      } finally {
        await page.close();
      }
    });
  }
});

describe("authorization fails closed", () => {
  test("admin dashboard redirects anonymous visitors to login", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(url("admin", "/dashboard"), {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });

      assert.match(page.url(), /\/login/, "admin dashboard did not redirect to login");
    } finally {
      await page.close();
    }
  });
});
