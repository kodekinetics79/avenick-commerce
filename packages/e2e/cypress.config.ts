import { defineConfig } from "cypress";
import { TARGETS } from "./targets.mjs";

/**
 * Cypress runs the same public journeys as the Playwright smoke suite.
 *
 * It is configured against the customer portal only. Cypress binds one
 * `baseUrl` per run, so cross-portal cases (seller/admin) stay in Playwright,
 * which can drive all three in a single run.
 */
export default defineConfig({
  e2e: {
    baseUrl: TARGETS.customer,
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    fixturesFolder: false,

    screenshotsFolder: "artifacts/cypress/screenshots",
    videosFolder: "artifacts/cypress/videos",
    downloadsFolder: "artifacts/cypress/downloads",
    video: true,

    defaultCommandTimeout: 10_000,
    pageLoadTimeout: 20_000,
    retries: { runMode: 1, openMode: 0 },

    // Cypress 15 warns that leaving this on lets any browser code read
    // Cypress.env(). These suites need no secrets, so keep it closed.
    allowCypressEnv: false,

    setupNodeEvents(_on, config) {
      return config;
    },
  },
});
