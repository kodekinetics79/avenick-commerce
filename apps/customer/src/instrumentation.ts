/**
 * Runs once when the server process starts (Next.js instrumentation hook).
 *
 * Two things are bootstrapped here, both Node-runtime only:
 *   1. OpenTelemetry — traces + metrics over OTLP, so logs/metrics/traces all
 *      correlate by trace_id. No-ops if OTEL_EXPORTER_OTLP_ENDPOINT is unset.
 *   2. The shared Redis-backed rate-limit store (Upstash), so login/register/
 *      order rate limiting is effective across serverless instances instead of
 *      per-instance (and reset on every cold start).
 *
 * OTel is initialised first so telemetry emitted during startup is captured.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initObservability } = await import("@avenick/observability/instrumentation");
    initObservability({ serviceName: process.env.OTEL_SERVICE_NAME ?? "avenick-customer" });

    const { installRedisRateLimitStore } = await import("@avenick/auth");
    const { log } = await import("@avenick/observability");
    const installed = installRedisRateLimitStore();
    log.info(`rate-limit store: ${installed ? "redis (shared)" : "in-memory (per-instance)"}`);
  }
}
