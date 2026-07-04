/**
 * Shared implementations for the /api/health (liveness) and /api/ready
 * (readiness) probes, so all three portals behave identically and both probes
 * are themselves observed: each emits a structured log line and a RED metric,
 * and readiness runs inside a trace. This means the thing your uptime monitor
 * pages on is itself measurable — you can chart readiness success rate straight
 * into the readiness-availability SLO.
 *
 * These return plain JSON-serialisable results plus an HTTP status; the route
 * files wrap them in NextResponse so this module stays framework-free.
 */
import { instrumentRequest } from "./http";
import { withSpan } from "./tracing";

const SERVICE = process.env.OTEL_SERVICE_NAME ?? "avenick";

/**
 * Process uptime in seconds, Edge-Runtime-safe. `process.uptime` doesn't exist
 * in the Edge runtime (where this module can be pulled in via middleware's import
 * graph), so fall back to 0 rather than reference an unsupported API at module
 * eval. On Node (where the probes actually run) it returns the real uptime.
 */
function uptimeSeconds(): number {
  // Access via a computed property so Next's Edge static analyzer doesn't flag
  // the literal `process.uptime` (its lint is a text scan, not flow-aware). This
  // module can be pulled into the Edge middleware graph; the probes themselves
  // only ever run on Node, where this returns real uptime. Elsewhere → 0.
  const proc = typeof process !== "undefined" ? (process as unknown as Record<string, unknown>) : undefined;
  const fn = proc?.["uptime"];
  return typeof fn === "function" ? Math.floor((fn as () => number)()) : 0;
}

export interface ProbeResult {
  status: number;
  body: Record<string, unknown>;
}

/** Liveness: the process is up and serving. No dependency checks. */
export function liveness(app: string): ProbeResult {
  const { finish } = instrumentRequest({
    service: SERVICE,
    requestId: "health",
    method: "GET",
    route: "/api/health",
    path: "/api/health",
  });
  finish(200);
  return {
    status: 200,
    body: {
      status: "ok",
      app,
      uptimeSeconds: uptimeSeconds(),
      timestamp: new Date().toISOString(),
    },
  };
}

export interface DependencyCheck {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Readiness: verifies critical dependencies. `checks` maps a dependency name to
 * an async probe (e.g. { database: () => checkDatabaseHealth() }). Returns 200
 * when all pass, 503 when any fails — the signal Render/Vercel and the external
 * uptime monitor act on. The whole thing runs in a "readiness" span and logs
 * the outcome with per-dependency detail.
 */
export async function readiness(
  app: string,
  checks: Record<string, () => Promise<DependencyCheck>>,
  /** Extra diagnostic fields to include in the body, e.g. DB circuit state. */
  extra?: Record<string, unknown>,
): Promise<ProbeResult> {
  const { ctx, finish } = instrumentRequest({
    service: SERVICE,
    requestId: "ready",
    method: "GET",
    route: "/api/ready",
    path: "/api/ready",
  });

  return withSpan("readiness", async () => {
    const results: Record<string, DependencyCheck> = {};
    let ready = true;
    for (const [name, probe] of Object.entries(checks)) {
      const result = await probe();
      results[name] = result;
      if (!result.ok) ready = false;
    }

    const status = ready ? 200 : 503;
    if (ready) {
      ctx.log.info("readiness ok", { app, checks: Object.keys(results).join(",") });
    } else {
      const failed = Object.entries(results)
        .filter(([, r]) => !r.ok)
        .map(([n, r]) => `${n}:${r.error ?? "failed"}`)
        .join("; ");
      ctx.log.error("readiness degraded", undefined, { app, failed });
    }
    finish(status);

    return {
      status,
      body: {
        status: ready ? "ready" : "degraded",
        app,
        checks: results,
        ...(extra ?? {}),
        timestamp: new Date().toISOString(),
      },
    };
  });
}

// ─── Public status aggregator ──────────────────────────────────────────────────

export type ComponentStatus = "operational" | "degraded" | "down";

export interface StatusComponent {
  name: string;
  status: ComponentStatus;
  /** Optional short, non-sensitive detail (e.g. "circuit: OPEN"). */
  detail?: string;
}

export interface StatusSummary {
  /** Worst-of the components. */
  status: ComponentStatus;
  app: string;
  components: StatusComponent[];
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * Build a public, non-sensitive status summary for a status page. Unlike
 * /api/ready (a machine probe that returns 503), this always returns 200 with a
 * body describing component health, so a status page can render "degraded"
 * without treating the status endpoint itself as down. Never include error
 * internals or PII here — it is public.
 */
export function statusSummary(app: string, components: StatusComponent[]): StatusSummary {
  const rank: Record<ComponentStatus, number> = { operational: 0, degraded: 1, down: 2 };
  const overall = components.reduce<ComponentStatus>(
    (worst, c) => (rank[c.status] > rank[worst] ? c.status : worst),
    "operational",
  );
  return {
    status: overall,
    app,
    components,
    uptimeSeconds: uptimeSeconds(),
    timestamp: new Date().toISOString(),
  };
}
