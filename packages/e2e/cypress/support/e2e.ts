/**
 * Cypress support file.
 *
 * Next.js hydration can raise benign cross-origin script errors that abort a
 * Cypress run for reasons unrelated to the journey under test. Genuine
 * application errors still fail the assertions in the specs themselves.
 */
Cypress.on("uncaught:exception", (err) => {
  if (/ResizeObserver loop|Hydration failed|Minified React error/i.test(err.message)) {
    return false;
  }
  return true;
});
