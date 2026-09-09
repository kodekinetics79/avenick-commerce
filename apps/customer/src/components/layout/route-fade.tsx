"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * The arrival of a new page.
 *
 * Storefront navigation was instantaneous in the worst sense: the old page's
 * pixels were replaced by the new page's in one frame, with nothing to tell the
 * eye that the change was the same continuous act it had just asked for. This
 * gives the content one short settle. The chrome around it does not move,
 * because a header that re-animates on every navigation reads as a full page
 * load — the thing client-side routing exists to stop looking like.
 *
 * OPACITY ONLY, and that is not a style preference. A `transform` here would
 * make this wrapper the containing block for every `position: fixed` descendant
 * inside <main> and would clip the sticky ones — the exact failure that put
 * every dialog in the product thousands of pixels below the fold. `.u-route` is
 * named in the containing-block guard test for that reason.
 *
 * THE FIRST PAGE OF A VISIT IS NOT ANIMATED. A fade from zero on first paint
 * delays the largest contentful paint by the length of the fade, for a
 * transition nobody asked for: the visitor did not navigate, they arrived.
 *
 * That decision cannot live in a ref, and this is the part worth reading. Every
 * page renders its own <MainLayout>, so this component is REMOUNTED on each
 * navigation and any instance state resets with it — an earlier version kept
 * `hasNavigated` in a ref and therefore never once animated, while looking
 * entirely correct in a unit test that rerendered a single instance. The state
 * belongs to the DOCUMENT, so it lives at module scope, where it is created
 * fresh per server request and per browser tab, and is exactly what "since this
 * page was loaded" means.
 */
let entryPath: string | null = null;
let hasNavigated = false;

/** Exported for tests: the module remembers a document, and a test is a new one. */
export function __resetRouteFadeForTests() {
  entryPath = null;
  hasNavigated = false;
}

function shouldAnimate(pathname: string): boolean {
  if (entryPath === null) {
    entryPath = pathname;
    return false;
  }
  if (pathname !== entryPath) hasNavigated = true;
  // Once a visit has moved, every later arrival animates — including a return
  // to the page it started on.
  return hasNavigated;
}

export function RouteFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The key matters only if <MainLayout> ever moves into a route layout, where
  // this component would survive navigation instead of remounting with it.
  return (
    <div key={pathname} className={shouldAnimate(pathname) ? "u-route" : undefined}>
      {children}
    </div>
  );
}
