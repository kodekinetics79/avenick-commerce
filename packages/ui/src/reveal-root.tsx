"use client";

import * as React from "react";

/**
 * RevealRoot — one IntersectionObserver for every [data-reveal] on the page.
 *
 * Mount it once per layout, next to <AmbientField>. It is the only client
 * component the reveal system needs; <Reveal> itself stays a server component.
 *
 * The ordering here is the part that matters. On mount it asks the observer
 * which elements are ALREADY on screen, hides only the ones that are not, and
 * then lets them animate in as they arrive. Anything above the fold is never
 * hidden, so there is no flash of missing content on a slow hydrate, and if this
 * component never runs at all the page is simply fully visible.
 *
 * Disabled entirely under [data-portal="admin"] and under reduced motion, where
 * the listener is never registered rather than made a no-op.
 */
export function RevealRoot() {
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    if (document.documentElement.dataset.portal === "admin") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            el.dataset.revealState = "shown";
            observer.unobserve(el);
          } else if (!el.dataset.revealState) {
            // First sighting and it is off screen: only now is it safe to hide.
            el.dataset.revealState = "hidden";
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
