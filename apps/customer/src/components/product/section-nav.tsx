"use client";

import * as React from "react";
import { Divider, Surface } from "@avenick/ui";
import { FOCUS_INSET } from "./product-facts";

export type SectionNavEntry = { id: string; label: string };

/**
 * The product page's sticky section nav.
 *
 * Plain anchors rather than buttons that call window.scrollTo: they are
 * keyboard-native, they work before hydration and with JavaScript off, and the
 * smooth scroll comes from the stylesheet, which is already switched off under
 * prefers-reduced-motion. The active mark is the same drawn brass rule
 * everything else on the page uses.
 *
 * The bar is a SIBLING of the content panel rather than its first child. An
 * ancestor with `overflow: hidden` becomes the scroll box a sticky element
 * sticks inside, and because that box never scrolls itself the bar would simply
 * never stick. It would ride up the page with the panel. It also sits one step
 * BELOW the site header in the stacking order, so a header that wraps taller on
 * a narrow viewport covers this rather than the other way round.
 *
 * The focus ring is drawn inside each anchor: the strip scrolls horizontally,
 * and a scroll container clips an outward ring.
 *
 * THE STRIP SAYS IT SCROLLS. On a 390px phone the four tabs are 508px wide in a
 * 356px strip, so "Shipping & returns" sat entirely off the end, behind a hidden
 * scrollbar with no fade and no control. §6 names that an accessibility
 * regression. Two things fix it without adding a control:
 *
 *   - The symmetric inline mask, the same one <Rail> uses, goes on only when
 *     the strip really overflows. Feathering four tabs that all fit would fade
 *     "Description" for no reason, which reads as a rendering fault. The mask is
 *     symmetric by construction, so it needs no second rule in Arabic.
 *   - When the section being read changes, the active tab is brought inside the
 *     strip, clear of the feathered edge. This scrolls the STRIP ONLY, with
 *     scrollBy. scrollIntoView would scroll the document as well, and it would
 *     cancel the smooth anchor scroll still in flight when the observer fires.
 *     Physical rect deltas are correct in both reading directions, so there is
 *     no RTL branch.
 *
 * Not printed: on paper a sticky strip of in-page anchors is chrome, not content.
 */
export function SectionNav({
  label,
  sections,
  active,
}: {
  label: string;
  sections: SectionNavEntry[];
  active: string;
}) {
  const strip = React.useRef<HTMLUListElement>(null);
  const [overflows, setOverflows] = React.useState(false);
  // The review count lives in a label, so a label change can change the width.
  const labelsKey = sections.map((entry) => entry.label).join("|");

  React.useEffect(() => {
    const node = strip.current;
    if (!node) return;
    const measure = () => setOverflows(node.scrollWidth > node.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [labelsKey]);

  React.useEffect(() => {
    const node = strip.current;
    const tab = node?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!node || !tab || node.scrollWidth <= node.clientWidth + 1 || typeof node.scrollBy !== "function") return;
    // Clear of the feathered edge, not merely inside the box.
    const edge = Number.parseFloat(getComputedStyle(node).getPropertyValue("--edge")) || 0;
    const bounds = node.getBoundingClientRect();
    const box = tab.getBoundingClientRect();
    if (box.right > bounds.right - edge) node.scrollBy({ left: box.right - (bounds.right - edge) });
    else if (box.left < bounds.left + edge) node.scrollBy({ left: box.left - (bounds.left + edge) });
  }, [active]);

  return (
    <Surface as="nav" rung={1} aria-label={label} className="sticky top-16 z-20 rounded-b-none print:hidden">
      <ul ref={strip} className={`flex overflow-x-auto scrollbar-hide ${overflows ? "u-edge-fade-inline" : ""}`}>
        {sections.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={active === entry.id ? "true" : undefined}
              className={`${FOCUS_INSET} relative flex h-row items-center whitespace-nowrap px-5 u-ui font-medium transition-colors duration-press ease-standard ${
                active === entry.id ? "text-ink-1" : "text-ink-3 hover:text-ink-1"
              }`}
            >
              {entry.label}
              <Divider drawn on={active === entry.id} className="absolute inset-x-0 bottom-0" />
            </a>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
