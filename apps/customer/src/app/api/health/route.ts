import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe: the process is up and serving requests. No dependencies. */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "customer",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
