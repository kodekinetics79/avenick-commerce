"use client";

import { useEffect, useRef } from "react";

/**
 * Emits one "this product was looked at" signal per page view.
 *
 * This is the ONLY input the Trending rail has. Without it ProductViewSignal
 * stays empty forever and getTrendingProducts correctly returns nothing — the
 * rail is not broken in that state, it is simply unfed.
 *
 * `sendBeacon` rather than `fetch`, because the browser owns the delivery: it
 * queues the request outside the page's lifetime, so a visitor who reads a spec
 * and immediately hits back still counts. A fetch from an unmounting component
 * is cancelled, and the views most worth counting — the quick look that bounces
 * — are exactly the ones that would be lost.
 *
 * It fires ONCE per mount, guarded by a ref rather than by the effect's
 * dependency list: React 18 Strict Mode runs effects twice in development, and
 * without the guard every developer page view would be counted twice while
 * production counted once. The server dedups too, on a different axis (one
 * count per client per product per day) — this guard is about not lying to
 * that fence, not a substitute for it.
 *
 * Nothing here can affect the page. No state, no render, no await, no error
 * path that surfaces: a failed signal is a missing row in an analytics table,
 * and a product page must never degrade for it.
 */
export function ViewBeacon({ productId }: { productId: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || !productId) return;
    sent.current = true;
    try {
      const body = JSON.stringify({ productId });
      // Blob, because sendBeacon sets the content type from it and the route
      // reads the body as text for exactly this reason.
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/signals/view", new Blob([body], { type: "application/json" }));
        return;
      }
      // Older browsers: keepalive gives fetch the same outlive-the-page
      // property. Failure is swallowed on purpose.
      void fetch("/api/signals/view", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    } catch {
      // A blocked beacon, a storage-partitioned context, a sandboxed iframe —
      // none of them are the product page's problem.
    }
  }, [productId]);

  return null;
}
