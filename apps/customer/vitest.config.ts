import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // The spatial-commerce feature ships Playwright specs under e2e/. Vitest
    // would collect them, fail to resolve @playwright/test's fixtures and
    // report a broken unit suite, so the browser specs are excluded here and
    // run by `test:e2e:spatial` instead.
    exclude: ["e2e/**", "node_modules/**", ".next/**", "dist/**"],
  },
});
