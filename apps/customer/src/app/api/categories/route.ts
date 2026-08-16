import { NextResponse } from "next/server";
import { db } from "@avenick/database";

// Must not be statically executed at build time (no DB on build machines).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await db.category.findMany({
      where: {
        isActive: true,
        parentId: null,
        // Customer navigation must not advertise empty or draft-only
        // categories. Imported products live on the leaf category.
        OR: [
          { products: { some: { status: "ACTIVE", deletedAt: null, isPubliclyDiscoverable: true } } },
          { children: { some: {
            isActive: true,
            products: { some: { status: "ACTIVE", deletedAt: null, isPubliclyDiscoverable: true } },
          } } },
        ],
      },
      orderBy: { sortOrder: "asc" },
      include: {
        children: {
          where: {
            isActive: true,
            products: { some: { status: "ACTIVE", deletedAt: null, isPubliclyDiscoverable: true } },
          },
        },
      },
    });
    return NextResponse.json(
      { success: true, data: categories },
      // Category tree is very slow-changing; cache aggressively at the edge with
      // background revalidation. force-dynamic prevents build-time execution;
      // this header still lets shared/edge caches serve responses.
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
