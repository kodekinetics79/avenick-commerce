import { NextResponse, type NextRequest } from "next/server";
import { db, Prisma } from "@avenick/database";
import { buildCategoryTree, type CategoryRow } from "@/lib/category-tree";
import { catalogThrottle } from "@/lib/catalog-throttle";

// Must not be statically executed at build time (no DB on build machines).
export const dynamic = "force-dynamic";

/**
 * The public category tree, to ANY depth.
 *
 * This route used to fetch `parentId: null` with a single level of `children`,
 * and its "has products" test looked exactly one level down. `Category` is a
 * self-referencing tree with no depth limit and `listProducts` already resolves
 * a category's whole subtree recursively, so the data and the product query
 * supported four levels while navigation could only ever show two — a
 * third-level category holding real listings was invisible, and so was every
 * product under it.
 *
 * Two passes instead of nested includes, because Prisma cannot express a
 * recursive include and the nesting depth would otherwise be a number typed
 * into this file:
 *
 *  1. `visible` — every active category that directly holds a discoverable
 *     product. Imported catalogues put products on the LEAF, so this is where
 *     the evidence lives.
 *  2. `keep` — those, plus every ancestor of one, walked upward. An ancestor
 *     is kept because it is a real path to something, not because it holds
 *     stock itself; without this a populated leaf would be unreachable, its
 *     parent having been judged empty.
 *
 * A category with no discoverable product anywhere beneath it is absent, which
 * is the same promise the previous version made and the reason it filtered at
 * all: navigation must not advertise a branch that dead-ends.
 *
 * `UNION` rather than `UNION ALL` in the recursive term dedups, so a malformed
 * parent chain that pointed at itself would terminate rather than spin.
 */
export async function GET(req: NextRequest) {
  try {
    const throttled = await catalogThrottle(req.headers);
    if (throttled) return throttled;

    const rows = await db.$queryRaw<CategoryRow[]>(Prisma.sql`
      WITH RECURSIVE visible AS (
        SELECT c."id", c."parentId"
        FROM "Category" c
        WHERE c."isActive" = true
          AND EXISTS (
            SELECT 1 FROM "Product" p
            WHERE p."categoryId" = c."id"
              AND p."status" = 'ACTIVE'
              AND p."deletedAt" IS NULL
              AND p."isPubliclyDiscoverable" = true
          )
      ),
      keep AS (
        SELECT v."id", v."parentId" FROM visible v
        UNION
        SELECT parent."id", parent."parentId"
        FROM "Category" parent
        INNER JOIN keep k ON k."parentId" = parent."id"
        WHERE parent."isActive" = true
      )
      SELECT c."id", c."slug", c."nameEn", c."nameAr", c."iconName", c."parentId", c."sortOrder"
      FROM "Category" c
      WHERE c."isActive" = true AND c."id" IN (SELECT "id" FROM keep)
      ORDER BY c."sortOrder" ASC, c."nameEn" ASC
    `);

    return NextResponse.json(
      { success: true, data: buildCategoryTree(rows) },
      // Category tree is very slow-changing; cache aggressively at the edge with
      // background revalidation. force-dynamic prevents build-time execution;
      // this header still lets shared/edge caches serve responses.
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
