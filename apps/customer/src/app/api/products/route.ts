import { NextRequest, NextResponse } from "next/server";
import { db, listProducts } from "@avenick/database";
import type { ProductStatus } from "@avenick/database";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categorySlug = searchParams.get("categorySlug") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? (categorySlug ? (await db.category.findUnique({ where: { slug: categorySlug }, select: { id: true } }))?.id : undefined);
    const result = await listProducts({
      page: parseInt(searchParams.get("page") ?? "1"),
      limit: parseInt(searchParams.get("limit") ?? "24"),
      search: searchParams.get("search") ?? undefined,
      categoryId,
      categorySlug: categoryId ? undefined : categorySlug,
      status: "ACTIVE" as ProductStatus,
      b2c: searchParams.get("b2c") === "true" ? true : undefined,
      b2b: searchParams.get("b2b") === "true" ? true : undefined,
      inStock: searchParams.get("inStock") === "true",
      sort: searchParams.get("sort") === "name_asc" ? "name_asc" : "newest",
    });
    return NextResponse.json(
      { success: true, ...result },
      {
        // Public catalog: let Vercel's edge / shared caches serve this and
        // refresh in the background. s-maxage caches at the edge (not the
        // browser); stale-while-revalidate serves slightly-stale instantly
        // while revalidating — which also keeps browse working if the origin
        // briefly blips. Personalised/authed data must NOT use this.
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      },
    );
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to fetch products" }, { status: 500 });
  }
}
