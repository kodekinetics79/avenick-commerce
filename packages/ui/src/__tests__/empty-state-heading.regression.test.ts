import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyState } from "../empty-state";

/**
 * EmptyState set its lead sentence in a <p>, with no way to say otherwise.
 *
 * That is right for the hundred-odd call sites that are an empty table inside a
 * page with its own title, and wrong for the handful where the plate IS the
 * page. The storefront's 404, its route error boundary and the anonymous empty
 * cart all rendered with no h1 at all, so a screen reader announced them as
 * untitled pages — the 404 being the page that most needs a name.
 *
 * The fix is an element choice, not a restyle, so these assert both halves: the
 * default is still a <p> for every existing caller, and a promoted lead keeps
 * exactly the provenance classes it had.
 */
const LEAD_CLASSES = "u-provenance max-w-desc text-h2 text-ink-1";

function certificate(headingLevel?: "p" | "h1" | "h2") {
  return renderToStaticMarkup(
    createElement(EmptyState, {
      variant: "certificate",
      headline: "This address does not resolve to a page.",
      action: createElement("a", { href: "/products" }, "Browse"),
      ...(headingLevel ? { headingLevel } : {}),
    }),
  );
}

describe("EmptyState lead element", () => {
  it("keeps a <p> by default, so no existing call site gains a heading", () => {
    expect(certificate()).toContain(`<p class="${LEAD_CLASSES}">This address does not resolve to a page.</p>`);
    expect(certificate()).not.toMatch(/<h[1-6]/);

    const plain = renderToStaticMarkup(createElement(EmptyState, { headline: "No orders yet." }));
    expect(plain).toContain("<p class=\"u-provenance mx-auto max-w-desc text-h2 text-ink-1\">No orders yet.</p>");
  });

  it("sets the lead as an h1 when the plate is the page, with the same classes", () => {
    expect(certificate("h1")).toContain(`<h1 class="${LEAD_CLASSES}">This address does not resolve to a page.</h1>`);

    const plain = renderToStaticMarkup(
      createElement(EmptyState, { headline: "No orders yet.", headingLevel: "h2" }),
    );
    expect(plain).toContain("<h2 class=\"u-provenance mx-auto max-w-desc text-h2 text-ink-1\">No orders yet.</h2>");
  });
});
