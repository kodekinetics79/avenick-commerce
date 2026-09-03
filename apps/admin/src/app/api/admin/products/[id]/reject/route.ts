import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { ProductNotPendingError, rejectProduct } from "@avenick/database";
import { log } from "@avenick/observability";
import { isRecordId } from "@avenick/utils";
import { z } from "zod";

// A rejection reason is written to the audit log and opens the seller-facing
// issue, so it must be a real sentence, not an empty string or an arbitrary
// payload.
const RejectSchema = z.object({ reason: z.string().trim().min(1).max(2000) });

/** The page was stale: the listing was already decided, withdrawn or suppressed, and nothing was written. */
const ALREADY_DECIDED = "This product was already decided — reload to see its current state.";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    if (!isRecordId(params.id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const parsed = RejectSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ success: false, error: "Reason required" }, { status: 400 });
    const product = await rejectProduct(params.id, admin.userId, parsed.data.reason);
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    // A stale-page refusal is an expected outcome, told apart from a failure
    // so the caller can reload instead of retrying a decision that cannot land.
    if (error instanceof ProductNotPendingError) {
      return NextResponse.json({ success: false, error: ALREADY_DECIDED, currentStatus: error.currentStatus }, { status: 409 });
    }
    // The service reports a missing (or soft-deleted) listing by message; it
    // is the caller's stale reference, not a platform failure.
    if (error instanceof Error && error.message === "Product not found") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    log.error("admin reject product failed", error, { scope: "products.reject", productId: params.id });
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

// Allow POST for form action
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  return PUT(req, ctx);
}
