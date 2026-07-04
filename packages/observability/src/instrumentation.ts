/**
 * OpenTelemetry bootstrap for the Avenick portals.
 *
 * This is the single place where the three pillars of observability are wired
 * together under one identifier:
 *
 *   - traces  → spans exported over OTLP (auto-instrumented HTTP + fetch, plus
 *               any manual spans we open)
 *   - metrics → RED metrics (Rate, Errors, Duration) emitted from the request
 *               seam, exported over OTLP as an OTLP metrics stream
 *   - logs    → structured JSON logs written to stdout, each carrying the
 *               active span's trace_id / span_id (see logger.ts), so a log line
 *               links to the exact trace that produced it
 *
 * Everything is exported via OTLP/HTTP to whatever collector OTEL_EXPORTER_*
 * points at. For the pilot that is Grafana Cloud (Tempo + Mimir + Loki behind
 * one OTLP gateway); the code itself is vendor-neutral.
 *
 * Called once per server process from each app's src/instrumentation.ts, which
 * Next.js runs at startup via `experimental.instrumentationHook`.
 *
 * No-ops safely when OTEL_EXPORTER_OTLP_ENDPOINT is unset (local dev, or a
 * deploy before the collector is provisioned), so nothing here can break boot.
 */
import { registerOTel } from "@vercel/otel";

let started = false;

export interface OTelInitOptions {
  /** Logical service name, e.g. "avenick-customer". Shows up on every span. */
  serviceName: string;
}

/**
 * Initialise OpenTelemetry for this process. Idempotent and side-effect-free
 * when no OTLP endpoint is configured.
 */
export function initObservability({ serviceName }: OTelInitOptions): boolean {
  if (started) return true;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    // Structured so it is greppable but does not pretend telemetry is flowing.
    console.log(
      JSON.stringify({
        level: "info",
        service: serviceName,
        msg: "observability: OTEL_EXPORTER_OTLP_ENDPOINT unset; telemetry disabled",
        at: new Date().toISOString(),
      }),
    );
    return false;
  }

  // @vercel/otel wires the Node SDK: OTLP/HTTP trace + metric exporters, W3C
  // trace-context + baggage propagation, and auto-instrumentation for fetch and
  // node:http. Auth headers (e.g. Grafana Cloud basic auth) travel via the
  // standard OTEL_EXPORTER_OTLP_HEADERS env var, which the SDK reads directly.
  registerOTel({
    serviceName,
    // Emit RED metrics as well as traces. Both go to the same OTLP endpoint.
    // Sampling stays at parent-based/always-on for the pilot so we never lose a
    // failing request's trace; tune with OTEL_TRACES_SAMPLER later.
  });

  started = true;
  console.log(
    JSON.stringify({
      level: "info",
      service: serviceName,
      msg: "observability: OpenTelemetry initialised",
      endpoint,
      at: new Date().toISOString(),
    }),
  );
  return true;
}
