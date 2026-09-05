import { NextResponse, type NextRequest } from "next/server";
import { readPublicCategoryTree } from "@/lib/public-category-tree";
import { catalogThrottle } from "@/lib/catalog-throttle";

// Must not be statically executed at build time (no DB on build machines).
export const dynamic = "force-dynamic";

/**
 * The public category tree, for real clients.
 *
 * The tree itself — and the reasoning behind the recursive query that builds it
 * — lives in @/lib/public-category-tree, because the server's own pages read it
 * directly rather than fetching this route. See that file for why.
 */
export async function GET(req: NextRequest) {
  try {
    const throttled = await catalogThrottle(req.headers);
    if (throttled) return throttled;

    return NextResponse.json(
      { success: true, data: await readPublicCategoryTree() },
      // Category tree is very slow-changing; cache aggressively at the edge with
      // background revalidation. force-dynamic prevents build-time execution;
      // this header still lets shared/edge caches serve responses.
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
