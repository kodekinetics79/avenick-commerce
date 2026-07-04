import { NextResponse } from "next/server";
import { checkDatabaseHealth, dbCircuitState } from "@avenick/database";
import { statusSummary, type StatusComponent } from "@avenick/observability";

export const dynamic = "force-dynamic";

/**
 * Public status aggregator for the status page / uptime monitor. Always returns
 * 200 with a body describing component health (operational/degraded/down) — the
 * status page renders the body; it does not treat this endpoint as the thing
 * being monitored. Deliberately public and PII-free.
 */
export async function GET() {
  const db = await checkDatabaseHealth();
  const circuit = dbCircuitState();

  const components: StatusComponent[] = [
    { name: "api", status: "operational" }, // if this responds, the API is up
    {
      name: "database",
      status: db.ok ? "operational" : "down",
      detail: `latency ${db.latencyMs}ms`,
    },
    {
      name: "database-circuit",
      status: circuit === "CLOSED" ? "operational" : circuit === "HALF_OPEN" ? "degraded" : "down",
      detail: circuit,
    },
  ];

  const summary = statusSummary("customer", components);
  return NextResponse.json(summary, {
    status: 200,
    // Allow a short shared-cache so a status-page poll storm doesn't hammer the
    // DB probe, but keep it fresh enough to be useful during an incident.
    headers: { "Cache-Control": "public, max-age=15, s-maxage=15" },
  });
}
