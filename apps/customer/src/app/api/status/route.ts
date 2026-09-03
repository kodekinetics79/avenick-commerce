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

  // Integrations are only "operational" when something is actually configured
  // and reachable. With none configured the honest answer is "not configured" —
  // reporting zero integrations as active claims capability that is absent.
  const configuredIntegrations = [
    process.env.CHECKOUT_SECRET_KEY,
    process.env.RESEND_API_KEY,
    process.env.TWILIO_ACCOUNT_SID,
  ].filter((v) => !!v?.trim()).length;

  const components: StatusComponent[] = [
    { name: "api", kind: "process", status: "operational" }, // if this responds, the API is up
    {
      name: "database",
      kind: "process",
      status: db.ok ? "operational" : "down",
      detail: `latency ${db.latencyMs}ms`,
    },
    {
      name: "database-circuit",
      kind: "process",
      status: circuit === "CLOSED" ? "operational" : circuit === "HALF_OPEN" ? "degraded" : "down",
      detail: circuit,
    },
    {
      name: "external-integrations",
      kind: "integration",
      status: configuredIntegrations === 0 ? "not_configured" : "unverified",
      detail:
        configuredIntegrations === 0
          ? "none configured"
          : `${configuredIntegrations} configured, health not probed`,
    },
    {
      // No journey synthetic runs against this deployment yet, so primary
      // customer journeys are unverified. This must not read as operational —
      // process health says nothing about whether anyone can actually buy.
      name: "primary-journeys",
      kind: "journey",
      status: "unverified",
      detail: "no synthetic configured",
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
