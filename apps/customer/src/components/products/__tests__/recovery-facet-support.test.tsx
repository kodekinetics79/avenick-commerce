// @vitest-environment jsdom
import * as React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss, { type AtRule, type Node as CssNode } from "postcss";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FacetRail } from "@avenick/ui";

const sheet = postcss.parse(
  readFileSync(
    resolve(__dirname, "../../../../../../packages/ui/src/globals.css"),
    "utf8",
  ),
);
afterEach(cleanup);

// jsdom does not evaluate @supports or viewport media queries. Evaluate those
// conditions for this isolated fixture, then let its CSS engine style the DOM.
// Native keyboard/layout coverage lives in e2e/recovery-facet-disclosure.spec.tsx.
function facetStyles(width: number, supportsDetailsContent: boolean) {
  const active: string[] = [];
  sheet.walkRules((rule) => {
    if (!rule.selector.startsWith(".u-facet-shell")) return;
    for (
      let parent: CssNode | undefined = rule.parent;
      parent;
      parent = parent.parent
    ) {
      if (parent.type !== "atrule") continue;
      const condition = parent as AtRule;
      if (condition.name === "supports") {
        if (condition.params !== "selector(::details-content)")
          throw new Error(`Unmodelled support condition: ${condition.params}`);
        if (!supportsDetailsContent) return;
      }
      if (condition.name === "media") {
        const min = /^\(min-width: (\d+)px\)$/.exec(condition.params);
        if (!min)
          throw new Error(`Unmodelled media condition: ${condition.params}`);
        if (width < Number(min[1])) return;
      }
    }
    active.push(rule.toString());
  });
  return active.join("\n");
}

describe("facet support fallback", () => {
  for (const width of [390, 1280]) {
    it.each([false, true])(
      `keeps a working disclosure unless desktop can reveal content (${width}px, support=%s)`,
      async (supported) => {
        const user = userEvent.setup();
        const { container } = render(
          <>
            <style>{facetStyles(width, supported)}</style>
            <details className="u-facet-shell">
              <summary>Filters</summary>
              <FacetRail
                label="Categories"
                defaultOpen
                options={[{ id: "tools", label: "Tools", href: "#tools" }]}
              />
            </details>
          </>,
        );
        const summary = screen.getByText("Filters");
        const enhancedDesktop = supported && width >= 1024;
        expect(getComputedStyle(summary).display).toBe(
          enhancedDesktop ? "none" : "flex",
        );
        if (!enhancedDesktop) {
          await user.click(summary);
          expect(container.querySelector("details")!.open).toBe(true);
          expect(screen.getByRole("link", { name: "Tools" })).toBeTruthy();
          await user.click(summary);
          expect(container.querySelector("details")!.open).toBe(false);
        }
      },
    );
  }
});
