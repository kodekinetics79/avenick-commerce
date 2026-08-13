import { Prisma, type IntegrationConnection, type IntegrationInbox, type IntegrationOutbox } from "@prisma/client";
import { DeterministicCertificationErpAdapter, HttpErpAdapter, type ErpAdapter, type ErpSubmitOrder } from "./erp-adapter";
import { db } from "../index";
import { governedIntegrationPolicy } from "./integration-policy";
import {
  claimIntegrationOutbox,
  claimIntegrationInbox,
  failIntegrationOutbox,
  finalizeIntegrationInboxWithHandler,
  finalizeOrderIntegrationOutbox,
  heartbeatIntegrationInbox,
  heartbeatIntegrationOutbox,
  markIntegrationInboxFailed,
  type IntegrationInboxLease,
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
    limit: input.limit ?? 1,
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

export type IntegrationInboxHandlerContext = {
  message: IntegrationInbox;
  /** Stable across retries; external calls must use this as their idempotency key. */
  idempotencyKey: string;
  tx: Prisma.TransactionClient;
};

export type IntegrationInboxHandler = (context: IntegrationInboxHandlerContext) => Promise<void>;
export type IntegrationInboxHandlers = Record<string, IntegrationInboxHandler>;

export function integrationInboxHandlerKey(source: string, eventType: string) {
  return `${source}:${eventType}`;
}

function findInboxHandler(message: IntegrationInbox, handlers: IntegrationInboxHandlers) {
  return handlers[integrationInboxHandlerKey(message.source, message.eventType)]
    ?? handlers[integrationInboxHandlerKey("*", message.eventType)];
}

export async function processIntegrationInboxMessage(
  message: IntegrationInbox,
  handler: IntegrationInboxHandler,
  maxAttempts = 8,
) {
  let activeLease = message as IntegrationInboxLease;
  let heartbeatError: unknown;
  const heartbeat = setInterval(() => {
    void heartbeatIntegrationInbox(activeLease)
      .then((renewed) => { activeLease = renewed; })
      .catch((error) => { heartbeatError = error; });
  }, 10_000);
  try {
    if (heartbeatError) throw heartbeatError;
    await finalizeIntegrationInboxWithHandler(activeLease, async (tx) => {
      await handler({
        message,
        idempotencyKey: `${message.tenantKey}:${message.source}:${message.externalEventId}`,
        tx,
      });
    });
    return { status: "PROCESSED" as const };
  } catch (error) {
    await markIntegrationInboxFailed(activeLease, error, maxAttempts);
    return { status: message.attempts >= maxAttempts ? "DEAD" as const : "RETRY" as const, error };
  } finally {
    clearInterval(heartbeat);
  }
}

export async function runIntegrationInboxWorkerOnce(input: {
  workerId: string;
  handlers: IntegrationInboxHandlers;
  source?: string;
  limit?: number;
  leaseMs?: number;
  maxAttempts?: number;
}) {
  const messages = await claimIntegrationInbox({
    workerId: input.workerId,
    source: input.source,
    limit: input.limit ?? 1,
    leaseMs: input.leaseMs,
  });
  const results = [];
  for (const message of messages) {
    const handler = findInboxHandler(message, input.handlers);
    const selected = handler ?? (async () => {
      throw new Error(`No inbound integration handler configured for ${message.source}/${message.eventType}`);
    });
    results.push(await processIntegrationInboxMessage(message, selected, input.maxAttempts));
  }
  return { claimed: messages.length, results };
}

/**
 * Built-in ERP order-status handler. Database writes and inbox acknowledgement
 * commit together, and terminal ERP outcomes cannot be reversed by a replay.
 */
const orderStatusHandler: IntegrationInboxHandler = async ({ message, tx }) => {
  const payload = asObject(message.payload);
  const orderId = string(payload.orderId, "orderId");
  const system = typeof payload.system === "string" && payload.system.trim() ? payload.system : message.source;
  const status = string(payload.status, "status").toUpperCase();
  if (!["ACCEPTED", "REJECTED"].includes(status)) throw new Error(`Unsupported inbound ERP order status: ${status}`);
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) throw new Error("Inbound ERP status references an unknown order");
  const key = { tenantKey_orderId_system: { tenantKey: message.tenantKey, orderId, system } };
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`erp-state:${message.tenantKey}:${orderId}:${system}`}))`);
  const current = await tx.orderIntegrationState.findUnique({ where: key });
  if (current && ["ACCEPTED", "REJECTED"].includes(current.state) && current.state !== status) {
    throw new Error(`ERP terminal state is monotonic: ${current.state} cannot become ${status}`);
  }
  const now = new Date();
  const data = {
      state: status,
      externalOrderId: typeof payload.externalOrderId === "string" ? payload.externalOrderId : current?.externalOrderId,
      correlationId: typeof payload.correlationId === "string" ? payload.correlationId : current?.correlationId,
      lastValidatedAt: now,
      ...(status === "ACCEPTED"
        ? { acceptedAt: current?.acceptedAt ?? now, rejectedAt: null, rejectionReason: null }
        : { rejectedAt: current?.rejectedAt ?? now, rejectionReason: typeof payload.reason === "string" ? payload.reason.slice(0, 4000) : "ERP_REJECTED" }),
  };
  if (current) {
    const changed = await tx.orderIntegrationState.updateMany({
      where: { id: current.id, state: current.state },
      data,
    });
    if (changed.count !== 1) throw new Error("ERP state changed concurrently; retry the inbound event");
  } else {
    await tx.orderIntegrationState.create({ data: {
      tenantKey: message.tenantKey,
      orderId,
      system,
      state: status,
      externalOrderId: typeof payload.externalOrderId === "string" ? payload.externalOrderId : undefined,
      correlationId: typeof payload.correlationId === "string" ? payload.correlationId : undefined,
      lastValidatedAt: now,
      ...(status === "ACCEPTED"
        ? { acceptedAt: now }
        : { rejectedAt: now, rejectionReason: typeof payload.reason === "string" ? payload.reason.slice(0, 4000) : "ERP_REJECTED" }),
    } });
  }
};

export const DEPLOYED_INTEGRATION_INBOX_HANDLERS: IntegrationInboxHandlers = {
  "*:ORDER_STATUS": orderStatusHandler,
  "*:ORDER_STATUS_CHANGED": orderStatusHandler,
};

export async function resolveAdapterForConnection(connection: IntegrationConnection): Promise<ErpAdapter> {
  if (!connection?.baseUrl || !connection.credentialsRef) throw new Error("ERP_DISCONNECTED_PILOT: live ERP connection is unavailable");
  if (connection.system === "CERTIFICATION_ERP" && process.env.ERP_CERTIFICATION_MODE === "true") {
    return new DeterministicCertificationErpAdapter("ACCEPT");
  }
  const policy = governedIntegrationPolicy({
    system: connection.system,
    baseUrl: connection.baseUrl,
    credentialsRef: connection.credentialsRef,
  });
  const token = process.env[policy.credentialEnvironmentKey];
  if (!token) throw new Error("ERP_DISCONNECTED_PILOT: ERP credential is not present at runtime");
  return new HttpErpAdapter(connection.system, policy.baseUrl, token);
}

export async function resolveAdapterForMessage(message: IntegrationOutbox): Promise<ErpAdapter> {
  if (!message.connectionId) throw new Error("ERP_DISCONNECTED_PILOT: outbox message has no governed connection");
  const connection = await db.integrationConnection.findFirst({
    where: { id: message.connectionId, tenantKey: message.tenantKey, system: message.destination, status: "ACTIVE" },
  });
  if (!connection) throw new Error("ERP_DISCONNECTED_PILOT: live ERP connection is unavailable");
  return resolveAdapterForConnection(connection);
}

/**
 * Persist connector health even while queues are idle. `lastHealthCheckAt` is
 * first claimed with a conditional write, so multiple workers do not all probe
 * the same provider. A crash merely defers the next probe until the interval.
 */
export async function probeDueIntegrationConnections(input: {
  now?: Date;
  minIntervalMs?: number;
  limit?: number;
  connectionId?: string;
  resolveAdapter?: (connection: IntegrationConnection) => Promise<ErpAdapter>;
} = {}) {
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - Math.max(10_000, input.minIntervalMs ?? 60_000));
  const candidates = await db.integrationConnection.findMany({
    where: { status: "ACTIVE", ...(input.connectionId ? { id: input.connectionId } : {}), OR: [{ lastHealthCheckAt: null }, { lastHealthCheckAt: { lte: cutoff } }] },
    orderBy: { lastHealthCheckAt: { sort: "asc", nulls: "first" } },
    take: Math.max(1, Math.min(20, input.limit ?? 1)),
  });
  const outcomes = [];
  for (const connection of candidates) {
    const claimed = await db.integrationConnection.updateMany({
      where: {
        id: connection.id,
        status: "ACTIVE",
        OR: [{ lastHealthCheckAt: null }, { lastHealthCheckAt: { lte: cutoff } }],
      },
      data: { lastHealthCheckAt: now },
    });
    if (claimed.count !== 1) continue;
    try {
      const adapter = await (input.resolveAdapter ?? resolveAdapterForConnection)(connection);
      const health = await adapter.healthCheck();
      if (!health.ok) throw new Error(`Integration ${connection.system} health check failed`);
      await db.integrationConnection.update({
        where: { id: connection.id },
        data: { lastSuccessAt: new Date(), lastError: null },
      });
      outcomes.push({ connectionId: connection.id, ok: true as const });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Integration health check failed");
      await db.integrationConnection.update({
        where: { id: connection.id },
        data: { lastFailureAt: new Date(), lastError: message.slice(0, 4000) },
      });
      outcomes.push({ connectionId: connection.id, ok: false as const, error: message });
    }
  }
  return outcomes;
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

async function recordConnectionEvidence(connectionId: string | null, ok: boolean, error?: unknown) {
  if (!connectionId) return;
  const now = new Date();
  await db.integrationConnection.updateMany({
    where: { id: connectionId },
    data: ok
      ? { lastHealthCheckAt: now, lastSuccessAt: now, lastError: null }
      : { lastHealthCheckAt: now, lastFailureAt: now, lastError: String(error ?? "Integration transaction failed").slice(0, 4000) },
  }).catch(() => undefined);
}

export async function runGovernedIntegrationWorkerOnce(workerId: string) {
  await recordWorkerHeartbeat(workerId);
  const outbound = await claimIntegrationOutbox({ workerId, limit: 1 });
  let outboundResult: unknown;
  if (outbound[0]) {
    await recordWorkerHeartbeat(workerId, "CLAIM");
    try {
      const adapter = await resolveAdapterForMessage(outbound[0]);
      outboundResult = await processIntegrationOutboxMessage(outbound[0], adapter);
      const status = (outboundResult as { status: string }).status;
      await recordWorkerHeartbeat(workerId, status === "ACCEPTED" || status === "REJECTED" ? "SUCCESS" : "FAILURE", status);
      await recordConnectionEvidence(
        outbound[0].connectionId,
        status === "ACCEPTED" || status === "REJECTED",
        (outboundResult as { error?: unknown }).error ?? status,
      );
    } catch (error) {
      await failIntegrationOutbox(outbound[0], error);
      await recordWorkerHeartbeat(workerId, "FAILURE", error);
      await recordConnectionEvidence(outbound[0].connectionId, false, error);
      outboundResult = { status: "RETRY", error };
    }
  }
  const inbound = await runIntegrationInboxWorkerOnce({
    workerId,
    handlers: DEPLOYED_INTEGRATION_INBOX_HANDLERS,
    limit: 1,
  });
  if (inbound.claimed > 0) {
    await recordWorkerHeartbeat(workerId, "CLAIM");
    for (const result of inbound.results) {
      await recordWorkerHeartbeat(workerId, result.status === "PROCESSED" ? "SUCCESS" : "FAILURE", result.status);
    }
  }
  if (outbound.length === 0 && inbound.claimed === 0) await probeDueIntegrationConnections();
  return { claimed: outbound.length + inbound.claimed, outbound: outboundResult, inbound: inbound.results };
}

export async function getIntegrationRuntimeReadiness(maxHeartbeatAgeMs = 90_000) {
  const cutoff = new Date(Date.now() - maxHeartbeatAgeMs);
  const [activeConnectionRows, healthyWorkers, outboundBacklog, dead, overdue, oldestPending, inboxBacklog, inboxDead, inboxOverdue, oldestInbound] = await Promise.all([
    db.integrationConnection.findMany({
      where: { status: "ACTIVE", system: { in: ["D365", "SAP", "ERP", "CERTIFICATION_ERP"] } },
      select: { lastSuccessAt: true, lastFailureAt: true },
    }),
    db.integrationWorkerHealth.count({ where: { lastHeartbeatAt: { gte: cutoff } } }),
    db.integrationOutbox.count({ where: { status: { in: ["PENDING", "RETRY"] } } }),
    db.integrationOutbox.count({ where: { status: "DEAD" } }),
    db.integrationOutbox.count({ where: { status: "PROCESSING", leaseExpiresAt: { lt: new Date() } } }),
    db.integrationOutbox.findFirst({ where: { status: { in: ["PENDING", "RETRY"] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.integrationInbox.count({ where: { status: { in: ["RECEIVED", "RETRY"] } } }),
    db.integrationInbox.count({ where: { status: "DEAD" } }),
    db.integrationInbox.count({ where: { status: "PROCESSING", leaseExpiresAt: { lt: new Date() } } }),
    db.integrationInbox.findFirst({ where: { status: { in: ["RECEIVED", "RETRY"] } }, orderBy: { receivedAt: "asc" }, select: { receivedAt: true } }),
  ]);
  const activeConnections = activeConnectionRows.length;
  const unhealthyConnections = activeConnectionRows.filter((connection) => connection.lastFailureAt
    && (!connection.lastSuccessAt || connection.lastFailureAt > connection.lastSuccessAt)).length;
  const pendingAgeMs = oldestPending ? Date.now() - oldestPending.createdAt.getTime() : 0;
  const inboundAgeMs = oldestInbound ? Date.now() - oldestInbound.receivedAt.getTime() : 0;
  const hasIntegrationWork = activeConnections > 0 || outboundBacklog > 0 || dead > 0 || overdue > 0
    || inboxBacklog > 0 || inboxDead > 0 || inboxOverdue > 0;
  const degraded = hasIntegrationWork && (healthyWorkers === 0 || unhealthyConnections > 0 || overdue > 0 || dead > 0
    || pendingAgeMs >= 5 * 60_000 || inboxDead > 0 || inboxOverdue > 0 || inboundAgeMs >= 5 * 60_000);
  // Queue/provider health is operational evidence, not a serving dependency for
  // the web portals. Keep HTTP readiness green while exposing degradation for
  // alerts and the Integration Hub; database readiness remains independently fatal.
  return { ok: true, degraded, activeConnections, unhealthyConnections, healthyWorkers, outboundBacklog, dead, overdue, pendingAgeMs, inboxBacklog, inboxDead, inboxOverdue, inboundAgeMs };
}
