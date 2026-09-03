import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { DocumentNotPendingError, reviewDocument } from "@avenick/database";
import { log } from "@avenick/observability";
import { isRecordId } from "@avenick/utils";

/** The page was stale: the row was already decided or replaced by a newer upload, and nothing was written. */
const ALREADY_DECIDED = "This item was already decided — reload to see its current state.";

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    if (!isRecordId(params.id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const doc = await reviewDocument(params.id, "APPROVED", admin.userId);
    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    // A stale-page refusal is an expected outcome, told apart from a failure
    // so the caller can reload instead of retrying a decision that cannot land.
    if (error instanceof DocumentNotPendingError) {
      return NextResponse.json({ success: false, error: ALREADY_DECIDED, currentStatus: error.currentStatus }, { status: 409 });
    }
    // The service reports a missing row by message; it is the caller's stale
    // reference, not a platform failure.
    if (error instanceof Error && error.message === "Seller document not found") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    log.error("admin approve document failed", error, { scope: "compliance.approve", documentId: params.id });
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
