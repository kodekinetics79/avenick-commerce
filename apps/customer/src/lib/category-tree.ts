export interface CategoryRow {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  iconName: string | null;
  parentId: string | null;
  sortOrder: number;
}

export interface CategoryNode extends Omit<CategoryRow, "sortOrder"> {
  children: CategoryNode[];
}

/**
 * Flat category rows to a nested tree of ANY depth, preserving the query's
 * ordering at every level.
 *
 * It lives here rather than beside the route because a Next.js route module may
 * only export handlers — exporting a helper from one fails the build with a
 * type error naming an index signature, which is a confusing way to be told
 * "put this in a library". Being a library also means it can be tested without
 * a database, which matters more: the tree is what navigation is drawn from.
 *
 * A row whose parent is absent from the set is treated as a ROOT rather than
 * dropped. Dropping it is the worse failure of the two — an odd position in the
 * menu is visible and fixable, while a missing branch looks exactly like a
 * catalogue that does not stock the thing.
 */
export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const { sortOrder: _sortOrder, ...row } of rows) {
    byId.set(row.id, { ...row, children: [] });
  }
  const roots: CategoryNode[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const node = byId.get(row.id)!;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const parent = row.parentId && row.parentId !== row.id ? byId.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/**
 * The ancestor chain for a slug, root first, INCLUDING the slug itself.
 *
 * Breadcrumbs on a category page were hardcoded to "All products › this one",
 * so a third-level category showed no path back to its grandparent — the trail
 * a buyer needs most is the one a deep catalogue makes longest.
 *
 * Returns an empty array when the slug is not in the tree, so a caller renders
 * no trail rather than a wrong one.
 */
export function categoryTrail(nodes: CategoryNode[], slug: string): CategoryNode[] {
  for (const node of nodes) {
    if (node.slug === slug) return [node];
    const deeper = categoryTrail(node.children, slug);
    if (deeper.length > 0) return [node, ...deeper];
  }
  return [];
}

/**
 * Find a category anywhere in the tree, at any depth.
 *
 * The category page used `categories.find(c => c.slug === slug)`, which
 * searches ROOTS ONLY — so every subcategory page in the storefront rendered
 * the not-found body, and the category rail and every `/categories/<child>`
 * link in the product data pointed at one. It looked like a routing problem and
 * it was a one-level search against a tree.
 */
export function findCategory(nodes: CategoryNode[], slug: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const deeper = findCategory(node.children, slug);
    if (deeper) return deeper;
  }
  return undefined;
}
