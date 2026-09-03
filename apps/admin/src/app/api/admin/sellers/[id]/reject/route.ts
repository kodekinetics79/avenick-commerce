import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { SellerNotPendingError, rejectSeller } from "@avenick/database";
import { log } from "@avenick/observability";
import { isRecordId } from "@avenick/utils";
import { z } from "zod";

// A rejection reason is written to the audit log and shown to the seller, so
// it must be a real sentence, not an empty string or an arbitrary payload.
const RejectSchema = z.object({ reason: z.string().trim().min(1).max(2000) });

/** The queue page was stale: the application was already decided, and nothing was written. */
const ALREADY_DECIDED = "This seller application was already decided — reload to see its current state.";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    if (!isRecordId(params.id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const parsed = RejectSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ success: false, error: "Reason required" }, { status: 400 });
    const seller = await rejectSeller(params.id, admin.userId, parsed.data.reason);
    return NextResponse.json({ success: true, data: seller });
  } catch (error) {
    // A stale-page refusal is an expected outcome, told apart from a failure so
    // the reviewer reloads instead of retrying a decision that cannot land.
    if (error instanceof SellerNotPendingError) {
      return NextResponse.json({ success: false, error: ALREADY_DECIDED, currentStatus: error.currentStatus }, { status: 409 });
    }
    if (error instanceof Error && error.message === "Seller not found") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    log.error("admin reject seller failed", error, { scope: "sellers.reject", sellerId: params.id });
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
