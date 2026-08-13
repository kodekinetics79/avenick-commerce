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
  healthCheck(): Promise<{ ok: true; system: string }>;
  resolveCustomer(input: { companyId: string }): Promise<{ externalCustomerId: string }>;
  resolveProduct(input: { productId: string; sku: string }): Promise<{ externalProductId: string }>;
  resolvePrice(input: { productId: string; customerId?: string; quantity: number; currency: string }): Promise<{ unitPrice: number; currency: string }>;
  resolveAvailability(input: { productId: string; quantity: number }): Promise<{ available: boolean; availableQty: number }>;
  submitOrder(input: ErpSubmitOrder): Promise<ErpOrderResult>;
  getOrderStatus(input: { externalOrderId: string }): Promise<{ status: "ACCEPTED" | "REJECTED" | "UNKNOWN" }>;
}

export class ErpAdapterError extends Error {
  constructor(
    readonly code: "TIMEOUT" | "HTTP_500",
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "ErpAdapterError";
  }
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
