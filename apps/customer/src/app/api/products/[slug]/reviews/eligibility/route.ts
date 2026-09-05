import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth-instance";
import { db, getReviewEligibility, type ReviewEligibility } from "@avenick/database";
import { log } from "@avenick/observability";
import { catalogThrottle } from "@/lib/catalog-throttle";

/**
 * GET /api/products/[slug]/reviews/eligibility
 *
 * Tells the product page which review affordance to show:
 *   { eligible: false, reason: "anonymous" }        -> sign-in link
 *   { eligible: false, reason: "not-purchased" }    -> "Only buyers who received this product can review it."
 *   { eligible: false, reason: "already-reviewed" } -> nothing to add
 *   { eligible: true,  reason: "ok" }               -> the form
 *
 * Advisory only: the POST re-checks every rule inside its own transaction.
 * The route sits under the public /api/products prefix, so anonymous requests
 * reach it by design and are answered honestly rather than with a 401.
 */

const SlugSchema = z.string().trim().min(1).max(200);
const NO_STORE = { "Cache-Control": "private, no-store" };

function respond(data: ReviewEligibility) {
  return NextResponse.json({ success: true, data }, { headers: NO_STORE });
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const throttled = await catalogThrottle(req.headers);
    if (throttled) return throttled;

    const slug = SlugSchema.safeParse(params.slug);
    if (!slug.success) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404, headers: NO_STORE });

    const product = await db.product.findFirst({
      where: { slug: slug.data, deletedAt: null, status: "ACTIVE" },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404, headers: NO_STORE });

    const session = await auth();
    const userId = session?.user?.id as string | undefined;
    if (!userId) return respond({ eligible: false, reason: "anonymous" });

    // The session is a claim about who is asking; the account's current
    // standing comes from the database. A suspended buyer is told so rather
    // than being shown a form the POST would reject.
    const user = await db.user.findUnique({ where: { id: userId }, select: { status: true, deletedAt: true } });
    if (!user || user.status !== "ACTIVE" || user.deletedAt) {
      return NextResponse.json({ success: false, error: "An active account is required to write a review." }, { status: 403, headers: NO_STORE });
    }

    return respond(await getReviewEligibility({ userId, productId: product.id }));
  } catch (error) {
    log.error("review eligibility failed", error, { path: "/api/products/[slug]/reviews/eligibility" });
    return NextResponse.json({ success: false, error: "Failed to check review eligibility" }, { status: 500, headers: NO_STORE });
  }
}
