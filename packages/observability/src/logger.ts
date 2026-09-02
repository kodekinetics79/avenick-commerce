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
 * Every line is also redacted on the way out — see the Redaction section below.
 * That is deliberately here and not at the call sites: emit() is the single
 * choke point every logger in the monorepo passes through, including the
 * per-request access log and the unhandled-error line in @avenick/auth.
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
  /**
   * Any additional structured context. Sensitive keys and sensitive-looking
   * values are redacted at emit time (see Redaction below), but that is a net,
   * not a licence: still prefer logging an id over the record it points at.
   */
  [key: string]: unknown;
}

/* ------------------------------------------------------------------------ *
 * Redaction
 *
 * A comment saying "avoid PII" is a convention. This is the control.
 *
 * Two independent nets, because leaks arrive in two different shapes:
 *
 *   1. By KEY — `{ email: "..." }`. Matched on a *normalised substring*, so
 *      `customerEmail`, `user_email`, `billingAddress` and `vat_number` are all
 *      caught without being enumerated one by one.
 *   2. By VALUE — the worse case, and the one a key denylist cannot see.
 *      Recipient addresses, bearer tokens and provider API keys mostly reach
 *      logs *inside* message strings, third-party response bodies and stack
 *      traces, where there is no tidy field name to match against.
 *
 * Only values are redacted, never structure: level, service, msg, requestId,
 * trace_id, method, path, status, durationMs and the error *type* all survive
 * intact. A log nobody can read during an incident is its own outage. Where
 * something is removed it is replaced by a visible marker ("[redacted]",
 * "[redacted-email]", …) so an operator can tell "scrubbed" from "absent".
 * ------------------------------------------------------------------------ */

const REDACTED = "[redacted]";

/**
 * Normalised (lowercased, punctuation-stripped) key fragments. A key is
 * sensitive when its normalised form CONTAINS one of these — substring rather
 * than equality, because the real-world spellings are prefixed and suffixed.
 * `passwordHash` is covered by "password", `apiKeyId` by "apikey".
 */
const DENY_KEY_FRAGMENTS: readonly string[] = [
  "email",
  "phone",
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "accesskey",
  "credential",
  "bankdetails",
  "crnumber",
  "vatnumber",
  "taxid",
  "address",
  "idempotencykey",
  "iban",
  "cvv",
  "signature",
];

/**
 * Exemptions, matched on the WHOLE normalised key (never a substring). These
 * are counters and booleans that collide with a fragment above but carry no
 * identity — redacting them would only cost debuggability. Keep this list
 * short and boring; it is a hole in a security control.
 */
const SAFE_KEYS: ReadonlySet<string> = new Set([
  "emailverified",
  "phoneverified",
  "maxtokens",
  "tokencount",
  "totaltokens",
  "inputtokens",
  "outputtokens",
  "prompttokens",
  "completiontokens",
]);

/** Key names repeat on every request, so the verdict is worth memoising. */
const keyVerdict = new Map<string, boolean>();

function isSensitiveKey(key: string): boolean {
  const cached = keyVerdict.get(key);
  if (cached !== undefined) return cached;
  const norm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  const sensitive = !SAFE_KEYS.has(norm) && DENY_KEY_FRAGMENTS.some((f) => norm.includes(f));
  // Bounded: a caller logging dynamically-named keys must not grow this map
  // without limit. Clearing wholesale is fine — it only costs a recompute.
  if (keyVerdict.size >= 5000) keyVerdict.clear();
  keyVerdict.set(key, sensitive);
  return sensitive;
}

/**
 * Value patterns. Every quantifier below is BOUNDED, and the input is length
 * capped before matching, because these run on attacker-influenceable strings
 * (provider error bodies, validation messages) on the request path — an
 * unbounded pattern here would turn logging itself into a CPU sink.
 */
// Local part and DNS labels are bounded to their RFC limits; the trailing
// alphabetic TLD is what stops "@avenick/observability@1.0.0" being eaten.
const EMAIL_RE = /[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,10}\.[A-Za-z]{2,24}/g;
// "Authorization: Bearer <...>" as it appears in headers and echoed requests.
const AUTH_SCHEME_RE = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,512}/gi;
// JWTs always begin "eyJ" (base64url of `{"`).
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,4096}\.[A-Za-z0-9_-]{8,4096}(?:\.[A-Za-z0-9_-]{0,4096})?/g;
// Prefixed provider secrets: Resend re_, Checkout/Stripe sk_/pk_/rk_, whsec_.
const PREFIXED_SECRET_RE = /\b(?:re|sk|pk|rk|whsec)_[A-Za-z0-9_-]{12,256}/g;
const AWS_KEY_RE = /\bAKIA[0-9A-Z]{12,20}/g;
// E.164, which is how GCC mobile numbers are stored on this schema. The
// leading "+" plus 9-15 digits is specific enough not to eat order numbers.
const E164_RE = /\+\d{9,15}(?!\d)/g;

/** Strings longer than this are truncated before scrubbing — visibly. */
const MAX_STRING = 16_384;

/** Scrub sensitive-looking values out of free text. Never throws. */
function scrubText(input: string): string {
  let s = input;
  let truncated = false;
  if (s.length > MAX_STRING) {
    s = s.slice(0, MAX_STRING);
    truncated = true;
  }
  // Cheap character gates first: most log strings (paths, ids, timestamps,
  // stack frames) contain none of these and skip the regex work entirely.
  if (s.indexOf("@") !== -1) s = s.replace(EMAIL_RE, "[redacted-email]");
  if (s.indexOf("eyJ") !== -1) s = s.replace(JWT_RE, "[redacted-token]");
  if (s.indexOf("_") !== -1) s = s.replace(PREFIXED_SECRET_RE, "[redacted-secret]");
  if (s.indexOf("AKIA") !== -1) s = s.replace(AWS_KEY_RE, "[redacted-secret]");
  if (s.indexOf("+") !== -1) s = s.replace(E164_RE, "[redacted-phone]");
  // No cheap gate for the auth scheme (it is case-insensitive), but the
  // pattern is anchored on a literal keyword, so it fails fast.
  if (s.length >= 14) s = s.replace(AUTH_SCHEME_RE, "$1 [redacted-token]");
  return truncated ? `${s}…[truncated]` : s;
}

const MAX_DEPTH = 6;
const MAX_ARRAY = 100;
/** Total nodes visited per line. Bounds cost on an accidentally huge object. */
const MAX_NODES = 1000;

interface Budget {
  nodes: number;
}

function redactError(err: Error, depth: number, seen: WeakSet<object>, budget: Budget): unknown {
  const out: Record<string, unknown> = {
    // The error TYPE is the most useful field in an incident. Never redacted.
    name: typeof err.name === "string" ? err.name : "Error",
    message: scrubText(String(err.message ?? "")),
  };
  if (typeof err.stack === "string") out.stack = scrubText(err.stack);
  // Prisma (P2002…), Node (ECONNREFUSED) and fetch errors carry `code`: a
  // classifier, not data, and the fastest route to a root cause.
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" || typeof code === "number") out.code = code;
  const cause = (err as { cause?: unknown }).cause;
  if (cause !== undefined) out.cause = redactValue(cause, depth + 1, seen, budget);
  return out;
}

/**
 * Recursively redact a value. Fail-safe by construction: cycles, depth,
 * breadth and total node count are all bounded, throwing getters are caught,
 * and the whole walk is wrapped so a hostile object cannot take down the
 * request that logged it.
 */
function redactValue(value: unknown, depth: number, seen: WeakSet<object>, budget: Budget): unknown {
  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === "string") return scrubText(value as string);
  if (t === "number" || t === "boolean") return value;
  // JSON.stringify throws on bigint, which would otherwise lose the whole line.
  if (t === "bigint") return `${value as bigint}`;
  if (t === "function") return "[function]";
  if (t === "symbol") return String(value as symbol);

  const obj = value as object;
  // Path-scoped, not visit-scoped: deleted on the way out so a DAG (the same
  // object referenced twice side by side) renders twice rather than being
  // mislabelled "[circular]". The node budget is what bounds the re-walk.
  if (seen.has(obj)) return "[circular]";
  if (depth >= MAX_DEPTH) return "[depth-capped]";
  if (budget.nodes >= MAX_NODES) return "[truncated]";
  budget.nodes += 1;
  seen.add(obj);

  try {
    if (obj instanceof Date) {
      const ms = obj.getTime();
      return Number.isNaN(ms) ? "[invalid-date]" : obj.toISOString();
    }
    if (obj instanceof Error) return redactError(obj, depth, seen, budget);

    if (Array.isArray(obj)) {
      const out: unknown[] = [];
      const n = Math.min(obj.length, MAX_ARRAY);
      for (let i = 0; i < n; i += 1) {
        if (budget.nodes >= MAX_NODES) {
          out.push(`[truncated: ${obj.length - i} more]`);
          return out;
        }
        out.push(redactValue(obj[i], depth + 1, seen, budget));
      }
      if (obj.length > n) out.push(`[truncated: ${obj.length - n} more]`);
      return out;
    }

    if (obj instanceof Map) {
      const out: Record<string, unknown> = {};
      let i = 0;
      for (const [k, v] of obj) {
        if (i >= MAX_ARRAY || budget.nodes >= MAX_NODES) {
          out["[truncated]"] = `${obj.size - i} more entries`;
          break;
        }
        const key = String(k);
        out[key] = isSensitiveKey(key) ? REDACTED : redactValue(v, depth + 1, seen, budget);
        i += 1;
      }
      return out;
    }
    if (obj instanceof Set) {
      return redactValue(Array.from(obj), depth, seen, budget);
    }

    // Honour toJSON. Prisma.Decimal serialises to its exact decimal string;
    // walking its internals instead would render money as {s,e,d} — unreadable
    // and, worse, easy to misread as a number.
    const toJSON = (obj as { toJSON?: unknown }).toJSON;
    if (typeof toJSON === "function") {
      const projected = (toJSON as () => unknown).call(obj);
      // Guard the degenerate `toJSON() { return this }` case.
      if (projected !== obj) return redactValue(projected, depth + 1, seen, budget);
    }

    const out: Record<string, unknown> = {};
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]!;
      if (budget.nodes >= MAX_NODES) {
        out["[truncated]"] = `${keys.length - i} more keys`;
        break;
      }
      if (isSensitiveKey(key)) {
        // Do not even read it: the getter could be expensive or throw, and the
        // value is going in the bin either way.
        out[key] = REDACTED;
        continue;
      }
      let v: unknown;
      try {
        v = (obj as Record<string, unknown>)[key];
      } catch {
        out[key] = "[unreadable]";
        continue;
      }
      out[key] = redactValue(v, depth + 1, seen, budget);
    }
    return out;
  } catch {
    return "[unserializable]";
  } finally {
    seen.delete(obj);
  }
}

/**
 * Redact a field bag by the same rules the logger applies to every line.
 * Exported for call sites that need to sanitise a payload before it reaches
 * somewhere other than stdout.
 */
export function redactLogFields(fields: LogFields): LogFields {
  return redactValue(fields, 0, new WeakSet<object>(), { nodes: 0 }) as LogFields;
}

/* ------------------------------------------------------------------------ */

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

/** Best-effort requestId for the fallback line. Must not throw. */
function pickRequestId(...bags: (LogFields | undefined)[]): string | undefined {
  for (const bag of bags) {
    try {
      const id = bag?.requestId;
      if (typeof id === "string") return id;
    } catch {
      /* a throwing getter must not cost us the fallback line too */
    }
  }
  return undefined;
}

/**
 * Last resort when building or serialising the line failed. Keeps the line
 * correlatable (level, service, requestId, trace ids) and says plainly that
 * the detail was dropped, rather than throwing inside the caller's request.
 */
function fallbackLine(
  level: LogLevel,
  service: string,
  msg: string,
  base?: LogFields,
  extra?: LogFields,
): string {
  try {
    return JSON.stringify({
      level,
      service,
      msg: scrubText(String(msg)),
      ...traceFields(),
      requestId: pickRequestId(extra, base),
      logRedactionError: "[fields omitted: could not be serialised safely]",
      at: new Date().toISOString(),
    });
  } catch {
    // `level` is a fixed union, so this literal is always valid JSON.
    return `{"level":"${level}","msg":"[log emit failed]"}`;
  }
}

function emit(level: LogLevel, service: string, base: LogFields, msg: string, extra?: LogFields): void {
  if (LEVEL_WEIGHT[level] < minLevel()) return;
  // error/warn to stderr so platform log routing can split severities.
  const sink = level === "error" || level === "warn" ? console.error : console.log;
  let payload: string;
  try {
    // The spread itself can throw (a getter on a caller's field bag), so it
    // lives inside the guard along with redaction and serialisation.
    const line = {
      level,
      service,
      msg,
      ...traceFields(),
      ...base,
      ...extra,
      at: new Date().toISOString(),
    };
    // JSON.stringify is *typed* as returning string but returns undefined for a
    // few inputs. redactValue never produces one, but a line must never reach
    // stdout as the literal "undefined" if that ever stops being true.
    const serialised = JSON.stringify(redactValue(line, 0, new WeakSet<object>(), { nodes: 0 }));
    payload = typeof serialised === "string" ? serialised : fallbackLine(level, service, msg, base, extra);
  } catch {
    payload = fallbackLine(level, service, msg, base, extra);
  }
  sink(payload);
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
        // Kept flat (error/stack rather than a nested object) for backwards
        // compatibility with existing dashboards; both are scrubbed in emit().
        merged = { ...merged, error: errorOrFields.message, stack: errorOrFields.stack };
        const code = (errorOrFields as { code?: unknown }).code;
        if (typeof code === "string" || typeof code === "number") merged = { ...merged, errorCode: code };
        merged = { ...merged, errorType: errorOrFields.name };
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
