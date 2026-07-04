# Observability & Failover Runbook

How we know the platform is healthy — and how we find out, trace, and page
*before* customers do. This is the operator's guide to the three pillars, the
SLOs, and the on-call response.

---

## TL;DR — the four questions, answered

| Question | Answer | Where |
| --- | --- | --- |
| **If the app goes down, how do we find out?** | `/api/ready` returns 503 when the DB is unreachable; Prometheus alerts `ReadinessProbeFailing` / `NoTrafficReceived` page on-call; an external uptime monitor pings `/api/ready` on all three portals. | [`ops/observability/slo-burn-rate.rules.yaml`](ops/observability/slo-burn-rate.rules.yaml) |
| **Can we trace a failure in 60s?** | Yes. Every request emits one structured log line + a span, both stamped with the same `trace_id`, plus the client-facing `requestId`. Paste either into Grafana → land on the trace → see the failing span (e.g. `db.health`, `payment.webhook`) with the exception. | [`packages/observability`](packages/observability) |
| **Are logs, metrics & traces correlated by one id?** | Yes — OpenTelemetry. Traces + metrics export over OTLP; logs carry `trace_id`/`span_id`. One id pivots across all three. | [`instrumentation.ts`](packages/observability/src/instrumentation.ts) |
| **Do we have SLOs?** | Yes — availability + latency SLOs with multi-window burn-rate alerts. | [`slo.ts`](packages/observability/src/slo.ts) |

---

## The three pillars, correlated

```
                         ┌──────────────── OpenTelemetry ────────────────┐
  request ──▶ guarded() ─┤  trace  → span (auto fetch/http + withSpan)    │──▶ OTLP ─▶ Grafana Cloud
              │          │  metric → http.server.requests / .duration     │     (Tempo/Mimir/Loki)
              │          │  log    → JSON on stdout w/ trace_id, requestId │──▶ log drain
              └── every exit path (200/4xx/5xx) is measured once ──────────┘
```

- **Traces** — `@vercel/otel` auto-instruments `fetch`/`http`. Domain work opens
  manual spans via `withSpan()` (`db.health`, `payment.webhook`). A failing span
  is recorded with its exception and shows red.
- **Metrics** — RED metrics (`http.server.requests`, `http.server.duration`,
  `http.server.active_requests`) plus `business.events` (`payment.captured`,
  `payment.declined`). Low-cardinality labels only (route template, not raw path).
- **Logs** — one JSON line per request from the `guarded()` seam, plus explicit
  `log.*` calls. Every line carries `trace_id`, `span_id`, `requestId`, `service`.

The correlation key: **`trace_id`** links logs↔traces↔metrics inside the infra;
**`requestId`** is also returned to the client in the error envelope
(`{ success:false, error, requestId }`), so a customer's error id lands you on
the exact trace.

## Enabling it

Telemetry is **off by default** and no-ops safely when unset — the apps behave
exactly as before, structured logs still stream to stdout. To turn it on, set on
each Render service (and locally in `.env`):

```
OTEL_EXPORTER_OTLP_ENDPOINT   # Grafana Cloud OTLP gateway URL
OTEL_EXPORTER_OTLP_HEADERS    # Authorization=Basic <base64 instanceID:token>
OTEL_SERVICE_NAME             # avenick-customer | avenick-seller | avenick-admin
LOG_LEVEL                     # debug | info | warn | error  (default info)
```

`OTEL_SERVICE_NAME` and `LOG_LEVEL` are already set per-service in
[`render.yaml`](render.yaml); the two OTLP secrets are `sync:false` — add them in
the Render dashboard from your Grafana Cloud stack.

## SLOs

Source of truth: [`packages/observability/src/slo.ts`](packages/observability/src/slo.ts).
Alert rules mirror them: [`ops/observability/slo-burn-rate.rules.yaml`](ops/observability/slo-burn-rate.rules.yaml).

| SLO | Target | Window |
| --- | --- | --- |
| Customer API availability (non-5xx) | 99.9% | 28d |
| Customer API latency (< 800ms) | 99% | 28d |
| Seller / Admin API availability | 99.5% | 28d |
| Readiness (app + DB) availability | 99.9% | 28d |

Alerts use **multi-window multi-burn-rate**: a *fast burn* (14.4×, 5m+1h) pages
for acute outages; a *slow burn* (3×, 1h+6h) tickets for chronic erosion.

## On-call runbook

### <a id="fast-burn"></a>Fast burn — `CustomerApiErrorBudgetFastBurn` (PAGE)
The money path is erroring hard. In Grafana:
1. Filter logs `service="avenick-customer" level="error"` for the last 15m.
2. Grab a `trace_id` → open the trace → find the red span.
3. Common causes: DB down (see readiness), a bad deploy (check recent releases),
   an upstream (Checkout.com) failing.
4. If a deploy correlates, roll back on Render.

### <a id="slow-burn"></a>Slow burn — `CustomerApiErrorBudgetSlowBurn` (TICKET)
A minority of requests fail consistently. Group error logs by `route` to find the
offending endpoint; it's usually one handler, not a platform outage.

### <a id="latency"></a>Latency — `CustomerApiLatencySlowBurn` (TICKET)
p99 over 800ms. Sort traces by duration; the long pole is typically a slow DB
query (look at `db.*` spans) or a resource-starved Starter instance (0.5 CPU)
saturating under load — check `http.server.active_requests`.

### <a id="readiness-down"></a>Readiness failing — `ReadinessProbeFailing` (PAGE)
`/api/ready` is 503 → the database is unreachable. Open the `readiness` trace and
read the `db.health` span: latency and error message are on it. Check Neon status
and the connection string/pooler.

### <a id="no-traffic"></a>No traffic — `NoTrafficReceived` (PAGE)
Either the service is down or the metric pipeline stopped. Cross-check the
external uptime monitor hitting `/api/ready`. If the monitor is also failing, the
service is down — check Render (each portal is a **single Starter instance**: an
OOM or crash loop takes the whole portal out; there is no second instance to
fail over to).

## Graceful degradation (bypass) — how we stay up when the DB wobbles

Every database call routed through `read()` / `write()` (see
[`packages/database/src/resilience.ts`](packages/database/src/resilience.ts)) is
protected by **timeout → transient-retry → circuit breaker**, and reads add a
**stale-on-failure cache**:

- **Reads that must stay up** (catalog list/search) use `read({ cache })`. If the
  DB is unavailable, the last-known-good result is served with `stale: true` and
  a `cache.stale_fallback` event — the browse path degrades instead of 500ing.
- **Writes** (orders, payments) use `write()`: timeout + breaker, **fail-fast, no
  retry, no fallback**. A payment must error loudly, never silently succeed.
- **Circuit breaker**: after `DB_BREAKER_THRESHOLD` (default 5) consecutive
  failures it OPENS — the app stops hammering a downed DB, fails fast for
  `DB_BREAKER_COOLDOWN_MS` (default 10s), then probes with one HALF-OPEN request.
  Transitions emit `db.circuit.transition` events and error/warn logs.

**`/api/ready` now reports `dbCircuit`** (`CLOSED`/`OPEN`/`HALF_OPEN`). `OPEN` is
a **leading indicator** — the DB is being bypassed *right now*; investigate
before the readiness SLO burns. Tunables are the `DB_*` env vars in `.env.example`.

## Architectural blind spot to watch

The customer frontend on Vercel rewrites `/api/*` to the Render backend
(`avenick-commerce.onrender.com`). Each Render portal is a **single Starter
instance** — always-on (Starter was chosen precisely because the free tier spins
down), but with no second instance: one crash/OOM means downtime until the
platform restarts it, and 0.5 CPU saturates under load. The `x-request-id` is
propagated across the Vercel→Render hop, so a trace spans both sides — but for
GA, upgrade at least the customer portal to a plan with **≥2 instances** so an
instance failure fails over instead of failing customers.
