import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright is the evidence-producing framework of the three.
 *
 * Reporters and artifacts are configured for the gated-prompt process: every
 * run emits a trace, a screenshot and a video per failure, plus a machine
 * readable JSON summary. Those are the artifacts a gate report cites — a green
 * console line is not evidence on its own.
 *
 * No `webServer` block on purpose: the portals need a reachable database, so
 * starting them is an operator decision, not something a test run should do
 * implicitly. Start the apps first, or point E2E_*_URL at a deployed runtime.
 */
export default defineConfig({
  testDir: "./playwright",
  testMatch: /.*\.spec\.ts$/,

  // A gate run must never pass because a test quietly did nothing.
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/playwright-report", open: "never" }],
    ["json", { outputFile: "artifacts/playwright-results.json" }],
  ],

  outputDir: "artifacts/playwright-output",

  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    // ── Public, unauthenticated ────────────────────────────────────────────
    {
      name: "chromium",
      testIgnore: /authenticated\//,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // The storefront ships an Arabic RTL surface; layout regressions there are
      // invisible to an LTR-only run.
      name: "chromium-rtl",
      testIgnore: /authenticated\//,
      use: {
        ...devices["Desktop Chrome"],
        locale: "ar-AE",
        timezoneId: "Asia/Dubai",
      },
    },

    // ── Authenticated certification ────────────────────────────────────────
    // Signs every persona in once, then the authenticated suite reuses that
    // state. Split out so a credential problem fails loudly in setup rather
    // than as a confusing cascade of assertion failures.
    {
      name: "auth-setup",
      testMatch: /setup\/auth\.setup\.ts/,
      // Sign-in involves bcrypt plus a round trip to a remote database, so the
      // default is tight. It no longer needs to cover a retry backoff — setup
      // fails fast on rate limiting rather than sleeping through it.
      timeout: 60_000,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated",
      testMatch: /authenticated\/.*\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
