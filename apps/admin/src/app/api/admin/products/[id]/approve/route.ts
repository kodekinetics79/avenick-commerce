import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { ProductNotPendingError, approveProduct } from "@avenick/database";
import { log } from "@avenick/observability";
import { isRecordId } from "@avenick/utils";

/** The page was stale: the listing was already decided, withdrawn or suppressed, and nothing was written. */
const ALREADY_DECIDED = "This product was already decided — reload to see its current state.";

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    if (!isRecordId(params.id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const product = await approveProduct(params.id, admin.userId);
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
    log.error("admin approve product failed", error, { scope: "products.approve", productId: params.id });
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

// Allow GET for form action
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  return PUT(req, ctx);
}
