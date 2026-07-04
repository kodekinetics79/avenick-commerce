/**
 * Manual span helpers for domain operations that deserve their own span inside
 * an auto-instrumented request trace — e.g. "db.health", "payment.capture",
 * "webhook.process". Auto-instrumentation already spans fetch/http; this is for
 * the meaningful units of work in between.
 *
 * Because these open child spans on the active context, any log written inside
 * (via @avenick/observability logger) automatically inherits the child span's
 * span_id — so a failure deep in a handler is one click from its log line.
 */
import { trace, SpanStatusCode, type Span, type Attributes } from "@opentelemetry/api";

const tracer = trace.getTracer("avenick.app", "1.0.0");

/**
 * Run `fn` inside a span named `name`. Records exceptions and sets ERROR status
 * automatically so failing operations show red in the trace view. Returns
 * whatever `fn` returns; re-throws after recording.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes: Attributes = {},
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

/** The active trace id, or undefined if no span is in scope. */
export function currentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  const id = span?.spanContext().traceId;
  return id && id !== "00000000000000000000000000000000" ? id : undefined;
}
