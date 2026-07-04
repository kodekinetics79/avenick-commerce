/**
 * Request-level instrumentation seam.
 *
 * `instrumentRequest` is the one place that, for every request, emits:
 *   - a structured access log (level by status: 5xx→error, 4xx→warn, else info)
 *   - RED metrics (count + duration histogram, labelled by route/method/status)
 *   - an in-flight (saturation) delta
 * all stamped with the same trace_id (from the active span) and requestId.
 *
 * The API layer (@avenick/auth `guarded`) calls this so we get uniform
 * telemetry without touching individual handlers. It is transport-agnostic:
 * pass in the primitives, get back a `finish(status)` to call once you know the
 * outcome.
 */
import { createLogger, type Logger } from "./logger";
import { recordRequest, trackInFlight } from "./metrics";

export interface RequestContext {
  requestId: string;
  method: string;
  /** Low-cardinality route template for metrics, e.g. "/api/orders/[id]". */
  route: string;
  /** Full path for the log line (higher cardinality is fine in logs). */
  path?: string;
  /** Request-scoped logger carrying requestId (+ trace_id at emit time). */
  log: Logger;
}

let baseLogger: Logger | undefined;
function loggerFor(service: string): Logger {
  if (!baseLogger) baseLogger = createLogger(service);
  return baseLogger;
}

export interface InstrumentInit {
  service: string;
  requestId: string;
  method: string;
  route: string;
  path?: string;
}

/**
 * Begin instrumenting a request. Returns the request context (with a scoped
 * logger) and a `finish(status)` to record the outcome exactly once.
 */
export function instrumentRequest(init: InstrumentInit): {
  ctx: RequestContext;
  finish: (status: number) => void;
} {
  const start = Date.now();
  const endInFlight = trackInFlight(init.route);
  const log = loggerFor(init.service).with({ requestId: init.requestId });

  const ctx: RequestContext = {
    requestId: init.requestId,
    method: init.method,
    route: init.route,
    path: init.path,
    log,
  };

  let finished = false;
  const finish = (status: number): void => {
    if (finished) return;
    finished = true;
    const durationMs = Date.now() - start;
    endInFlight();
    recordRequest({ method: init.method, route: init.route, status, durationMs });

    const fields = {
      method: init.method,
      path: init.path ?? init.route,
      route: init.route,
      status,
      durationMs,
    };
    const msg = "request";
    if (status >= 500) log.error(msg, undefined, fields);
    else if (status >= 400) log.warn(msg, fields);
    else log.info(msg, fields);
  };

  return { ctx, finish };
}
