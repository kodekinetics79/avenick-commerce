/**
 * Structured, correlation-aware logger.
 *
 * Every line is a single JSON object on stdout — the format log aggregators
 * (Loki, Datadog, CloudWatch) parse natively. Crucially, each line is stamped
 * with the active OpenTelemetry span's `trace_id` and `span_id` when one is in
 * scope, so a log entry links to the exact distributed trace that produced it.
 * That is what turns "logs, metrics and traces" from three disconnected streams
 * into one correlated story you can pivot across by a single id.
 *
 * It also carries an app-level `requestId` (the `x-request-id` the API layer
 * already threads through, see @avenick/auth `guarded`). trace_id is the
 * infra-level correlation key; requestId is the one that also appears in the
 * client-facing error envelope, so support can paste it and land on the trace.
 *
 * No dependency beyond @opentelemetry/api, matching this repo's no-SDK,
 * plain-stdout convention. Safe to call before OTel is initialised: it simply
 * omits the trace fields.
 */
import { trace, context, isSpanContextValid } from "@opentelemetry/api";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  /** App-level request id (x-request-id). Correlates to the error envelope. */
  requestId?: string;
  /** HTTP method / path for request-scoped logs. */
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  /** Any additional structured context. Avoid PII. */
  [key: string]: unknown;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): number {
  const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
  return LEVEL_WEIGHT[configured] ?? LEVEL_WEIGHT.info;
}

/** Pull the active trace/span ids from the current OTel context, if any. */
function traceFields(): { trace_id?: string; span_id?: string } {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const sc = span.spanContext();
  if (!isSpanContextValid(sc)) return {};
  return { trace_id: sc.traceId, span_id: sc.spanId };
}

/** Service name for the current process, set once by createLogger(). */
let boundService = process.env.OTEL_SERVICE_NAME ?? "avenick";

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, errorOrFields?: unknown, fields?: LogFields): void;
  /** Return a logger that merges `base` fields into every line (e.g. requestId). */
  with(base: LogFields): Logger;
}

function emit(level: LogLevel, service: string, base: LogFields, msg: string, extra?: LogFields): void {
  if (LEVEL_WEIGHT[level] < minLevel()) return;
  const line = {
    level,
    service,
    msg,
    ...traceFields(),
    ...base,
    ...extra,
    at: new Date().toISOString(),
  };
  // error/warn to stderr so platform log routing can split severities.
  const sink = level === "error" || level === "warn" ? console.error : console.log;
  sink(JSON.stringify(line));
}

function build(service: string, base: LogFields): Logger {
  return {
    debug: (msg, fields) => emit("debug", service, base, msg, fields),
    info: (msg, fields) => emit("info", service, base, msg, fields),
    warn: (msg, fields) => emit("warn", service, base, msg, fields),
    error: (msg, errorOrFields?, fields?) => {
      // Accept either logger.error("msg", err) or logger.error("msg", {fields}).
      let merged: LogFields = { ...fields };
      if (errorOrFields instanceof Error) {
        merged = { ...merged, error: errorOrFields.message, stack: errorOrFields.stack };
      } else if (errorOrFields && typeof errorOrFields === "object") {
        merged = { ...merged, ...(errorOrFields as LogFields) };
      } else if (errorOrFields !== undefined) {
        merged = { ...merged, error: String(errorOrFields) };
      }
      emit("error", service, base, msg, merged);
    },
    with: (more) => build(service, { ...base, ...more }),
  };
}

/**
 * Create the process-wide logger. Call once per app (or import the default
 * `log` below and let it inherit OTEL_SERVICE_NAME).
 */
export function createLogger(serviceName: string): Logger {
  boundService = serviceName;
  return build(serviceName, {});
}

/** Default logger, service name from OTEL_SERVICE_NAME. */
export const log: Logger = build(boundService, {});
