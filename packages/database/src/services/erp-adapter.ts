export type ErpCertificationScenario =
  | "ACCEPT"
  | "REJECT"
  | "TIMEOUT"
  | "HTTP_500"
  | "DUPLICATE_RESPONSE"
  | "DELAYED_RESPONSE";

export type ErpSubmitOrder = {
  orderId: string;
  orderNumber: string;
  idempotencyKey: string;
  customerId?: string;
  currency: string;
  total: number;
  items: Array<{ productId: string; sku: string; quantity: number; unitPrice: number }>;
};

export type ErpOrderResult =
  | { disposition: "ACCEPTED"; externalOrderId: string; correlationId: string; duplicate: boolean }
  | { disposition: "REJECTED"; reason: string; correlationId: string };

export interface ErpAdapter {
  readonly system: string;
  healthCheck(): Promise<{ ok: boolean; system: string }>;
  resolveCustomer(input: { companyId: string }): Promise<{ externalCustomerId: string }>;
  resolveProduct(input: { productId: string; sku: string }): Promise<{ externalProductId: string }>;
  resolvePrice(input: { productId: string; customerId?: string; quantity: number; currency: string }): Promise<{ unitPrice: number; currency: string }>;
  resolveAvailability(input: { productId: string; quantity: number }): Promise<{ available: boolean; availableQty: number }>;
  submitOrder(input: ErpSubmitOrder): Promise<ErpOrderResult>;
  getOrderStatus(input: { externalOrderId: string }): Promise<{ status: "ACCEPTED" | "REJECTED" | "UNKNOWN" }>;
}

export class HttpErpAdapter implements ErpAdapter {
  constructor(readonly system: string, private readonly baseUrl: string, private readonly token: string) {}
  private async call<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      // Both branches of this ternary previously read "HTTP_500", so a 404 or a
      // 401 was reported as a server error — misleading every downstream log,
      // dead-letter record and operator triage.
      const serverSide = response.status >= 500;
      // Reported class and retryability are separate questions: a 429 is
      // honestly a 4xx, and just as honestly worth retrying.
      throw new ErpAdapterError(
        serverSide ? "HTTP_500" : "HTTP_4XX",
        `ERP HTTP ${response.status}`,
        isRetryableHttpStatus(response.status),
        response.status,
        parseRetryAfterMs(response.headers.get("retry-after")) ?? undefined,
      );
    }
    return response.json() as Promise<T>;
  }
  healthCheck() { return this.call<{ ok: boolean; system: string }>("/health"); }
  resolveCustomer(input: { companyId: string }) { return this.call<{ externalCustomerId: string }>("/customers/resolve", input); }
  resolveProduct(input: { productId: string; sku: string }) { return this.call<{ externalProductId: string }>("/products/resolve", input); }
  resolvePrice(input: { productId: string; customerId?: string; quantity: number; currency: string }) { return this.call<{ unitPrice: number; currency: string }>("/prices/resolve", input); }
  resolveAvailability(input: { productId: string; quantity: number }) { return this.call<{ available: boolean; availableQty: number }>("/availability/resolve", input); }
  submitOrder(input: ErpSubmitOrder) { return this.call<ErpOrderResult>("/orders", input); }
  getOrderStatus(input: { externalOrderId: string }) { return this.call<{ status: "ACCEPTED" | "REJECTED" | "UNKNOWN" }>(`/orders/${encodeURIComponent(input.externalOrderId)}`); }
}

export class ErpAdapterError extends Error {
  constructor(
    readonly code: "TIMEOUT" | "HTTP_500" | "HTTP_4XX",
    message: string,
    readonly retryable = true,
    /** Transport status behind this failure, when there was one. */
    readonly status?: number,
    /** Wait the ERP asked for before the next attempt, in ms, from `Retry-After`. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ErpAdapterError";
  }
}

/** Statuses that mean "later", not "never": request timeout, too early, rate limited. */
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429]);

/** One hour — the same ceiling the durable retry schedule uses in integrations.ts. */
const RETRY_AFTER_CAP_MS = 60 * 60 * 1000;

/**
 * 5xx is the ERP failing. 408, 425 and 429 are the ERP asking us to come back
 * later — an ERP that rate-limits a burst of real customer orders returns 429 to
 * every one of them, and classifying that terminal dead-letters the whole burst
 * on first contact, pending manual redrive.
 *
 * Every other 4xx (400, 401, 403, 404, 422 …) describes a request that will be
 * rejected identically on every future attempt, so it stays terminal: surfacing
 * a permanent rejection immediately instead of eight retries later is the entire
 * point of this split, and must not be traded away to make 429 work.
 */
export function isRetryableHttpStatus(status: number): boolean {
  return status >= 500 || RETRYABLE_HTTP_STATUSES.has(status);
}

/**
 * `Retry-After` is delta-seconds or an HTTP-date (RFC 9110 §10.2.3). Bounded to
 * an hour so a misconfigured — or hostile — header cannot park a real customer
 * order past the schedule an operator can reason about, and floored at zero so a
 * date already in the past simply means "now".
 */
export function parseRetryAfterMs(header: string | null | undefined, now = Date.now()): number | null {
  const value = header?.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isFinite(seconds) ? Math.min(seconds * 1000, RETRY_AFTER_CAP_MS) : null;
  }
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  return Math.min(Math.max(0, at - now), RETRY_AFTER_CAP_MS);
}

/** The wait an ERP asked for, when this failure carried one. */
export function integrationRetryAfterMs(error: unknown): number | null {
  return error instanceof ErpAdapterError && typeof error.retryAfterMs === "number"
    ? error.retryAfterMs
    : null;
}

function stableId(prefix: string, value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}-${value.length.toString(36)}`;
}

export class DeterministicCertificationErpAdapter implements ErpAdapter {
  readonly system = "CERTIFICATION_ERP";
  private readonly accepted = new Map<string, ErpOrderResult>();

  constructor(
    readonly scenario: ErpCertificationScenario,
    private readonly delay: (milliseconds: number) => Promise<void> = async () => undefined,
    private readonly delayedResponseMs = 250,
  ) {}

  async healthCheck() {
    return { ok: true as const, system: this.system };
  }

  async resolveCustomer(input: { companyId: string }) {
    return { externalCustomerId: stableId("CUST", input.companyId) };
  }

  async resolveProduct(input: { productId: string; sku: string }) {
    return { externalProductId: stableId("ITEM", `${input.productId}:${input.sku}`) };
  }

  async resolvePrice(input: { productId: string; customerId?: string; quantity: number; currency: string }) {
    const seed = `${input.productId}:${input.customerId ?? "retail"}:${input.quantity}`.length;
    return { unitPrice: Number((10 + seed / 100).toFixed(2)), currency: input.currency.toUpperCase() };
  }

  async resolveAvailability(input: { productId: string; quantity: number }) {
    const availableQty = 100 + (input.productId.length % 50);
    return { available: availableQty >= input.quantity, availableQty };
  }

  async submitOrder(input: ErpSubmitOrder): Promise<ErpOrderResult> {
    const previous = this.accepted.get(input.idempotencyKey);
    if (previous) {
      return previous.disposition === "ACCEPTED" ? { ...previous, duplicate: true } : previous;
    }
    if (this.scenario === "TIMEOUT") throw new ErpAdapterError("TIMEOUT", "Certification ERP timed out");
    if (this.scenario === "HTTP_500") throw new ErpAdapterError("HTTP_500", "Certification ERP returned HTTP 500");
    if (this.scenario === "DELAYED_RESPONSE") await this.delay(this.delayedResponseMs);

    const correlationId = stableId("CORR", input.idempotencyKey);
    if (this.scenario === "REJECT") {
      const rejected = { disposition: "REJECTED" as const, reason: "CERTIFICATION_POLICY_REJECTION", correlationId };
      this.accepted.set(input.idempotencyKey, rejected);
      return rejected;
    }
    const accepted = {
      disposition: "ACCEPTED" as const,
      externalOrderId: stableId("SO", input.idempotencyKey),
      correlationId,
      duplicate: false,
    };
    this.accepted.set(input.idempotencyKey, accepted);
    return accepted;
  }

  async getOrderStatus(input: { externalOrderId: string }) {
    const result = [...this.accepted.values()].find(
      (candidate) => candidate.disposition === "ACCEPTED" && candidate.externalOrderId === input.externalOrderId,
    );
    return { status: result?.disposition === "ACCEPTED" ? "ACCEPTED" as const : "UNKNOWN" as const };
  }
}

export async function runDeterministicErpCertification() {
  const base: ErpSubmitOrder = {
    orderId: "cert-order",
    orderNumber: "CERT-0001",
    idempotencyKey: "cert-order:submit",
    customerId: "cert-customer",
    currency: "AED",
    total: 105,
    items: [{ productId: "cert-product", sku: "CERT-SKU", quantity: 1, unitPrice: 100 }],
  };
  const scenarios: ErpCertificationScenario[] = ["ACCEPT", "REJECT", "TIMEOUT", "HTTP_500", "DUPLICATE_RESPONSE", "DELAYED_RESPONSE"];
  return Promise.all(scenarios.map(async (scenario) => {
    let delayed = false;
    const adapter = new DeterministicCertificationErpAdapter(scenario, async () => { delayed = true; });
    try {
      const first = await adapter.submitOrder(base);
      const second = scenario === "DUPLICATE_RESPONSE" ? await adapter.submitOrder(base) : undefined;
      return { scenario, outcome: first.disposition, duplicate: second?.disposition === "ACCEPTED" ? second.duplicate : false, delayed };
    } catch (error) {
      if (error instanceof ErpAdapterError) return { scenario, outcome: error.code, duplicate: false, delayed };
      throw error;
    }
  }));
}

/**
 * Should this failure be retried, or is it permanent?
 *
 * `ErpAdapterError.retryable` was computed correctly and then never read by
 * anything — so a permanent rejection (400 bad request, 401 bad credentials,
 * 404 unknown order) consumed the full retry budget with exponential backoff
 * before dead-lettering, taking hours to surface an error that was already
 * final on the first attempt.
 *
 * Anything that is not a recognised permanent failure stays retryable, so an
 * unknown error class still gets the benefit of the doubt. Which HTTP statuses
 * count as permanent is decided once, in `isRetryableHttpStatus`.
 */
export function isRetryableIntegrationError(error: unknown): boolean {
  return error instanceof ErpAdapterError ? error.retryable : true;
}
