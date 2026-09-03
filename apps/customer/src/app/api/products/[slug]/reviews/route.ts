import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth-instance";
import {
  db,
  createProductReview,
  normalizeReviewText,
  ProductReviewError,
  REVIEW_BODY_MAX_LENGTH,
  REVIEW_BODY_MIN_LENGTH,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  REVIEW_TITLE_MAX_LENGTH,
} from "@avenick/database";
import { checkRateLimit, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";

/**
 * POST /api/products/[slug]/reviews — write a verified-purchase review.
 *
 * The middleware leaves everything under /api/products public so the catalog
 * can be browsed anonymously; this handler therefore does its own
 * authentication. Authority is re-established inside createProductReview
 * (active account, active product, delivered order for this product) — the
 * session only tells us who is asking.
 */

const SlugSchema = z.string().trim().min(1).max(200);

// Optional text: strip control characters first, then apply the bounds to
// what is left, so whitespace alone cannot satisfy a minimum length.
const optionalText = (max: number, min = 0) => z
  .string()
  .max(max * 4) // hard ceiling before normalisation; the real bound is applied below
  .transform((value) => normalizeReviewText(value))
  .pipe(z.string().min(min).max(max).nullable())
  .optional();

const ReviewSchema = z.object({
  rating: z.number().int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
  title: optionalText(REVIEW_TITLE_MAX_LENGTH),
  body: optionalText(REVIEW_BODY_MAX_LENGTH, REVIEW_BODY_MIN_LENGTH),
});

const STATUS_FOR_CODE: Record<ProductReviewError["code"], number> = {
  INVALID_INPUT: 400,
  ACCOUNT_INACTIVE: 403,
  NOT_ELIGIBLE: 403,
  PRODUCT_NOT_FOUND: 404,
  ALREADY_REVIEWED: 409,
};

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await auth();
    const userId = session?.user?.id as string | undefined;
    if (!userId) return NextResponse.json({ success: false, error: "Please sign in to write a review." }, { status: 401 });

    const rl = await checkRateLimit(RATE_LIMITS.reviewSubmit, userId);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many review submissions. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const slug = SlugSchema.safeParse(params.slug);
    if (!slug.success) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }
    const parsed = ReviewSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid review" },
        { status: 400 },
      );
    }

    // Slug to id here; the service re-reads the product inside its transaction
    // and applies the ACTIVE / not-deleted rule again before writing.
    const product = await db.product.findFirst({
      where: { slug: slug.data, deletedAt: null, status: "ACTIVE" },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });

    const review = await createProductReview({
      productId: product.id,
      userId,
      rating: parsed.data.rating,
      title: parsed.data.title ?? null,
      body: parsed.data.body ?? null,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: review.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        isVerified: review.isVerified,
        createdAt: review.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductReviewError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: STATUS_FOR_CODE[error.code] });
    }
    log.error("product review create failed", error, { path: "/api/products/[slug]/reviews" });
    return NextResponse.json({ success: false, error: "Failed to submit review" }, { status: 500 });
  }
}
