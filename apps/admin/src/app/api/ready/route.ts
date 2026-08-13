import { NextResponse } from "next/server";
import { checkDatabaseHealth, dbCircuitState, getIntegrationRuntimeReadiness } from "@avenick/database";
import { readiness } from "@avenick/observability";

export const dynamic = "force-dynamic";

/**
 * Readiness probe: verifies critical dependencies (database) are reachable.
 * Runs inside a trace and emits a structured log + metric, so its own success
 * rate feeds the readiness-availability SLO. Returns 503 when a dependency is
 * down — the signal Render/Vercel and the external uptime monitor page on.
 */
export async function GET() {
  const { status, body } = await readiness(
    "admin",
    { database: () => checkDatabaseHealth(), integration: async () => ({ ...(await getIntegrationRuntimeReadiness()), latencyMs: 0 }) },
    { dbCircuit: dbCircuitState() },
  );
  return NextResponse.json(body, { status });
}
