/**
 * RED metrics (Rate, Errors, Duration) — the minimum metric set an SLO needs.
 *
 * These are OpenTelemetry instruments, so they export over the same OTLP stream
 * as traces and land in the same backend (Mimir/Prometheus on Grafana Cloud).
 * From these three you can compute every SLI in slo.ts:
 *   - availability = 1 - (5xx count / total count)
 *   - latency SLI  = fraction of requests under the latency threshold
 *
 * Labels are deliberately low-cardinality (route template, method, status
 * class) so the metrics stay cheap and queryable. Never label with a raw path
 * containing ids or a requestId — that explodes cardinality. The route template
 * (e.g. "/api/orders/[id]") is the right granularity.
 */
import { metrics, type Attributes } from "@opentelemetry/api";

const meter = metrics.getMeter("avenick.http", "1.0.0");

/** Total HTTP requests handled, by route/method/status class. */
const requestCounter = meter.createCounter("http.server.requests", {
  description: "Count of HTTP requests handled",
});

/** Request duration in milliseconds — a histogram for latency SLIs/percentiles. */
const durationHistogram = meter.createHistogram("http.server.duration", {
  description: "HTTP request duration",
  unit: "ms",
});

/** In-flight requests — a saturation signal alongside RED. */
const inFlight = meter.createUpDownCounter("http.server.active_requests", {
  description: "Requests currently being handled",
});

function statusClass(status: number): string {
  return `${Math.floor(status / 100)}xx`;
}

export interface RequestMetric {
  method: string;
  /** Low-cardinality route template, e.g. "/api/orders/[id]". */
  route: string;
  status: number;
  durationMs: number;
}

/** Record one completed request against all RED instruments. */
export function recordRequest({ method, route, status, durationMs }: RequestMetric): void {
  const attrs: Attributes = {
    "http.method": method,
    "http.route": route,
    "http.status_class": statusClass(status),
    "http.status_code": status,
  };
  requestCounter.add(1, attrs);
  durationHistogram.record(durationMs, attrs);
}

/** Mark a request as started/finished for the in-flight (saturation) gauge. */
export function trackInFlight(route: string): () => void {
  const attrs: Attributes = { "http.route": route };
  inFlight.add(1, attrs);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    inFlight.add(-1, attrs);
  };
}

/**
 * Generic business-event counter, so domain code can emit measurable events
 * (e.g. "payment.captured", "order.placed") that dashboards and alerts hang
 * off — the same instrument, low-cardinality labels only.
 */
const eventCounter = meter.createCounter("business.events", {
  description: "Domain/business events",
});

export function recordEvent(name: string, attrs: Attributes = {}): void {
  eventCounter.add(1, { "event.name": name, ...attrs });
}
