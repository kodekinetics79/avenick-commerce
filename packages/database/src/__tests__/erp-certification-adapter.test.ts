import { describe, expect, it, vi } from "vitest";
import {
  DeterministicCertificationErpAdapter,
  ErpAdapterError,
  runDeterministicErpCertification,
  type ErpSubmitOrder,
} from "../services/erp-adapter";

const order: ErpSubmitOrder = {
  orderId: "order-1",
  orderNumber: "ORD-1",
  idempotencyKey: "order:1:submit",
  customerId: "company-1",
  currency: "AED",
  total: 105,
  items: [{ productId: "product-1", sku: "SKU-1", quantity: 1, unitPrice: 100 }],
};

describe("deterministic ERP certification adapter", () => {
  it("certifies accept, reject, timeout, 500, duplicate and delayed outcomes", async () => {
    await expect(runDeterministicErpCertification()).resolves.toEqual([
      expect.objectContaining({ scenario: "ACCEPT", outcome: "ACCEPTED" }),
      expect.objectContaining({ scenario: "REJECT", outcome: "REJECTED" }),
      expect.objectContaining({ scenario: "TIMEOUT", outcome: "TIMEOUT" }),
      expect.objectContaining({ scenario: "HTTP_500", outcome: "HTTP_500" }),
      expect.objectContaining({ scenario: "DUPLICATE_RESPONSE", outcome: "ACCEPTED", duplicate: true }),
      expect.objectContaining({ scenario: "DELAYED_RESPONSE", outcome: "ACCEPTED", delayed: true }),
    ]);
  });

  it("returns the same external identity for replayed idempotency keys", async () => {
    const adapter = new DeterministicCertificationErpAdapter("ACCEPT");
    const first = await adapter.submitOrder(order);
    const replay = await adapter.submitOrder(order);
    expect(first.disposition).toBe("ACCEPTED");
    expect(replay).toMatchObject({ disposition: "ACCEPTED", duplicate: true });
    if (first.disposition === "ACCEPTED" && replay.disposition === "ACCEPTED") {
      expect(replay.externalOrderId).toBe(first.externalOrderId);
      await expect(adapter.getOrderStatus({ externalOrderId: first.externalOrderId })).resolves.toEqual({ status: "ACCEPTED" });
    }
  });

  it("exposes every adapter contract operation deterministically", async () => {
    const adapter = new DeterministicCertificationErpAdapter("ACCEPT");
    await expect(adapter.healthCheck()).resolves.toEqual({ ok: true, system: "CERTIFICATION_ERP" });
    await expect(adapter.resolveCustomer({ companyId: "company-1" })).resolves.toMatchObject({ externalCustomerId: expect.stringMatching(/^CUST-/) });
    await expect(adapter.resolveProduct({ productId: "p1", sku: "sku1" })).resolves.toMatchObject({ externalProductId: expect.stringMatching(/^ITEM-/) });
    await expect(adapter.resolvePrice({ productId: "p1", quantity: 2, currency: "aed" })).resolves.toMatchObject({ currency: "AED" });
    await expect(adapter.resolveAvailability({ productId: "p1", quantity: 1 })).resolves.toMatchObject({ available: true });
  });

  it("models timeout and HTTP 500 as retryable failures and invokes delayed response control", async () => {
    await expect(new DeterministicCertificationErpAdapter("TIMEOUT").submitOrder(order))
      .rejects.toMatchObject({ code: "TIMEOUT", retryable: true } satisfies Partial<ErpAdapterError>);
    await expect(new DeterministicCertificationErpAdapter("HTTP_500").submitOrder(order))
      .rejects.toMatchObject({ code: "HTTP_500", retryable: true } satisfies Partial<ErpAdapterError>);
    const delay = vi.fn().mockResolvedValue(undefined);
    await new DeterministicCertificationErpAdapter("DELAYED_RESPONSE", delay, 123).submitOrder(order);
    expect(delay).toHaveBeenCalledWith(123);
  });
});
