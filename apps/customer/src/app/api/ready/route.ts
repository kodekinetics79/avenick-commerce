import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@avenick/database";

export const dynamic = "force-dynamic";

/** Readiness probe: verifies critical dependencies (database) are reachable. */
export async function GET() {
  const dbHealth = await checkDatabaseHealth();
  const ready = dbHealth.ok;
  return NextResponse.json(
    {
      status: ready ? "ready" : "degraded",
      app: "customer",
      checks: { database: dbHealth },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
