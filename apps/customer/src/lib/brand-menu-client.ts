"use client";

import * as React from "react";

/**
 * The brands the header's panel offers, fetched once per page load.
 *
 * WHY THE HEADER FETCHES THIS INSTEAD OF BEING HANDED IT. MainLayout's own
 * docstring explains the constraint: it is rendered from client pages too —
 * /products/[slug], /cart, /checkout and /wishlist all carry "use client" — so
 * it cannot be an async server component and cannot read the catalogue. The
 * discovery panel works around that by taking a prop that only server pages can
 * supply, and it degrades to nothing everywhere else.
 *
 * That trade is fine for a discovery panel and WRONG for primary navigation. A
 * "Brands" item that opens a panel on the home page and is a bare link on /cart
 * is not a degraded panel, it is navigation that changes shape as you move
 * through the site — the user cannot learn it, and the one place they last saw
 * it is the place it is missing.
 *
 * So the header asks for the data itself, on every route, and gets the same
 * answer everywhere.
 *
 * ONE REQUEST PER PAGE LOAD, NOT PER ROUTE. The promise is cached in module
 * scope, so a client-side navigation reuses the resolved value rather than
 * re-fetching a list that changes when a seller publishes, not when someone
 * clicks. /api/brands is additionally cached at the edge for five minutes with
 * a one-hour stale-while-revalidate window, so the request is cheap even on a
 * cold load.
 *
 * IT FAILS TO NOTHING. A rejected fetch, an error payload or an empty list all
 * resolve to `[]`, and the header renders the plain link it renders today. The
 * panel is progressive enhancement over a destination that already works — with
 * JavaScript off, /brands is still one click away, which is exactly what the
 * MegaMenu contract already assumes ("the trigger is a real link, so the panel
 * is never the only way to reach the section").
 */

export interface BrandMenuEntry {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  count: number;
}

let cached: Promise<BrandMenuEntry[]> | null = null;

function load(): Promise<BrandMenuEntry[]> {
  cached ??= fetch("/api/brands", { headers: { accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((body): BrandMenuEntry[] => {
      const rows = body?.success === true && Array.isArray(body.data) ? body.data : [];
      return rows
        .map((b: Record<string, unknown>) => ({
          slug: String(b.slug ?? ""),
          nameEn: String(b.nameEn ?? ""),
          nameAr: typeof b.nameAr === "string" ? b.nameAr : null,
          count: Number((b as { _count?: { products?: number } })._count?.products ?? 0),
        }))
        .filter((b: BrandMenuEntry) => b.slug !== "" && b.nameEn !== "" && b.count > 0);
    })
    .catch(() => []);
  return cached;
}

/**
 * `limit` exists because a panel is a SHORTCUT, not the catalogue.
 *
 * readPublicBrands() orders by nameEn ascending, which is right for a page you
 * scan and wrong for a menu you glance at: it puts "39199000" — an HS customs
 * code sitting in the brand table with 7 real listings behind it — at the top,
 * above every name a buyer would recognise. Ordering the panel by how much each
 * brand actually has to sell is a real rule rather than a way of hiding that
 * row, and /brands still lists every one of them, from the last link in the
 * panel and from the Shop panel beside it.
 */
export function useBrandMenu(limit = 6): BrandMenuEntry[] {
  const [brands, setBrands] = React.useState<BrandMenuEntry[]>([]);

  React.useEffect(() => {
    let alive = true;
    load().then((rows) => {
      if (alive) setBrands(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  return React.useMemo(
    () => [...brands].sort((a, b) => b.count - a.count).slice(0, limit),
    [brands, limit],
  );
}
