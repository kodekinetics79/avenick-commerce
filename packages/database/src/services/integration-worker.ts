import { Prisma, type IntegrationOutbox } from "@prisma/client";
import type { ErpAdapter, ErpSubmitOrder } from "./erp-adapter";
import {
  claimIntegrationOutbox,
  failIntegrationOutbox,
  finalizeOrderIntegrationOutbox,
  type IntegrationLease,
} from "./integrations";

function asObject(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Integration payload must be an object");
  return value as Record<string, Prisma.JsonValue>;
}

function number(value: Prisma.JsonValue | undefined, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Integration payload ${field} is invalid`);
  return value;
}

function string(value: Prisma.JsonValue | undefined, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Integration payload ${field} is invalid`);
  return value;
}

export function toErpSubmitOrder(message: IntegrationOutbox): ErpSubmitOrder {
  if (message.aggregateType !== "ORDER" || message.eventType !== "ORDER_SUBMIT_REQUESTED") {
    throw new Error(`Unsupported integration event: ${message.aggregateType}/${message.eventType}`);
  }
  const payload = asObject(message.payload);
  if (!Array.isArray(payload.items)) throw new Error("Integration payload items are invalid");
  return {
    orderId: string(payload.orderId, "orderId"),
    orderNumber: string(payload.orderNumber, "orderNumber"),
    idempotencyKey: message.idempotencyKey,
    customerId: typeof payload.companyId === "string" ? payload.companyId : undefined,
    currency: string(payload.currency, "currency"),
    total: number(payload.total, "total"),
    items: payload.items.map((raw) => {
      const item = asObject(raw);
      return {
        productId: string(item.productId, "items.productId"),
        sku: string(item.sku, "items.sku"),
        quantity: number(item.quantity, "items.quantity"),
        unitPrice: number(item.unitPrice, "items.unitPrice"),
      };
    }),
  };
}

export async function processIntegrationOutboxMessage(
  message: IntegrationOutbox,
  adapter: ErpAdapter,
  maxAttempts = 8,
) {
  const lease = message as IntegrationLease;
  try {
    const request = toErpSubmitOrder(message);
    const result = await adapter.submitOrder(request);
    await finalizeOrderIntegrationOutbox(lease, result.disposition === "ACCEPTED" ? {
      ...result,
      system: adapter.system,
      orderId: request.orderId,
      authoritativeTotals: { currency: request.currency, total: request.total },
    } : {
      ...result,
      system: adapter.system,
      orderId: request.orderId,
      authoritativeTotals: { currency: request.currency, total: request.total },
    });
    return { status: result.disposition, duplicate: result.disposition === "ACCEPTED" && result.duplicate };
  } catch (error) {
    await failIntegrationOutbox(lease, error, maxAttempts);
    return { status: message.attempts >= maxAttempts ? "DEAD" as const : "RETRY" as const, error };
  }
}

export async function runIntegrationWorkerOnce(input: {
  workerId: string;
  adapters: Record<string, ErpAdapter>;
  destination?: string;
  limit?: number;
  leaseMs?: number;
  maxAttempts?: number;
}) {
  const messages = await claimIntegrationOutbox({
    workerId: input.workerId,
    destination: input.destination,
    limit: input.limit,
    leaseMs: input.leaseMs,
  });
  const results = [];
  for (const message of messages) {
    const adapter = input.adapters[message.destination];
    if (!adapter) {
      results.push(await processIntegrationOutboxMessage(message, {
        system: message.destination,
        healthCheck: async () => { throw new Error("No adapter configured"); },
        resolveCustomer: async () => { throw new Error("No adapter configured"); },
        resolveProduct: async () => { throw new Error("No adapter configured"); },
        resolvePrice: async () => { throw new Error("No adapter configured"); },
        resolveAvailability: async () => { throw new Error("No adapter configured"); },
        submitOrder: async () => { throw new Error(`No adapter configured for ${message.destination}`); },
        getOrderStatus: async () => { throw new Error("No adapter configured"); },
      }, input.maxAttempts));
      continue;
    }
    results.push(await processIntegrationOutboxMessage(message, adapter, input.maxAttempts));
  }
  return { claimed: messages.length, results };
}
