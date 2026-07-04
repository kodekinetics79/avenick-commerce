import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { exportUserData } from "@avenick/database";
import { log } from "@avenick/observability";

export const dynamic = "force-dynamic";

/**
 * GDPR/PDPL right-to-access: a signed-in customer downloads everything we hold
 * about them. Self-service — the subject is the actor. Returns a JSON document
 * as a file attachment.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }
  try {
    const data = await exportUserData(session.user.id, session.user.id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="avenick-data-export-${session.user.id}.json"`,
        // Never let an intermediary cache a personal-data export.
        "Cache-Control": "no-store, private",
      },
    });
  } catch (e) {
    log.error("data-export failed", e, { path: "/api/account/data-export" });
    return NextResponse.json({ success: false, error: "Export failed" }, { status: 500 });
  }
}
