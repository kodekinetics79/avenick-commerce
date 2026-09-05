"use client";

import * as React from "react";
import { useCartStore } from "@/stores/cart";
import { useCartDrawerStore } from "./cart-drawer-store";
import type { CartCompletionsLoader } from "./completions";

/**
 * Feed the recommendation slots from a loader, when one is given.
 *
 * The cart lives in this browser, so no server component can know its product
 * ids at render time; the only honest source of completions is a client fetch
 * to a route that calls `getCartCompletions` on the server. This hook is that
 * fetch's lifecycle and nothing more: it runs when the set of products in the
 * cart changes and the slots are actually visible (`active`), it never runs for
 * an empty cart, it ignores a response that arrives after the cart has moved
 * on, and a failure leaves the slots absent rather than throwing — a
 * suggestion is a convenience, and a convenience that can take the page down
 * is a defect.
 *
 * Without a loader it does nothing at all, and rows can still be supplied as
 * props or written with `useCartDrawerStore.getState().setCompletions`.
 */
export function useCartCompletions(loader: CartCompletionsLoader | undefined, active: boolean) {
  const items = useCartStore((s) => s.items);
  const setCompletions = useCartDrawerStore((s) => s.setCompletions);
  // One string per distinct cart composition, so the effect keys on WHAT is in
  // the cart rather than on the array identity that changes on every quantity
  // edit.
  const key = React.useMemo(
    () => [...new Set(items.map((item) => item.productId))].sort().join("\n"),
    [items],
  );
  const requested = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!loader || !active) return;
    if (requested.current === key) return;
    requested.current = key;
    if (key === "") {
      setCompletions([]);
      return;
    }
    let stale = false;
    loader(key.split("\n"))
      .then((rows) => {
        if (!stale) setCompletions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!stale) setCompletions([]);
      });
    return () => {
      stale = true;
    };
  }, [loader, active, key, setCompletions]);
}
