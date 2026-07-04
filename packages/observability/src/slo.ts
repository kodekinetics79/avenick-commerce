/**
 * Service Level Objectives — vague expectations turned into measured commitments.
 *
 * Each SLO names an SLI (the thing measured), a target (the commitment), and a
 * window (over which the target is judged). The error budget is 1 - target: the
 * amount of failure allowed before the objective is breached. Burn-rate alerts
 * (see alerts/slo-burn-rate.yaml) fire when we are consuming that budget fast
 * enough to exhaust it before the window ends — that is how you learn the
 * system is breaking *before* customers do, instead of after.
 *
 * These SLIs are computed entirely from the RED metrics in metrics.ts:
 *   availability = 1 - rate(http.server.requests{status_class="5xx"})
 *                        / rate(http.server.requests)
 *   latency      = fraction of http.server.duration under `latencyThresholdMs`
 *
 * This file is the source of truth. The Prometheus recording/alerting rules in
 * ../../ops/observability mirror these numbers; keep them in sync.
 */
export interface Slo {
  /** Stable id used in dashboards and alert rules. */
  id: string;
  /** Human description of the user-facing promise. */
  description: string;
  /** Which portal(s) this applies to. */
  service: "customer" | "seller" | "admin" | "all";
  /** The SLI kind. */
  sli: "availability" | "latency";
  /** Target as a fraction, e.g. 0.995 = 99.5%. */
  target: number;
  /** Rolling window the target is evaluated over. */
  window: "28d" | "30d";
  /** For latency SLOs: the threshold requests must complete under. */
  latencyThresholdMs?: number;
}

export const SLOS: readonly Slo[] = [
  {
    id: "customer-api-availability",
    description:
      "Customer API returns a non-5xx response for 99.9% of requests. This is the checkout/browse path — the money path.",
    service: "customer",
    sli: "availability",
    target: 0.999,
    window: "28d",
  },
  {
    id: "customer-api-latency",
    description: "99% of customer API requests complete in under 800ms.",
    service: "customer",
    sli: "latency",
    target: 0.99,
    window: "28d",
    latencyThresholdMs: 800,
  },
  {
    id: "seller-api-availability",
    description: "Seller API returns a non-5xx response for 99.5% of requests.",
    service: "seller",
    sli: "availability",
    target: 0.995,
    window: "28d",
  },
  {
    id: "admin-api-availability",
    description: "Admin API returns a non-5xx response for 99.5% of requests.",
    service: "admin",
    sli: "availability",
    target: 0.995,
    window: "28d",
  },
  {
    id: "readiness-availability",
    description:
      "The /api/ready dependency probe (app + database) succeeds 99.9% of the time. This is what the external uptime monitor pages on.",
    service: "all",
    sli: "availability",
    target: 0.999,
    window: "28d",
  },
] as const;
