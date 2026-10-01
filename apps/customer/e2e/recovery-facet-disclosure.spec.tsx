import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";

const css = readFileSync(
  resolve(__dirname, "../../../packages/ui/src/globals.css"),
  "utf8",
).replace(/^@import\s[^;]*;/gm, ""); // Keep this native-CSS fixture offline; web fonts are unrelated.

test.describe("facet disclosure keyboard recovery", () => {
  for (const width of [390, 1280]) {
    for (const supported of [false, true]) {
      for (const locale of ["en", "ar"]) {
        test(`keeps filters reachable at ${width}px, details-content support=${supported}, locale=${locale}`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 800 });
          try {
            await page.route("**/*", (route) => route.abort());
            const label = locale === "ar" ? "عوامل التصفية" : "Filters";
            const category = locale === "ar" ? "الفئات" : "Categories";
            // This browser test targets native disclosure/CSS keyboard behavior.
            // recovery-facet-support.test.tsx separately renders the real React
            // primitive; standard Playwright transforms JSX into mount descriptors.
            await page.setContent(`
              <div dir="${locale === "ar" ? "rtl" : "ltr"}">
                <details class="u-facet-shell">
                  <summary class="u-focus">${label}</summary>
                  <details open class="u-facet border-b border-hairline">
                    <summary class="u-focus"><span>${category}</span></summary>
                    <ul><li><a href="#tools" class="u-focus">Tools</a></li></ul>
                  </details>
                </details>
                <button>After filters</button>
              </div>
            `);
            // Chrome exercises the native supported branch. An unknown selector
            // makes the feature query false to exercise fallback in the same engine.
            await page.addStyleTag({
              content: supported
                ? css
                : css.replaceAll(
                    "selector(::details-content)",
                    "selector(::avenick-unsupported-details-content)",
                  ),
            });
            const enhancedDesktop =
              supported &&
              width >= 1024 &&
              (await page.evaluate(() =>
                CSS.supports("selector(::details-content)"),
              ));
            const summary = page.locator(".u-facet-shell > summary");
            expect(await summary.isVisible()).toBe(!enhancedDesktop);
            await page.keyboard.press("Tab");
            if (!enhancedDesktop) {
              expect(
                await summary.evaluate(
                  (node) => node === document.activeElement,
                ),
              ).toBe(true);
              await page.keyboard.press("Enter");
              expect(
                await page.locator(".u-facet-shell").getAttribute("open"),
              ).not.toBeNull();
              await page.keyboard.press("Tab");
            }
            expect(
              await page
                .locator(".u-facet > summary")
                .evaluate((node) => node === document.activeElement),
            ).toBe(true);
            await page.keyboard.press("Tab");
            expect(
              await page
                .getByRole("link", { name: "Tools" })
                .evaluate((node) => node === document.activeElement),
            ).toBe(true);
            if (!enhancedDesktop) {
              await page.keyboard.press("Shift+Tab");
              await page.keyboard.press("Shift+Tab");
              await page.keyboard.press("Space");
              expect(
                await page.locator(".u-facet-shell").getAttribute("open"),
              ).toBeNull();
              await page.keyboard.press("Tab");
              expect(
                await page
                  .getByRole("button", { name: "After filters" })
                  .evaluate((node) => node === document.activeElement),
              ).toBe(true);
            }
          } finally {
            await page.close();
          }
        });
      }
    }
  }
});
