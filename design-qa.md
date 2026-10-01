# Avenick Homepage Design QA

- Source visual truth: `design-references/avenick-home-option-3.png`
- Source pixels: 1487 × 1058
- Intended comparison viewport: 1440 × 1024 CSS pixels at device scale factor 1
- Implementation route: `http://localhost:13100/`
- Implementation screenshot: unavailable
- State: English, light theme, anonymous storefront homepage
- Density normalization: not performed because the implementation capture is unavailable

## Full-view comparison evidence

Blocked. The selected source image was opened and inspected. The implementation returned HTTP 200 and was opened in the Codex in-app browser, but browser inspection and screenshot capture were denied because the browser safety policy could not be verified. The local checkout also has no `DATABASE_URL`, so catalogue-backed categories, product images, and brand logos degrade to their truthful empty states in this environment.

## Focused region comparison evidence

Blocked for the same reason. The intended focused regions are the hero/search dock, illustrative RFQ specimen, category rail/product shelf, and four-step sourcing strip.

## Findings

- [P1] Browser-rendered visual evidence is unavailable.
  - Location: homepage, 1440 × 1024.
  - Evidence: the in-app browser opened the route but refused screenshot/accessibility capture because its admin-enforced policy check was unavailable.
  - Impact: typography, exact spacing, asset crop, and fold position cannot be compared against the selected mock.
  - Fix: capture the route with an approved browser session, then perform the required side-by-side comparison.

- [P1] Local catalogue data is unavailable.
  - Location: category rail, operations shelf, RFQ example thumbnails, brand strip.
  - Evidence: the development server reports that `DATABASE_URL` is unset; the application correctly falls back to empty catalogue states.
  - Impact: the local preview cannot demonstrate the populated state shown in the selected design.
  - Fix: run the preview with an authorized development database or production-like fixture environment, without adding fabricated production listings.

- [P0 resolved in source] Demo catalogue photography was not product-accurate.
  - Evidence: `packages/database/scripts/demo-images.mjs` deliberately cycles 24 Mennekes images across all active products and labels them “DEMO IMAGE — not the actual product”. The deployed catalogue contains 383 image-bearing active products but only 24 unique image URLs, all from Mennekes, across several brands.
  - Resolution: public list, detail, hero, product-card, and social-metadata projections now quarantine demo-marked images and cross-brand Mennekes images. A neutral product placeholder is used until an exact SKU/MPN image is verified.

## Comparison history

- Initial pass: blocked before visual comparison. No P0/P1/P2 visual claims were made without rendered evidence.
- Glass and motion pass: retained glass only for sticky chrome, the search dock, and the illustrative RFQ specimen; moved taxonomy and text-bearing product surfaces back to crisp planes; concentrated dimensional motion on product imagery; softened button lift; and added reduced-motion, reduced-transparency, coarse-pointer, dark-theme, and no-backdrop-filter fallbacks. A second approved-browser capture attempt was denied by the same policy check, so no visual claim is made from source alone.

## Primary interactions checked

- Source-level verification: search uses a real GET form, category selection is populated from the catalogue, RFQ CTA routes to `/b2b/rfq/new`, product/category/brand links use existing routes.
- Browser interaction testing: blocked because in-app browser inspection was denied.
- Motion/accessibility verification: every new animated transform has a `prefers-reduced-motion` fallback; decorative movement is suppressed on coarse pointers; glass surfaces have explicit opaque fallbacks for reduced transparency and unsupported backdrop filtering; custom actions retain keyboard focus treatment.
- SEO verification: the rendered homepage response contains its B2B GCC title, descriptive meta description, canonical URL, one semantic H1, and JSON-LD. Robots, sitemap, canonical, product metadata, and structured-data regression coverage passed.
- Console/build verification: server output inspected; database initialization errors are caused by the missing local `DATABASE_URL`. TypeScript, lint, and the production build passed. The full customer test suite passed: 110 files and 776 tests, with 11 integration tests skipped by their existing environment gates. The deployed readiness route reports healthy database, migration, and integration checks.

## Final result

final result: implementation verified; rendered side-by-side comparison remains blocked by the browser safety policy
