import { NextResponse } from "next/server";
import { checkDatabaseHealth, dbCircuitState, getIntegrationRuntimeReadiness } from "@avenick/database";
import { readiness } from "@avenick/observability";

export const dynamic = "force-dynamic";

/**
 * How long an integration readiness result may be reused. The probe is ~10
 * Prisma queries and this route is unauthenticated (middleware exempts
 * /api/ready), hit by the platform health checker plus external uptime monitors
 * on every portal. 15s is well under the 60s monitor interval, so a real
 * integration problem is still surfaced promptly, while a request flood cannot
 * amplify into ten database round trips per hit.
 */
const INTEGRATION_READINESS_CACHE_MS = 15_000;

/**
 * Readiness probe: verifies the database — the one dependency this portal
 * cannot serve without — is reachable. Runs inside a trace and emits a
 * structured log + metric, so its own success rate feeds the
 * readiness-availability SLO. Returns 503 when that dependency is down: the
 * signal Render/Vercel and the external uptime monitor page on, and the status
 * code ReadinessProbeFailing matches in ops/observability/slo-burn-rate.rules.yaml.
 *
 * The body is deliberately a boolean summary. This endpoint is public, and a
 * raw driver error names the database host; per-check timings and queue
 * counters are a live "is the database struggling" oracle. Both are available
 * to an operator sending the `x-avenick-probe-token` shared secret.
 */
export async function GET(request: Request) {
  const { status, body } = await readiness(
    "seller",
    {
      // The serving dependency: never cached, so an outage is caught on the
      // very next probe.
      database: { run: () => checkDatabaseHealth(), critical: true },
      // Queue/worker health is operational evidence, not a serving dependency
      // (see getIntegrationRuntimeReadiness). Non-critical, so an integration
      // backlog never 503s the portal out of the load balancer.
      integration: {
        run: async () => {
          const started = Date.now();
          const result = await getIntegrationRuntimeReadiness();
          return { ...result, latencyMs: Date.now() - started };
        },
        critical: false,
        cacheMs: INTEGRATION_READINESS_CACHE_MS,
      },
    },
    { headers: request.headers, detail: { dbCircuit: dbCircuitState() } },
  );
  return NextResponse.json(body, {
    status,
    // Never let an intermediary serve a cached "ready": a stale 200 during an
    // outage is precisely the failure this probe exists to catch.
    headers: { "Cache-Control": "no-store" },
  });
}
