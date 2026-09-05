"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  emptyHistory,
  recordCategoryVisit,
  recordSearch,
  recordView,
  VISIT_DEBOUNCE_MS,
  type DiscoveryHistory,
  type NamePair,
  type ViewedProduct,
} from "./interest-signals";
import {
  browserStorage,
  clearHistory,
  readDismissedAt,
  readHistory,
  writeDismissedAt,
  writeHistory,
} from "./history-storage";

/**
 * THE RECORDER — how the panel learns anything, and what it refuses to learn.
 *
 * The storefront's product page is a client component that fetches its own row,
 * and it belongs to another track. So the recorder does not sit inside it and
 * does not read its markup: scraping a heading or a breadcrumb couples this
 * feature to somebody else's JSX, and in this repo that is exactly the coupling
 * that keeps breaking on redesigns which IMPROVE the thing being read.
 *
 * Instead the recorder watches the ROUTE — a contract that is stable because it
 * is the site's own URL scheme — and resolves a product slug through the public
 * catalogue endpoint the product page has itself just called. The request is
 * issued `force-cache`, so in the ordinary case the browser answers it from the
 * copy it already holds and no second round trip happens at all. If it fails,
 * 404s, or returns a shape we do not recognise, NOTHING is recorded. A trail is
 * only worth having if every row in it is true.
 *
 * WHAT IS RECORDED
 *   · /products/<slug>            a product view, after a dwell (see DWELL_MS)
 *   · /products?category=<slug>   a category browse
 *   · /categories/<slug>          a category browse
 *   · /products?search=… , /search?q=…   the visitor's own search term
 *
 * WHAT IS NOT
 *   No identifier, no account, no cart, no order, no price, no IP, no
 *   fingerprint, and nothing at all from /account, /checkout or /orders. The
 *   product request is sent with `credentials: "omit"`, so it does not even
 *   carry the session cookie.
 */

/**
 * How long a product page must be on screen before it counts as interest.
 *
 * A bounce is not a signal. Without this, a mis-click on a grid tile would
 * outrank a product the visitor actually studied, and the panel would recommend
 * the mistake back to them.
 */
export const DWELL_MS = 1500;

const PRODUCT_ROUTE = /^\/products\/([^/]+)\/?$/;
const CATEGORY_ROUTE = /^\/categories\/([^/]+)\/?$/;

/* ── The public seam ─────────────────────────────────────────────────────────
   Any surface that ALREADY holds a catalogue row can record a richer view than
   the recorder can reconstruct — in particular a `category`, which the public
   product endpoint does not project. One call is all it takes, and the planner
   will report the stronger basis ("3 of the products you opened are in Wiring
   Devices") instead of the weaker one. Nothing depends on this being wired.  */

type ViewInput = Omit<ViewedProduct, "at"> & { at?: number };

const listeners = new Set<(history: DiscoveryHistory) => void>();

function commit(next: DiscoveryHistory) {
  writeHistory(browserStorage(), next);
  for (const listener of listeners) listener(next);
}

/** Record a product view from a caller that already has the row. */
export function recordProductView(view: ViewInput): void {
  const now = view.at ?? Date.now();
  const storage = browserStorage();
  commit(recordView(readHistory(storage, now), { ...view, at: now }, now));
}

/* ── Catalogue labels ────────────────────────────────────────────────────────
   Two small, edge-cached public reads, fetched lazily and at most once per page
   load, and only when there is a signal that would use them. They are what let
   the panel say "Wiring Devices" instead of "wiring-devices", and what let it
   build a brand link on the catalogue's own `?brand=<slug>` filter rather than
   on a search string that may or may not match. Without them, the panel simply
   offers fewer blocks — see buildDiscoveryPlan, which drops anything it cannot
   name.                                                                      */

let categoryNamesCache: Record<string, NamePair> | null = null;
let brandSlugsCache: Record<string, string> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function fetchCategoryNames(): Promise<Record<string, NamePair>> {
  if (categoryNamesCache) return categoryNamesCache;
  const names: Record<string, NamePair> = {};
  try {
    const response = await fetch("/api/categories", { cache: "force-cache", credentials: "omit" });
    const payload: unknown = await response.json();
    const rows = isRecord(payload) && Array.isArray(payload["data"]) ? (payload["data"] as unknown[]) : [];
    const walk = (row: unknown) => {
      if (!isRecord(row)) return;
      const slug = row["slug"];
      const nameEn = row["nameEn"];
      if (typeof slug === "string" && slug && typeof nameEn === "string" && nameEn) {
        names[slug] = { en: nameEn, ar: typeof row["nameAr"] === "string" ? (row["nameAr"] as string) : null };
      }
      if (Array.isArray(row["children"])) for (const child of row["children"] as unknown[]) walk(child);
    };
    for (const row of rows) walk(row);
  } catch {
    /* An unreachable category tree means unnamed categories, which means no
       category block. It is never a reason to print a slug at a buyer. */
  }
  categoryNamesCache = names;
  return names;
}

async function fetchBrandSlugs(): Promise<Record<string, string>> {
  if (brandSlugsCache) return brandSlugsCache;
  const slugs: Record<string, string> = {};
  try {
    const response = await fetch("/api/brands", { cache: "force-cache", credentials: "omit" });
    const payload: unknown = await response.json();
    const rows = isRecord(payload) && Array.isArray(payload["data"]) ? (payload["data"] as unknown[]) : [];
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const slug = row["slug"];
      const nameEn = row["nameEn"];
      if (typeof slug === "string" && slug && typeof nameEn === "string" && nameEn) {
        slugs[nameEn.trim().toLowerCase()] = slug;
      }
    }
  } catch {
    /* Same rule: a brand we cannot resolve to a catalogue filter is a brand the
       panel does not offer a link to. */
  }
  brandSlugsCache = slugs;
  return slugs;
}

/**
 * Resolves the display names and filter slugs the planner needs, once, and only
 * once the caller says it needs them — which the panel does when it is opened,
 * not when the page loads.
 */
export function useCatalogueLabels(enabled: boolean) {
  const [labels, setLabels] = React.useState<{
    categoryNames: Record<string, NamePair>;
    brandSlugs: Record<string, string>;
  }>({ categoryNames: categoryNamesCache ?? {}, brandSlugs: brandSlugsCache ?? {} });

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void Promise.all([fetchCategoryNames(), fetchBrandSlugs()]).then(([categoryNames, brandSlugs]) => {
      if (!cancelled) setLabels({ categoryNames, brandSlugs });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return labels;
}

/* ── The hook ────────────────────────────────────────────────────────────── */

export interface DiscoverySignals {
  /** False until localStorage has been read. Nothing renders before this. */
  ready: boolean;
  history: DiscoveryHistory;
  /** Erase the trail. Visible in the panel, and it removes the key outright. */
  clear: () => void;
  dismissedAt: number | null;
  dismiss: () => void;
}

export function useDiscoverySignals(): DiscoverySignals {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [ready, setReady] = React.useState(false);
  const [history, setHistory] = React.useState<DiscoveryHistory>(emptyHistory);
  const [dismissedAt, setDismissedAt] = React.useState<number | null>(null);
  // When each slug was last written, so React's development double effect and a
  // re-render on a query change cannot log the same view twice — while a genuine
  // return to a product later in the session still counts.
  const recordedAt = React.useRef(new Map<string, number>());

  React.useEffect(() => {
    const storage = browserStorage();
    setHistory(readHistory(storage, Date.now()));
    setDismissedAt(readDismissedAt(storage));
    setReady(true);
    const listener = (next: DiscoveryHistory) => setHistory(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Category and search signals: both are already in the URL, so they cost
  // nothing to record and can never be wrong about what the visitor did.
  React.useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(search);
    const categorySlug =
      CATEGORY_ROUTE.exec(pathname ?? "")?.[1] ??
      (pathname === "/products" ? params.get("category") : null);
    const term = pathname === "/search" ? params.get("q") : pathname === "/products" ? params.get("search") : null;
    if (!categorySlug && !term) return;
    const now = Date.now();
    const storage = browserStorage();
    const before = readHistory(storage, now);
    let next = before;
    if (categorySlug) next = recordCategoryVisit(next, decodeURIComponent(categorySlug), now);
    if (term) next = recordSearch(next, term, now);
    // The recorders return the SAME object when a signal is debounced away.
    // Writing it back would be a pointless localStorage round trip on every
    // page of a paginated category.
    if (next !== before) commit(next);
  }, [ready, pathname, search]);

  // Product views: dwell first, then resolve the slug against the public
  // catalogue endpoint. The timer is cleared by the route change itself, so a
  // visitor who bounces leaves no trace.
  React.useEffect(() => {
    if (!ready) return;
    const slug = PRODUCT_ROUTE.exec(pathname ?? "")?.[1];
    if (!slug) return;
    const last = recordedAt.current.get(slug);
    if (last !== undefined && Date.now() - last < VISIT_DEBOUNCE_MS) return;
    const timer = setTimeout(() => {
      recordedAt.current.set(slug, Date.now());
      void resolveAndRecord(slug).catch(() => {
        // A view we cannot verify is a view we do not store. Let a later visit
        // try again rather than blacklisting the slug for the session.
        recordedAt.current.delete(slug);
      });
    }, DWELL_MS);
    return () => clearTimeout(timer);
  }, [ready, pathname]);

  const clear = React.useCallback(() => {
    clearHistory(browserStorage());
    recordedAt.current.clear();
    const next = emptyHistory();
    setHistory(next);
    for (const listener of listeners) listener(next);
  }, []);

  const dismiss = React.useCallback(() => {
    const now = Date.now();
    writeDismissedAt(browserStorage(), now);
    setDismissedAt(now);
  }, []);

  return { ready, history, clear, dismissedAt, dismiss };
}

/**
 * Turn a slug into a recorded view, or record nothing.
 *
 * The public detail projection carries no category — see
 * apps/customer/src/lib/catalog-detail-dto.ts — so `category` is null here and
 * the planner says "you browsed X" rather than "the products you opened are in
 * X". It reports the basis it actually has.
 */
async function resolveAndRecord(slug: string): Promise<void> {
  const response = await fetch(`/api/products/${encodeURIComponent(slug)}`, {
    cache: "force-cache",
    credentials: "omit",
  });
  if (!response.ok) return;
  const payload: unknown = await response.json();
  const row = isRecord(payload) ? payload["data"] : null;
  if (!isRecord(row)) return;
  const id = row["id"];
  const nameEn = row["nameEn"];
  if (typeof id !== "string" || !id || typeof nameEn !== "string" || !nameEn) return;

  const images = Array.isArray(row["images"]) ? (row["images"] as unknown[]) : [];
  const primary = images.find((image) => isRecord(image) && image["isPrimary"] === true) ?? images[0];
  const brand = isRecord(row["brand"]) ? (row["brand"] as Record<string, unknown>) : null;

  recordProductView({
    id,
    slug: typeof row["slug"] === "string" && row["slug"] ? (row["slug"] as string) : slug,
    name: { en: nameEn, ar: typeof row["nameAr"] === "string" ? (row["nameAr"] as string) : null },
    imageUrl: isRecord(primary) && typeof primary["url"] === "string" ? (primary["url"] as string) : null,
    sku: typeof row["sku"] === "string" ? (row["sku"] as string) : null,
    brand:
      brand && typeof brand["nameEn"] === "string" && brand["nameEn"]
        ? { en: brand["nameEn"] as string, ar: typeof brand["nameAr"] === "string" ? (brand["nameAr"] as string) : null }
        : null,
    category: null,
  });
}
