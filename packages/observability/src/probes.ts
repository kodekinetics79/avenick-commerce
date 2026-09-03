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
 * How one dependency is probed.
 *
 * `critical` is the load-balancer decision: /api/ready is Render's
 * `healthCheckPath` (render.yaml) and the external uptime monitor's page
 * target, so a 503 takes the instance out of rotation. Only a dependency the
 * portal genuinely cannot serve without belongs in that decision; operational
 * evidence (queue depth, worker heartbeats) must be reported, never fatal.
 *
 * `cacheMs` bounds how often the probe may actually run. The endpoint is
 * unauthenticated (packages/auth/src/middleware.ts exempts /api/ready), so an
 * expensive probe is a free amplifier for anyone who curls it in a loop.
 */
export interface DependencyProbe {
  run: () => Promise<DependencyCheck>;
  /** Failure means this instance cannot serve traffic → 503. Default true. */
  critical?: boolean;
  /**
   * Reuse a recent result for this many ms. Default 0 — every request runs a
   * real probe. Only ever set this on a NON-critical dependency: a serving
   * dependency answered from cache stops detecting the outage the probe exists
   * for.
   */
  cacheMs?: number;
  /**
   * Hard ceiling on one probe attempt. Defaults to DEFAULT_PROBE_TIMEOUT_MS.
   *
   * A probe that never settles is WORSE than one that throws: the handler never
   * responds at all, so `finish(status)` never runs, no http.server.requests
   * series is emitted, the in-flight counter leaks — exactly the silent failure
   * a thrown probe used to cause, and ReadinessProbeFailing still has no 503 to
   * match. A hung database (pool exhausted, blackholed network) is the common
   * shape of that: `getIntegrationRuntimeReadiness` is ~10 Prisma queries with
   * no timeout of its own, and with single-flight every later caller would join
   * the same hung promise.
   */
  timeoutMs?: number;
}

/**
 * Ceiling on one probe attempt when the caller sets none. Probes run
 * sequentially, so this also bounds the handler: with the database probe's own
 * 2s cap the worst case stays comfortably inside the 10s uptime-monitor
 * timeout. A timed-out NON-critical probe only reports ok:false; it never
 * changes a healthy instance's 200.
 */
const DEFAULT_PROBE_TIMEOUT_MS = 3_000;

/** A bare function is shorthand for a critical, uncached dependency. */
export type ProbeSpec = (() => Promise<DependencyCheck>) | DependencyProbe;

/** Structural stand-in for `Headers`, so this module stays framework-free. */
export interface HeaderReader {
  get(name: string): string | null;
}

export interface ReadinessOptions {
  /**
   * Extra operator detail (e.g. DB circuit state). Returned ONLY to a caller
   * presenting the shared-secret probe header — never in the public response.
   */
  detail?: Record<string, unknown>;
  /** Request headers, used to authorise the detailed response. */
  headers?: HeaderReader;
}

/**
 * Presenting this header with a value matching `READINESS_DETAIL_TOKEN` swaps
 * the boolean summary for the full operator view (per-check latency, the
 * underlying exception message, circuit state, queue counters). With the env
 * var unset there is no detailed mode at all.
 */
const DETAIL_HEADER = "x-avenick-probe-token";

/**
 * Length-independent compare of two secrets. `node:crypto.timingSafeEqual` is
 * the house convention (see the webhook routes), but this module is reachable
 * from the Edge middleware import graph via @avenick/auth, so it must stay free
 * of `node:` imports; a hand-rolled scan is equivalent for a fixed-length
 * high-entropy token.
 */
function secretEquals(supplied: string, expected: string): boolean {
  if (supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i += 1) {
    diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function detailAuthorised(headers?: HeaderReader): boolean {
  const expected = process.env.READINESS_DETAIL_TOKEN?.trim();
  // Fail closed on DISCLOSURE, never on availability: a missing or wrong token
  // only trims the body. It must never turn a healthy instance into a 503, or
  // the fix becomes the outage.
  if (!expected) return false;
  const supplied = headers?.get(DETAIL_HEADER)?.trim();
  return !!supplied && secretEquals(supplied, expected);
}

interface ProbeCacheEntry {
  at: number;
  result: DependencyCheck;
}

const probeCache = new Map<string, ProbeCacheEntry>();
const probeInFlight = new Map<string, Promise<DependencyCheck>>();

/**
 * Run one dependency probe, never throwing, with TTL caching and single-flight
 * coalescing.
 *
 * Single-flight applies to every probe, cached or not: concurrent callers all
 * await the same in-flight round trip, so a burst from the platform health
 * checker plus three uptime monitors plus a flood costs one probe at a time
 * rather than one per request. Each caller still gets a real, current result —
 * this collapses duplicate work, it does not weaken the signal.
 */
async function runProbe(name: string, spec: DependencyProbe): Promise<DependencyCheck> {
  const cacheMs = spec.cacheMs ?? 0;
  if (cacheMs > 0) {
    const hit = probeCache.get(name);
    if (hit && Date.now() - hit.at < cacheMs) return hit.result;
  }

  const existing = probeInFlight.get(name);
  if (existing) return existing;

  const started = Date.now();
  const timeoutMs = spec.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const pending = (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Race, don't just await: a probe that hangs would otherwise hang the
      // handler, and a handler that never responds emits no status code at all
      // — the alert is blind to it in exactly the way a 500 is. The losing
      // promise stays attached to the race, so a late rejection is still
      // handled and never surfaces as an unhandled rejection.
      return await Promise.race([
        spec.run(),
        new Promise<DependencyCheck>((resolve) => {
          timer = setTimeout(
            () =>
              resolve({
                ok: false,
                latencyMs: Date.now() - started,
                error: `dependency probe exceeded ${timeoutMs}ms`,
              }),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      // A probe that throws IS a failed dependency, not a failed probe. Letting
      // it propagate makes the route answer 500, and ReadinessProbeFailing in
      // ops/observability/slo-burn-rate.rules.yaml matches
      // http_status_code="503" — so a thrown probe silently disables the page
      // for the exact outage it exists to catch.
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : "dependency probe threw",
      };
    } finally {
      // Never leave the timer pending: it would hold the event loop open and,
      // on a fast probe, delay process shutdown by up to timeoutMs.
      if (timer !== undefined) clearTimeout(timer);
    }
  })()
    .then((result) => {
      if (cacheMs > 0) probeCache.set(name, { at: Date.now(), result });
      return result;
    })
    .finally(() => {
      probeInFlight.delete(name);
    });

  // Set synchronously, before any continuation can run, so a concurrent caller
  // in the same tick joins this probe instead of starting a second one.
  probeInFlight.set(name, pending);
  return pending;
}

/**
 * Readiness: verifies critical dependencies. `probes` maps a dependency name to
 * a probe (e.g. { database: () => checkDatabaseHealth() }). Returns 200 when
 * every critical dependency passes, 503 when any fails — the signal
 * Render/Vercel and the external uptime monitor act on. The whole thing runs in
 * a "readiness" span and logs the outcome with per-dependency detail.
 *
 * Two invariants this function must never break:
 *
 *  1. It never throws. A thrown handler is a 500, which emits no
 *     http.server.requests series at all, so the paging alert cannot fire and
 *     the in-flight (saturation) counter leaks +1 forever. Every path here ends
 *     in `finish(status)`.
 *  2. The public body carries booleans only. The endpoint is unauthenticated,
 *     and a probe's `error` is a raw driver message — a Prisma P1001 spells out
 *     the database host, port and name. Detail is allowlisted into the response
 *     only behind the shared-secret header.
 */
export async function readiness(
  app: string,
  probes: Record<string, ProbeSpec>,
  options: ReadinessOptions = {},
): Promise<ProbeResult> {
  const { ctx, finish } = instrumentRequest({
    service: SERVICE,
    requestId: "ready",
    method: "GET",
    route: "/api/ready",
    path: "/api/ready",
  });

  // 503 is the correct default. If anything below fails in a way we did not
  // anticipate, the honest answer is still "not ready", reported with the
  // status code the alert actually matches.
  let status = 503;
  try {
    return await withSpan("readiness", async () => {
      const results: Record<string, DependencyCheck> = {};
      // Built by allowlist, not by deleting fields from `results`: a probe may
      // return any shape it likes (the integration probe returns queue
      // counters), and nothing it invents can reach an anonymous caller.
      const publicChecks: Record<string, { ok: boolean }> = {};
      let ready = true;

      for (const [name, spec] of Object.entries(probes)) {
        const probe: DependencyProbe = typeof spec === "function" ? { run: spec } : spec;
        const result = await runProbe(name, probe);
        results[name] = result;
        publicChecks[name] = { ok: result.ok };
        if (!result.ok && probe.critical !== false) ready = false;
      }

      status = ready ? 200 : 503;

      const failed = Object.entries(results)
        .filter(([, r]) => !r.ok)
        .map(([n, r]) => `${n}:${r.error ?? "failed"}`)
        .join("; ");
      if (!ready) {
        ctx.log.error("readiness degraded", undefined, { app, failed });
      } else if (failed) {
        // Every critical dependency is healthy, so the instance stays in
        // rotation — but a non-critical probe failing is still worth a line, or
        // an integration outage is invisible until someone reads the queue.
        ctx.log.warn("readiness ok, non-critical dependency failing", { app, failed });
      } else {
        ctx.log.info("readiness ok", { app, checks: Object.keys(results).join(",") });
      }

      const detailed = detailAuthorised(options.headers);
      return {
        status,
        body: {
          status: ready ? "ready" : "degraded",
          app,
          checks: detailed ? results : publicChecks,
          ...(detailed ? (options.detail ?? {}) : {}),
          timestamp: new Date().toISOString(),
        },
      };
    });
  } catch (error) {
    // runProbe already absorbs dependency failures, so reaching here means the
    // probe machinery itself broke. Answer 503 rather than letting Next turn it
    // into a 500 the alert cannot see.
    ctx.log.error("readiness probe failed", error instanceof Error ? error : undefined, { app });
    status = 503;
    return {
      status,
      body: {
        // No check completed. An empty `checks` is the honest report of that —
        // it must not imply anything was measured.
        status: "degraded",
        app,
        checks: {},
        timestamp: new Date().toISOString(),
      },
    };
  } finally {
    // `finish` is idempotent (packages/observability/src/http.ts), so this is
    // the single place the RED metric and the in-flight decrement happen — on
    // every path, including the one that threw.
    finish(status);
  }
}

// ─── Public status aggregator ──────────────────────────────────────────────────

/**
 * `unverified` and `not_configured` exist so the page can distinguish "we
 * checked and it is fine" from "nothing has checked this" and "there is nothing
 * here to check". Collapsing either into `operational` is how a status page ends
 * up claiming health it never measured.
 */
export type ComponentStatus =
  | "operational"
  | "degraded"
  | "down"
  | "unverified"
  | "not_configured";

/** Groups a component so the page can scope its headline claim. */
export type ComponentKind = "process" | "journey" | "integration";

export interface StatusComponent {
  name: string;
  status: ComponentStatus;
  /** Defaults to "process" when omitted. */
  kind?: ComponentKind;
  /** Optional short, non-sensitive detail (e.g. "circuit: OPEN"). */
  detail?: string;
}

export interface StatusSummary {
  /** Worst-of the components that were actually measured. */
  status: ComponentStatus;
  /** Worst-of the process components only — never journeys or integrations. */
  processStatus: ComponentStatus;
  /** `operational` only when a journey synthetic has actually passed. */
  journeyStatus: ComponentStatus;
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
  // `unverified` outranks `degraded`: not knowing is worse than a known,
  // measured partial failure, because it cannot be reasoned about. Only `down`
  // is worse. `not_configured` is not a fault and never worsens a roll-up.
  const rank: Record<ComponentStatus, number> = {
    not_configured: -1,
    operational: 0,
    degraded: 1,
    unverified: 2,
    down: 3,
  };

  const worstOf = (subset: StatusComponent[], fallback: ComponentStatus): ComponentStatus => {
    const measured = subset.filter((c) => c.status !== "not_configured");
    if (measured.length === 0) return fallback;
    return measured.reduce<ComponentStatus>(
      (worst, c) => (rank[c.status] > rank[worst] ? c.status : worst),
      "operational",
    );
  };

  const kindOf = (c: StatusComponent): ComponentKind => c.kind ?? "process";
  const process = components.filter((c) => kindOf(c) === "process");
  const journeys = components.filter((c) => kindOf(c) === "journey");

  // With no journey component declared at all, journey health is unknown —
  // never "operational".
  const processStatus = worstOf(process, "unverified");
  const journeyStatus = worstOf(journeys, "unverified");

  return {
    status: worstOf(components, "unverified"),
    processStatus,
    journeyStatus,
    app,
    components,
    uptimeSeconds: uptimeSeconds(),
    timestamp: new Date().toISOString(),
  };
}
