/**
 * Runs once at server startup (Next.js instrumentation hook), Node runtime only.
 *
 *   1. OpenTelemetry — traces + metrics over OTLP, correlating all three pillars
 *      by trace_id. No-ops if OTEL_EXPORTER_OTLP_ENDPOINT is unset.
 *   2. Shared Redis-backed rate-limit store; falls back to in-memory when unset.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initObservability } = await import("@avenick/observability/instrumentation");
    initObservability({ serviceName: process.env.OTEL_SERVICE_NAME ?? "avenick-seller" });

    const { installRedisRateLimitStore } = await import("@avenick/auth");
    const { log } = await import("@avenick/observability");
    const installed = installRedisRateLimitStore();
    log.info(`rate-limit store: ${installed ? "redis (shared)" : "in-memory (per-instance)"}`);
  }
}
