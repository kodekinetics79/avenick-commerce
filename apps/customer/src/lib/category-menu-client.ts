"use client";

import * as React from "react";

/**
 * The top-level categories the header's Shop panel offers, fetched once per
 * page load.
 *
 * WHY THE HEADER FETCHES THIS ITSELF. For the same reason it fetches its
 * brands (see brand-menu-client.ts): MainLayout is rendered from client pages
 * too, so it cannot read the catalogue and hand the header a prop, and primary
 * navigation that has a category list on the home page and none on /cart
 * changes shape as you move through the site.
 *
 * WHAT IT READS. /api/categories answers with readPublicCategoryTree(), which
 * keeps only categories with a publicly discoverable product somewhere beneath
 * them. So a category cannot appear in this panel and then open an empty
 * shelf. Only the ROOTS are used: a panel is a shortcut into the tree, and the
 * catalogue's own filter rail walks the rest of it. The route's ordering
 * (sortOrder, then English name) is kept, because it is the order the owner
 * set.
 *
 * ONE REQUEST PER PAGE LOAD. The promise is cached in module scope, so a
 * client-side navigation reuses it. The route is also cached at the edge for
 * ten minutes with a one-hour stale-while-revalidate window.
 *
 * IT FAILS TO NOTHING. A rejected fetch, an error payload or an empty tree all
 * resolve to `[]`, and the header keeps the panel it had before categories
 * existed in it. Nothing here throws into the chrome.
 *
 * The names are printed exactly as the catalogue holds them. Where a
 * category's Arabic name is missing, the English one is shown rather than
 * nothing, which is the same rule the brands panel follows.
 */

export interface CategoryMenuEntry {
  slug: string;
  nameEn: string;
  nameAr: string | null;
}

let cached: Promise<CategoryMenuEntry[]> | null = null;

function load(): Promise<CategoryMenuEntry[]> {
  cached ??= fetch("/api/categories", { headers: { accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((body): CategoryMenuEntry[] => {
      const roots: unknown[] = body?.success === true && Array.isArray(body.data) ? body.data : [];
      return roots
        .map((node) => {
          const c = (node ?? {}) as Record<string, unknown>;
          return {
            slug: typeof c.slug === "string" ? c.slug : "",
            nameEn: typeof c.nameEn === "string" ? c.nameEn : "",
            nameAr: typeof c.nameAr === "string" && c.nameAr.trim() !== "" ? c.nameAr : null,
          };
        })
        .filter((c) => c.slug !== "" && c.nameEn !== "");
    })
    .catch(() => []);
  return cached;
}

/**
 * `limit` exists because a panel is a SHORTCUT, not the catalogue. The seven
 * roots production has today all fit; a tree that grows past the limit keeps
 * every root reachable from "Products" in the same panel and from the
 * catalogue's filter rail.
 */
export function useCategoryMenu(limit = 8): CategoryMenuEntry[] {
  const [categories, setCategories] = React.useState<CategoryMenuEntry[]>([]);

  React.useEffect(() => {
    let alive = true;
    load().then((rows) => {
      if (alive) setCategories(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  return React.useMemo(() => categories.slice(0, limit), [categories, limit]);
}
