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

    // The read cache has the same swap point and the same env vars, but its
    // bootstrap was never written — so the shared store was never installed and
    // every instance kept a private Map. On serverless that means a ~1/N hit
    // rate and, more importantly, a stale-on-error fallback that only protects
    // an instance which already served that exact query.
    const { installRedisCacheStore } = await import("@avenick/database");
    const cacheShared = installRedisCacheStore();
    log.info(`read cache: ${cacheShared ? "redis (shared)" : "in-memory (per-instance)"}`);
  }
}
