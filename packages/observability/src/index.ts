/**
 * @avenick/observability — the three pillars, correlated by one trace_id.
 *
 *   initObservability()  → OTel SDK bootstrap (traces + metrics over OTLP)
 *   log / createLogger() → structured logs stamped with the active trace_id
 *   recordRequest / recordEvent / trackInFlight → RED + business metrics
 *   withSpan()           → manual spans for domain operations
 *   instrumentRequest()  → the per-request seam (log + metrics in one call)
 *
 * See slo.ts for the service-level objectives these signals are measured
 * against, and OBSERVABILITY.md for the operator runbook.
 */
export { initObservability, type OTelInitOptions } from "./instrumentation";
export { log, createLogger, type Logger, type LogLevel, type LogFields } from "./logger";
export {
  recordRequest,
  recordEvent,
  trackInFlight,
  type RequestMetric,
} from "./metrics";
export { withSpan, currentTraceId } from "./tracing";
export {
  instrumentRequest,
  type RequestContext,
  type InstrumentInit,
} from "./http";
export {
  liveness,
  readiness,
  statusSummary,
  type ProbeResult,
  type DependencyCheck,
  type StatusSummary,
  type StatusComponent,
  type ComponentStatus,
} from "./probes";
export { SLOS, type Slo } from "./slo";
