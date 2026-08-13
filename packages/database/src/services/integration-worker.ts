import { Prisma, type IntegrationOutbox } from "@prisma/client";
import { DeterministicCertificationErpAdapter, HttpErpAdapter, type ErpAdapter, type ErpSubmitOrder } from "./erp-adapter";
import { db } from "../index";
import {
  claimIntegrationOutbox,
  failIntegrationOutbox,
  finalizeOrderIntegrationOutbox,
  heartbeatIntegrationOutbox,
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
  let activeLease = lease;
  let heartbeatError: unknown;
  const heartbeat = setInterval(() => {
    void heartbeatIntegrationOutbox(activeLease).then((renewed) => { activeLease = renewed; }).catch((error) => { heartbeatError = error; });
  }, 10_000);
  try {
    const request = toErpSubmitOrder(message);
    const result = await adapter.submitOrder(request);
    if (heartbeatError) throw heartbeatError;
    await finalizeOrderIntegrationOutbox(activeLease, result.disposition === "ACCEPTED" ? {
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
    await failIntegrationOutbox(activeLease, error, maxAttempts);
    return { status: message.attempts >= maxAttempts ? "DEAD" as const : "RETRY" as const, error };
  } finally {
    clearInterval(heartbeat);
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
    limit: 1,
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

export async function resolveAdapterForMessage(message: IntegrationOutbox): Promise<ErpAdapter> {
  if (!message.connectionId) throw new Error("ERP_DISCONNECTED_PILOT: outbox message has no governed connection");
  const connection = await db.integrationConnection.findFirst({
    where: { id: message.connectionId, tenantKey: message.tenantKey, system: message.destination, status: "ACTIVE" },
  });
  if (!connection?.baseUrl || !connection.credentialsRef) throw new Error("ERP_DISCONNECTED_PILOT: live ERP connection is unavailable");
  if (connection.system === "CERTIFICATION_ERP" && process.env.ERP_CERTIFICATION_MODE === "true") {
    return new DeterministicCertificationErpAdapter("ACCEPT");
  }
  if (!connection.credentialsRef.startsWith("env:")) throw new Error("ERP_DISCONNECTED_PILOT: unsupported credential reference");
  const token = process.env[connection.credentialsRef.slice(4)];
  if (!token) throw new Error("ERP_DISCONNECTED_PILOT: ERP credential is not present at runtime");
  return new HttpErpAdapter(connection.system, connection.baseUrl, token);
}

export async function recordWorkerHeartbeat(workerId: string, event?: "CLAIM" | "SUCCESS" | "FAILURE", error?: unknown) {
  const now = new Date();
  return db.integrationWorkerHealth.upsert({
    where: { workerId },
    update: {
      lastHeartbeatAt: now,
      ...(event === "CLAIM" ? { lastClaimAt: now } : {}),
      ...(event === "SUCCESS" ? { lastSuccessAt: now, processedCount: { increment: 1 }, lastError: null } : {}),
      ...(event === "FAILURE" ? { lastFailureAt: now, failedCount: { increment: 1 }, lastError: String(error).slice(0, 4000) } : {}),
    },
    create: {
      workerId,
      startedAt: now,
      lastHeartbeatAt: now,
      ...(event === "CLAIM" ? { lastClaimAt: now } : {}),
      ...(event === "SUCCESS" ? { lastSuccessAt: now, processedCount: 1 } : {}),
      ...(event === "FAILURE" ? { lastFailureAt: now, failedCount: 1, lastError: String(error).slice(0, 4000) } : {}),
    },
  });
}

export async function runGovernedIntegrationWorkerOnce(workerId: string) {
  await recordWorkerHeartbeat(workerId);
  const messages = await claimIntegrationOutbox({ workerId, limit: 1 });
  if (!messages[0]) return { claimed: 0 };
  await recordWorkerHeartbeat(workerId, "CLAIM");
  try {
    const adapter = await resolveAdapterForMessage(messages[0]);
    const result = await processIntegrationOutboxMessage(messages[0], adapter);
    await recordWorkerHeartbeat(workerId, result.status === "ACCEPTED" || result.status === "REJECTED" ? "SUCCESS" : "FAILURE", result.status);
    return { claimed: 1, result };
  } catch (error) {
    await failIntegrationOutbox(messages[0], error);
    await recordWorkerHeartbeat(workerId, "FAILURE", error);
    return { claimed: 1, result: { status: "RETRY", error } };
  }
}

export async function getIntegrationRuntimeReadiness(maxHeartbeatAgeMs = 90_000) {
  const cutoff = new Date(Date.now() - maxHeartbeatAgeMs);
  const [activeConnections, healthyWorkers, dead, overdue, oldestPending] = await Promise.all([
    db.integrationConnection.count({ where: { status: "ACTIVE", system: { in: ["D365", "SAP", "ERP", "CERTIFICATION_ERP"] } } }),
    db.integrationWorkerHealth.count({ where: { lastHeartbeatAt: { gte: cutoff } } }),
    db.integrationOutbox.count({ where: { status: "DEAD" } }),
    db.integrationOutbox.count({ where: { status: "PROCESSING", leaseExpiresAt: { lt: new Date() } } }),
    db.integrationOutbox.findFirst({ where: { status: { in: ["PENDING", "RETRY"] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const pendingAgeMs = oldestPending ? Date.now() - oldestPending.createdAt.getTime() : 0;
  const ok = activeConnections === 0 || (healthyWorkers > 0 && overdue === 0 && dead === 0 && pendingAgeMs < 5 * 60_000);
  return { ok, activeConnections, healthyWorkers, dead, overdue, pendingAgeMs };
}
