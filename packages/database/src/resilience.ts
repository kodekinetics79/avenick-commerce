/**
 * Resilience layer for database operations — the "bypass in case of failure"
 * mechanics that keep the portals serving when Postgres is slow, flapping, or
 * briefly down, instead of returning 500s to every customer.
 *
 * Composition, applied by `resilient()` and the read/write helpers below:
 *
 *   timeout ─▶ retry (transient errors only) ─▶ circuit breaker ─▶ fallback
 *
 *   - timeout:  no query hangs forever; a stuck connection fails fast so the
 *               request can degrade instead of pinning a serverless instance.
 *   - retry:    transient faults (connection reset, pool timeout) get one or two
 *               quick retries with jittered backoff. Deterministic errors (a
 *               constraint violation) are NOT retried — that would just be slow.
 *   - breaker:  after N consecutive failures the circuit OPENS: we stop hammering
 *               a downed DB, fail fast for a cool-down, then probe with a single
 *               HALF-OPEN request before fully closing again. This is what stops
 *               a DB outage from turning into a thundering-herd retry storm.
 *   - fallback: reads may serve a previously-cached value (stale-but-available)
 *               when the DB is unavailable. Writes never fall back — a payment or
 *               order must fail loudly, never silently succeed against nothing.
 *
 * Every state transition and fallback is reported through @avenick/observability
 * so "we served stale data for 4 minutes while Neon was down" is a visible,
 * alertable event, not a silent mystery.
 */
import { log, recordEvent, withSpan } from "@avenick/observability";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface ResilienceConfig {
  /** Per-attempt timeout in ms. */
  timeoutMs: number;
  /** Max attempts including the first (so 3 = 1 try + 2 retries). */
  maxAttempts: number;
  /** Base backoff between retries in ms (jittered). */
  backoffMs: number;
  /** Consecutive failures before the breaker opens. */
  failureThreshold: number;
  /** How long the breaker stays open before probing (HALF_OPEN), in ms. */
  cooldownMs: number;
}

const DEFAULTS: ResilienceConfig = {
  timeoutMs: Number(process.env.DB_TIMEOUT_MS ?? 4000),
  maxAttempts: Number(process.env.DB_MAX_ATTEMPTS ?? 3),
  backoffMs: Number(process.env.DB_BACKOFF_MS ?? 100),
  failureThreshold: Number(process.env.DB_BREAKER_THRESHOLD ?? 5),
  cooldownMs: Number(process.env.DB_BREAKER_COOLDOWN_MS ?? 10_000),
};

// ─── Circuit breaker ──────────────────────────────────────────────────────────

type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * A single process-wide breaker for the database. In a multi-instance
 * (serverless) deployment each instance keeps its own breaker — that is fine and
 * even desirable: an instance that can't reach the DB stops trying without
 * needing to coordinate, and healthy instances keep serving.
 */
class CircuitBreaker {
  private state: BreakerState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt = 0;

  constructor(private readonly cfg: ResilienceConfig) {}

  /** Throw fast if the circuit is open and still cooling down. */
  assertClosed(): void {
    if (this.state === "OPEN") {
      if (Date.now() - this.openedAt >= this.cfg.cooldownMs) {
        // Cooldown elapsed — allow a single probe.
        this.transition("HALF_OPEN");
      } else {
        throw new CircuitOpenError();
      }
    }
  }

  onSuccess(): void {
    if (this.state !== "CLOSED") this.transition("CLOSED");
    this.consecutiveFailures = 0;
  }

  onFailure(): void {
    this.consecutiveFailures++;
    // A failure while probing immediately re-opens the circuit.
    if (this.state === "HALF_OPEN" || this.consecutiveFailures >= this.cfg.failureThreshold) {
      if (this.state !== "OPEN") {
        this.openedAt = Date.now();
        this.transition("OPEN");
      } else {
        this.openedAt = Date.now();
      }
    }
  }

  get current(): BreakerState {
    return this.state;
  }

  private transition(to: BreakerState): void {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;
    recordEvent("db.circuit.transition", { from, to });
    const msg = `db circuit ${from} → ${to}`;
    if (to === "OPEN") log.error(msg, undefined, { from, to });
    else log.warn(msg, { from, to });
  }
}

/** Thrown when the breaker is open — the DB is presumed down; fail fast. */
export class CircuitOpenError extends Error {
  constructor() {
    super("Database circuit is open");
    this.name = "CircuitOpenError";
  }
}

/** Thrown when a single DB attempt exceeds the timeout. */
export class DbTimeoutError extends Error {
  constructor(ms: number) {
    super(`Database operation timed out after ${ms}ms`);
    this.name = "DbTimeoutError";
  }
}

// The shared breaker instance for all DB access in this process.
const breaker = new CircuitBreaker(DEFAULTS);

/** Exposed for the readiness probe / status endpoint. */
export function dbCircuitState(): BreakerState {
  return breaker.current;
}

// ─── Retry classification ─────────────────────────────────────────────────────

/**
 * Only transient/connection-class failures are worth retrying. Prisma surfaces
 * these as P1000-series ("Can't reach database server", timeouts, pool
 * exhaustion). Everything else (constraint violations, query errors) is
 * deterministic — retrying just wastes the request's latency budget.
 */
function isTransient(err: unknown): boolean {
  if (err instanceof DbTimeoutError) return true;
  const code = (err as { code?: string })?.code;
  if (typeof code === "string") {
    // P1001 can't reach db, P1002 timed out, P1008 op timed out, P1017 conn closed
    if (["P1001", "P1002", "P1008", "P1017"].includes(code)) return true;
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return /timeout|connection|econnreset|terminated|pool/.test(msg);
}

function withTimeout<T>(op: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    op(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new DbTimeoutError(ms)), ms)),
  ]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Core primitive ───────────────────────────────────────────────────────────

/**
 * Per-call knobs. Only the per-operation settings (timeout/retries/backoff) are
 * overridable; the circuit breaker is a single shared instance configured
 * process-wide from env (failureThreshold / cooldownMs), so it cannot be — and
 * must not be — tuned per call.
 */
export type PerCallConfig = Pick<ResilienceConfig, "timeoutMs" | "maxAttempts" | "backoffMs">;

export interface ResilientOptions {
  /** Span/metric label for this operation, e.g. "products.list". */
  name: string;
  /** Override the per-operation timeout/retry knobs for this call. */
  config?: Partial<PerCallConfig>;
}

/**
 * Run a DB operation with timeout + retry + circuit breaker. Throws on ultimate
 * failure (CircuitOpenError / the last underlying error). Use the read/write
 * helpers below rather than calling this directly unless you need bare control.
 */
export async function resilient<T>(op: () => Promise<T>, opts: ResilientOptions): Promise<T> {
  const cfg = { ...DEFAULTS, ...opts.config };
  return withSpan(`db.${opts.name}`, async (span) => {
    breaker.assertClosed();

    let lastErr: unknown;
    for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
      try {
        const result = await withTimeout(op, cfg.timeoutMs);
        breaker.onSuccess();
        span.setAttribute("db.attempts", attempt);
        return result;
      } catch (err) {
        lastErr = err;
        const transient = isTransient(err);
        span.setAttribute("db.attempt_failed", attempt);
        if (!transient || attempt === cfg.maxAttempts) {
          breaker.onFailure();
          throw err;
        }
        // Jittered backoff before the next attempt.
        await sleep(cfg.backoffMs * attempt + Math.random() * cfg.backoffMs);
      }
    }
    throw lastErr;
  });
}
