import type { z } from "zod";

import type { CategorySchema } from "@avenick/contracts";
import type { Prisma } from "@avenick/database";
import { PUBLIC_CATALOG_SELLER, db } from "@avenick/database";

import { toImage } from "../_lib/dto";

type Category = z.infer<typeof CategorySchema>;

/**
 * The category tree, FLAT.
 *
 * `/api/categories` answers with a nested tree of unbounded depth. That is a
 * recursive schema, which OpenAPI 3.1 can express but most Dart generators
 * flatten badly or refuse outright — and the app has to index the tree by id to
 * resolve a slug anyway. So the contract asks for the same information as an
 * ordered flat list with `parentId` and `depth`, which every generator handles
 * and which the client rebuilds in one pass.
 *
 * The rows are emitted DEPTH-FIRST, so a client that only wants to indent can
 * render the array in order without building anything at all.
 */

/**
 * A product a category may advertise.
 *
 * `status`, `deletedAt` and `isPubliclyDiscoverable` are the three the existing
 * `/api/categories` tests, plus the seller predicate it does NOT apply. That
 * addition is deliberate: `PUBLIC_CATALOG_SELLER` is the rule the product
 * listing and the product detail are both filtered by, so without it a menu can
 * advertise a branch whose only products sit behind a withdrawn seller and are
 * therefore unreachable from the very listing the menu links to.
 *
 * The channel flags are NOT applied: `GET /v1/categories` takes no channel, and
 * a menu is navigation rather than a priced listing.
 */
const DISCOVERABLE_PRODUCT: Prisma.ProductWhereInput = {
  status: "ACTIVE",
  deletedAt: null,
  isPubliclyDiscoverable: true,
  seller: PUBLIC_CATALOG_SELLER,
};

interface CategoryRow {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  parentId: string | null;
  imageUrl: string | null;
}

/**
 * The contract caps the list at 2000 and `depth` at 16. Both are read as
 * guards rather than expectations: a tree that exceeds either is malformed
 * (a cycle, or an import gone wrong), and the guards below stop it becoming an
 * unbounded walk on a public route.
 */
const MAX_DEPTH = 16;
const MAX_CATEGORIES = 2000;

async function activeCategories(): Promise<CategoryRow[]> {
  return db.category.findMany({
    where: { isActive: true },
    // The order the storefront already sorts a menu by, preserved at every
    // level by the depth-first walk below.
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    select: { id: true, slug: true, nameEn: true, nameAr: true, parentId: true, imageUrl: true },
    take: MAX_CATEGORIES,
  });
}

function childrenOf(rows: CategoryRow[]): Map<string | null, CategoryRow[]> {
  const byParent = new Map<string | null, CategoryRow[]>();
  const present = new Set(rows.map((row) => row.id));
  for (const row of rows) {
    // A row whose parent is inactive (and so absent here) is treated as a ROOT
    // rather than dropped. Dropping it is the worse failure of the two: an odd
    // position in the menu is visible and fixable, while a missing branch looks
    // exactly like a catalogue that does not stock the thing.
    const parent = row.parentId && row.parentId !== row.id && present.has(row.parentId) ? row.parentId : null;
    const siblings = byParent.get(parent);
    if (siblings) siblings.push(row);
    else byParent.set(parent, [row]);
  }
  return byParent;
}

/**
 * Every active category at or beneath `slug`.
 *
 * An unknown or inactive slug yields an EMPTY array, which a caller splices in
 * as `categoryId: { in: [] }` — a predicate that matches nothing. That is the
 * right answer to "products in a category that does not exist", and it is not
 * the same as omitting the filter, which would answer with the whole catalogue.
 */
export async function activeCategorySubtreeIds(slug: string): Promise<string[]> {
  const rows = await activeCategories();
  const root = rows.find((row) => row.slug === slug);
  if (!root) return [];

  const byParent = childrenOf(rows);
  const ids: string[] = [];
  const seen = new Set<string>();
  const walk = (node: CategoryRow, depth: number) => {
    if (depth > MAX_DEPTH || seen.has(node.id)) return;
    seen.add(node.id);
    ids.push(node.id);
    for (const child of byParent.get(node.id) ?? []) walk(child, depth + 1);
  };
  walk(root, 0);
  return ids;
}

/**
 * The whole visible tree, flattened, with a subtree product count per node.
 *
 * The count is over EVERYTHING BENEATH the node, not on it. Imported catalogues
 * attach products to the leaf, so a direct count reads zero for every branch —
 * and a menu that says "0" beside a category holding four hundred products is
 * worse than no number at all.
 *
 * A branch with nothing discoverable anywhere beneath it is omitted, which is
 * the same promise `/api/categories` makes: navigation must not advertise a
 * path that dead-ends.
 */
export async function readCategoryList(origin: string): Promise<Category[]> {
  const [rows, counts] = await Promise.all([
    activeCategories(),
    db.product.groupBy({
      by: ["categoryId"],
      where: DISCOVERABLE_PRODUCT,
      _count: { _all: true },
    }),
  ]);

  const direct = new Map(counts.map((group) => [group.categoryId, group._count._all]));
  const byParent = childrenOf(rows);

  // Subtree totals, computed bottom-up in one memoised walk rather than by
  // re-walking the tree once per node.
  const subtotal = new Map<string, number>();
  const resolving = new Set<string>();
  const totalOf = (node: CategoryRow, depth: number): number => {
    const cached = subtotal.get(node.id);
    if (cached !== undefined) return cached;
    // A cycle would otherwise recurse forever on a public route.
    if (depth > MAX_DEPTH || resolving.has(node.id)) return direct.get(node.id) ?? 0;
    resolving.add(node.id);
    let total = direct.get(node.id) ?? 0;
    for (const child of byParent.get(node.id) ?? []) total += totalOf(child, depth + 1);
    resolving.delete(node.id);
    subtotal.set(node.id, total);
    return total;
  };

  const flattened: Category[] = [];
  const emitted = new Set<string>();
  const emit = (node: CategoryRow, parentId: string | null, depth: number) => {
    if (depth > MAX_DEPTH || emitted.has(node.id) || flattened.length >= MAX_CATEGORIES) return;
    const productCount = totalOf(node, depth);
    if (productCount === 0) return;
    emitted.add(node.id);
    flattened.push({
      id: node.id,
      slug: node.slug,
      nameEn: node.nameEn,
      nameAr: node.nameAr,
      parentId,
      depth,
      image: toImage({ url: node.imageUrl, alt: node.nameEn }, origin),
      productCount,
    });
    for (const child of byParent.get(node.id) ?? []) emit(child, node.id, depth + 1);
  };

  for (const root of byParent.get(null) ?? []) emit(root, null, 0);
  return flattened;
}
