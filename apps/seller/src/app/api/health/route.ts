import { NextResponse } from "next/server";
import { liveness } from "@avenick/observability";

export const dynamic = "force-dynamic";

/** Liveness probe: the process is up and serving requests. No dependencies. */
export async function GET() {
  const { status, body } = liveness("seller");
  return NextResponse.json(body, { status });
}
