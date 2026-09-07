import { expect, type ConsoleMessage, type Page, type Request, type TestInfo } from "@playwright/test";
import { isLocalTarget } from "../../targets.mjs";

/**
 * What a healthy page looks like from the outside — shared by the public
 * console-hygiene certification and the signed-in journeys.
 *
 * Every check here encodes a defect that reached the product owner's hands
 * after every unit test, typecheck and build had passed. None of them is
 * visible in a screenshot, and each of them is visible in exactly one of the
 * three places this module watches: the console, the network log, or the
 * rendered text.
 */

type PortalName = "customer" | "seller" | "admin";

/**
 * Console errors that are always a defect, whoever logs them:
 *  - MISSING_MESSAGE      next-intl could not resolve a message key (an admin
 *                         nav label rendered its key on every page);
 *  - is not a function /  a server component handed a client component
 *    Cannot read prop     something that does not survive serialisation (an
 *                         icon component, on the seller settings page — a 500);
 *  - Minified React error a production hydration or render fault, which React
 *                         reports only by number; `Hydration failed` is the
 *                         same fault as a dev build spells it.
 */
export const DEFECT_CONSOLE_PATTERN = /MISSING_MESSAGE|is not a function|Cannot read prop|Minified React error|Hydration failed/;

/** Chromium's wording when a policy refuses a resource. */
export const CSP_VIOLATION_PATTERN = /Content Security Policy/i;

/** The two Google Fonts origins: the stylesheet host and the font-file host. */
export const FONT_HOST_PATTERN = /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//;

/**
 * Text that means the page failed to render even when the status was 200 — a
 * Next.js error boundary still answers 200, so status alone is not enough.
 */
export const ERROR_SURFACE_PATTERN =
  /MISSING_MESSAGE|Application error|Something went wrong|This page could not be found|Internal Server Error|Unhandled Runtime Error/;

/**
 * next-intl's fallback for a key it cannot resolve is the key path itself
 * (`adminShell.nav.items.shippingZones`), logged as MISSING_MESSAGE only where
 * the translator ran — a server component's console is the server's, not the
 * browser's, so on screen the key path is the only trace. These are the
 * namespaces whose names cannot occur in prose, so a match is never a false
 * alarm; generic ones (`common`, `orders`) are left out on purpose.
 */
const MESSAGE_NAMESPACES: Record<PortalName, string[]> = {
  customer: ["catalogue", "discovery", "pdp", "brandsContent", "spatialCommerce"],
  seller: ["sellerShell", "sellerRelations", "sellerCatalog", "sellerOps"],
  admin: ["adminShell", "adminCommerce", "adminReview"],
};

export function untranslatedKeyPattern(portal: PortalName): RegExp {
  return new RegExp(`(?<![\\w/.-])(?:${MESSAGE_NAMESPACES[portal].join("|")})\\.[A-Za-z]\\w*(?:\\.[A-Za-z]\\w*)*(?![\\w/-])`);
}

export interface FailedRequest {
  url: string;
  errorText: string;
}

export interface PageWatch {
  consoleErrors: string[];
  failedRequests: FailedRequest[];
  /** Detach the listeners, so a page reused across tests does not accumulate. */
  dispose(): void;
}

/** Start recording console errors, uncaught exceptions and failed requests. */
export function watchPage(page: Page): PageWatch {
  const consoleErrors: string[] = [];
  const failedRequests: FailedRequest[] = [];

  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const onPageError = (error: Error) => {
    consoleErrors.push(`Uncaught ${error.message}`);
  };
  const onRequestFailed = (request: Request) => {
    failedRequests.push({ url: request.url(), errorText: request.failure()?.errorText ?? "" });
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);

  return {
    consoleErrors,
    failedRequests,
    dispose() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
    },
  };
}

/**
 * Give hydration and deferred client fetches a moment to finish. Some pages
 * poll (the status page, for one), so "idle" may never arrive; the errors a
 * spec is after are logged well inside this window.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {
    /* A polling page never idles; nothing to do. */
  });
}

/**
 * The single admitted class of network noise, and only against a loopback
 * target. The production CSP carries `upgrade-insecure-requests`, which makes
 * Chromium rewrite the app's own http://localhost:PORT fetches — Next's RSC
 * route prefetches above all — to https://localhost:PORT, where nothing
 * listens. On a deployed https origin the rewrite is a no-op, so the same
 * failure there is real and is reported.
 */
export function isLocalUpgradeNoise(portal: PortalName, requestUrl: string): boolean {
  return isLocalTarget(portal) && /^https:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\//.test(requestUrl);
}

/** Write what was observed into the report, so a green line is not the only evidence. */
export async function attachWatch(testInfo: TestInfo, name: string, watch: PageWatch): Promise<void> {
  await testInfo.attach(name, {
    body: JSON.stringify({ consoleErrors: watch.consoleErrors, failedRequests: watch.failedRequests }, null, 2),
    contentType: "application/json",
  });
}

const list = (items: string[]) => items.map((item) => `  - ${item}`).join("\n");

/** Zero defect-class console errors, zero CSP refusals, zero failed requests. */
export function assertConsoleHygiene(watch: PageWatch, portal: PortalName, label: string): void {
  const defects = watch.consoleErrors.filter((message) => DEFECT_CONSOLE_PATTERN.test(message));
  expect(defects, `${label}: defect-class console errors\n${list(defects)}`).toEqual([]);

  const violations = watch.consoleErrors.filter((message) => CSP_VIOLATION_PATTERN.test(message));
  expect(
    violations,
    `${label}: the Content Security Policy refused a resource. This is invisible in a screenshot — ` +
      `a fallback typeface is still a typeface — and shows up only here. The policy lives in ` +
      `packages/config/security-headers.mjs.\n${list(violations)}`,
  ).toEqual([]);

  const blockedFonts = watch.failedRequests.filter(
    (request) => FONT_HOST_PATTERN.test(request.url) && /csp/i.test(request.errorText),
  );
  expect(
    blockedFonts,
    `${label}: web fonts blocked by CSP (style-src needs fonts.googleapis.com, font-src needs fonts.gstatic.com)\n` +
      list(blockedFonts.map((request) => `${request.url} :: ${request.errorText}`)),
  ).toEqual([]);

  const failures = watch.failedRequests.filter(
    (request) => !/ERR_ABORTED/.test(request.errorText) && !isLocalUpgradeNoise(portal, request.url),
  );
  expect(
    failures,
    `${label}: requests failed at the network level (a "csp" error text means the policy refused it)\n` +
      list(failures.map((request) => `${request.url} :: ${request.errorText}`)),
  ).toEqual([]);
}

/** No error surface and no untranslated message key in the rendered text. */
export async function assertHealthyDom(page: Page, portal: PortalName, label: string): Promise<void> {
  const text = await page.locator("body").innerText();

  const surface = text.match(ERROR_SURFACE_PATTERN)?.[0] ?? null;
  expect(surface, `${label}: the page rendered an error surface ("${surface}")`).toBeNull();

  const key = text.match(untranslatedKeyPattern(portal))?.[0] ?? null;
  expect(key, `${label}: an untranslated message key is on screen ("${key}")`).toBeNull();
}
