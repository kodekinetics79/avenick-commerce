import { NextResponse } from "next/server";
import { db } from "@avenick/database";
import { log } from "@avenick/observability";

// Catalogue data changes when a seller publishes, not when this app is built.
// /api/categories already declares this; without it a route handler can be
// evaluated once and serve a build-time snapshot, so a newly published listing
// would not appear until the next deploy. The Cache-Control header below still
// gives a CDN its own short window, which is where caching belongs.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const brands = await db.brand.findMany({
      where: { isActive: true },
      include: { _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } } },
      orderBy: { nameEn: "asc" },
    });

    return NextResponse.json(
      { success: true, data: brands },
      // Public, slow-changing catalog data — cache at the edge with background
      // revalidation. Brands change rarely, so a longer window is fine.
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    log.error("brands.list failed", error, { path: "/api/brands" });
    return NextResponse.json({ success: false, error: "Failed to load brands" }, { status: 500 });
  }
}
