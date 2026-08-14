import { Prisma, type IntegrationInbox, type IntegrationOutbox } from "@prisma/client";
import { db } from "../index";
import { requireCurrentAdminActor } from "./checkout-invariants";

const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 8;

export type IntegrationLease = Pick<
  IntegrationOutbox,
  "id" | "tenantKey" | "connectionId" | "leaseOwner" | "leaseExpiresAt" | "fencingToken" | "attempts"
>;
export type IntegrationInboxLease = Pick<IntegrationInbox, "id" | "leaseOwner" | "leaseExpiresAt" | "fencingToken" | "attempts">;

export class StaleIntegrationLeaseError extends Error {
  constructor(id: string) {
    super(`Integration lease is stale or no longer owned: ${id}`);
    this.name = "StaleIntegrationLeaseError";
  }
}

function boundedLimit(limit: number) {
  return Math.max(1, Math.min(100, Math.trunc(limit || 1)));
}

function retryDelayMs(attempts: number) {
  // 15s, 30s, 60s ... capped at 1h, with no jitter persisted here. Workers may
  // add small fetch jitter; the durable schedule remains easy to audit.
  return Math.min(60 * 60 * 1000, 15_000 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Atomically leases due integration messages using PostgreSQL SKIP LOCKED.
 * Multiple workers can call this concurrently without claiming the same rows.
 * A stale PROCESSING row becomes claimable after its lease timestamp.
 */
export async function claimIntegrationOutbox(input: {
  workerId: string;
  destination?: string;
  limit?: number;
  leaseMs?: number;
}): Promise<IntegrationOutbox[]> {
  const workerId = input.workerId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{1,127}$/.test(workerId)) throw new Error("A stable integration worker id is required");
  const limit = boundedLimit(input.limit ?? 20);
  const leaseMs = Math.max(30_000, Math.min(30 * 60 * 1000, input.leaseMs ?? DEFAULT_LEASE_MS));
  const leaseUntil = new Date(Date.now() + leaseMs);

  return db.$transaction(async (tx) => {
    const destination = input.destination
      ? Prisma.sql`AND "destination" = ${input.destination}`
      : Prisma.empty;
    return tx.$queryRaw<IntegrationOutbox[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "IntegrationOutbox"
        WHERE (
          ("status" IN ('PENDING', 'RETRY') AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW()))
          OR ("status" = 'PROCESSING' AND "leaseExpiresAt" <= NOW())
        )
        ${destination}
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "IntegrationOutbox" AS outbox
      SET "status" = 'PROCESSING',
          "attempts" = outbox."attempts" + 1,
          "nextAttemptAt" = NULL,
          "leaseOwner" = ${workerId},
          "leaseExpiresAt" = ${leaseUntil},
          "fencingToken" = outbox."fencingToken" + 1,
          "lastError" = NULL
      FROM candidates
      WHERE outbox."id" = candidates."id"
      RETURNING outbox.*
    `);
  });
}

function activeLeaseWhere(lease: IntegrationLease) {
  if (!lease.leaseOwner) throw new StaleIntegrationLeaseError(lease.id);
  return {
    id: lease.id,
    status: "PROCESSING",
    leaseOwner: lease.leaseOwner,
    fencingToken: lease.fencingToken,
    leaseExpiresAt: { gt: new Date() },
  } as const;
}

export async function finalizeOrderIntegrationOutbox(
  lease: IntegrationLease,
  result:
    | { disposition: "ACCEPTED"; system: string; orderId: string; externalOrderId: string; correlationId: string; authoritativeTotals?: Prisma.InputJsonValue }
    | { disposition: "REJECTED"; system: string; orderId: string; reason: string; correlationId: string; authoritativeTotals?: Prisma.InputJsonValue },
) {
  return db.$transaction(async (tx) => {
    const completed = await tx.integrationOutbox.updateMany({
      where: activeLeaseWhere(lease),
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        nextAttemptAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    });
    if (completed.count !== 1) throw new StaleIntegrationLeaseError(lease.id);

    const now = new Date();
    const key = { tenantKey_orderId_system: { tenantKey: lease.tenantKey, orderId: result.orderId, system: result.system } };
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`erp-state:${lease.tenantKey}:${result.orderId}:${result.system}`}))`);
    const current = await tx.orderIntegrationState.findUnique({ where: key });
    if (current && ["ACCEPTED", "REJECTED"].includes(current.state) && current.state !== result.disposition) {
      throw new Error(`ERP terminal state is monotonic: ${current.state} cannot become ${result.disposition}`);
    }
    if (result.disposition === "ACCEPTED") {
      return tx.orderIntegrationState.upsert({
        where: key,
        update: {
          state: "ACCEPTED",
          externalOrderId: result.externalOrderId,
          correlationId: result.correlationId,
          authoritativeTotals: result.authoritativeTotals,
          lastValidatedAt: now,
          lastAttemptAt: now,
          acceptedAt: now,
          rejectedAt: null,
          rejectionReason: null,
        },
        create: {
          tenantKey: lease.tenantKey,
          orderId: result.orderId,
          system: result.system,
          state: "ACCEPTED",
          externalOrderId: result.externalOrderId,
          correlationId: result.correlationId,
          authoritativeTotals: result.authoritativeTotals,
          lastValidatedAt: now,
          lastAttemptAt: now,
          acceptedAt: now,
        },
      });
    }
    return tx.orderIntegrationState.upsert({
      where: key,
      update: {
        state: "REJECTED",
        correlationId: result.correlationId,
        authoritativeTotals: result.authoritativeTotals,
        lastValidatedAt: now,
        lastAttemptAt: now,
        acceptedAt: null,
        rejectedAt: now,
        rejectionReason: result.reason.slice(0, 4000),
      },
      create: {
        tenantKey: lease.tenantKey,
        orderId: result.orderId,
        system: result.system,
        state: "REJECTED",
        correlationId: result.correlationId,
        authoritativeTotals: result.authoritativeTotals,
        lastValidatedAt: now,
        lastAttemptAt: now,
        rejectedAt: now,
        rejectionReason: result.reason.slice(0, 4000),
      },
    });
  });
}

export async function heartbeatIntegrationOutbox(lease: IntegrationLease, leaseMs = DEFAULT_LEASE_MS) {
  const boundedLeaseMs = Math.max(30_000, Math.min(30 * 60 * 1000, leaseMs));
  const leaseExpiresAt = new Date(Date.now() + boundedLeaseMs);
  const result = await db.integrationOutbox.updateMany({
    where: activeLeaseWhere(lease),
    data: { leaseExpiresAt },
  });
  if (result.count !== 1) throw new StaleIntegrationLeaseError(lease.id);
  return { ...lease, leaseExpiresAt };
}

export async function completeIntegrationOutbox(lease: IntegrationLease) {
  const result = await db.integrationOutbox.updateMany({
    where: activeLeaseWhere(lease),
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      nextAttemptAt: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: null,
    },
  });
  if (result.count !== 1) throw new StaleIntegrationLeaseError(lease.id);
}

export async function failIntegrationOutbox(
  lease: IntegrationLease,
  error: unknown,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
) {
  const message = error instanceof Error ? error.message : String(error || "Unknown integration failure");
  const dead = lease.attempts >= Math.max(1, maxAttempts);
  const nextAttemptAt = dead ? null : new Date(Date.now() + retryDelayMs(lease.attempts));

  const result = await db.integrationOutbox.updateMany({
    where: activeLeaseWhere(lease),
    data: {
      status: dead ? "DEAD" : "RETRY",
      nextAttemptAt,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: message.slice(0, 4000),
    },
  });
  if (result.count !== 1) throw new StaleIntegrationLeaseError(lease.id);
  return { dead, nextAttemptAt };
}

export async function redriveIntegrationOutbox(id: string, actorId: string) {
  if (!actorId) throw new Error("Manual redrive actor is required");
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, actorId);
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-redrive:${id}`}))`);
    const row = await tx.integrationOutbox.findUnique({ where: { id } });
    if (!row) throw new Error("Integration outbox message not found");
    if (!["DEAD", "RETRY"].includes(row.status)) {
      throw new Error("Only failed or dead-letter integration messages can be redriven");
    }
    const updated = await tx.integrationOutbox.update({
      where: { id },
      data: {
        status: "PENDING",
        nextAttemptAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
        processedAt: null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        entityType: "IntegrationOutbox",
        entityId: id,
        action: "STATUS_CHANGE",
        before: { status: row.status, attempts: row.attempts, lastError: row.lastError },
        after: { status: updated.status, action: "MANUAL_REDRIVE", destination: updated.destination },
      },
    });
    return updated;
  });
}

/** First receipt wins. Replays return the original inbox row without mutating evidence. */
export async function recordIntegrationInbound(input: {
  tenantKey?: string;
  source: string;
  externalEventId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
}): Promise<{ row: IntegrationInbox; replay: boolean }> {
  const tenantKey = input.tenantKey ?? "default";
  const key = {
    tenantKey_source_externalEventId: {
      tenantKey,
      source: input.source,
      externalEventId: input.externalEventId,
    },
  } as const;

  const existing = await db.integrationInbox.findUnique({ where: key });
  if (existing) return { row: existing, replay: true };

  try {
    const row = await db.integrationInbox.create({
      data: {
        tenantKey,
        source: input.source,
        externalEventId: input.externalEventId,
        eventType: input.eventType,
        payload: input.payload,
      },
    });
    return { row, replay: false };
  } catch (error) {
    // Concurrent duplicate receipt: unique constraint is the final idempotency fence.
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
      const row = await db.integrationInbox.findUnique({ where: key });
      if (row) return { row, replay: true };
    }
    throw error;
  }
}

export async function claimIntegrationInbox(input: {
  workerId: string;
  source?: string;
  limit?: number;
  leaseMs?: number;
} | string, legacyLimit = 20, legacyLeaseMs = DEFAULT_LEASE_MS) {
  const options = typeof input === "string"
    ? { workerId: input, limit: legacyLimit, leaseMs: legacyLeaseMs }
    : input;
  const workerId = options.workerId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{1,127}$/.test(workerId)) throw new Error("A stable integration worker id is required");
  const leaseUntil = new Date(Date.now() + Math.max(30_000, Math.min(30 * 60 * 1000, options.leaseMs ?? DEFAULT_LEASE_MS)));
  const source = "source" in options && options.source ? Prisma.sql`AND "source" = ${options.source}` : Prisma.empty;
  return db.$transaction((tx) => tx.$queryRaw<IntegrationInbox[]>(Prisma.sql`
    WITH candidates AS (
      SELECT "id" FROM "IntegrationInbox"
      WHERE (("status" IN ('RECEIVED','RETRY') AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW()))
        OR ("status" = 'PROCESSING' AND "leaseExpiresAt" <= NOW()))
      ${source}
      ORDER BY "receivedAt" FOR UPDATE SKIP LOCKED LIMIT ${boundedLimit(options.limit ?? 20)}
    ) UPDATE "IntegrationInbox" AS inbox SET "status"='PROCESSING', "attempts"=inbox."attempts"+1,
      "nextAttemptAt"=NULL, "leaseOwner"=${workerId}, "leaseExpiresAt"=${leaseUntil},
      "fencingToken"=inbox."fencingToken"+1, "lastError"=NULL
    FROM candidates WHERE inbox."id"=candidates."id" RETURNING inbox.*`));
}

function activeInboxLeaseWhere(lease: IntegrationInboxLease) {
  if (!lease.leaseOwner) throw new StaleIntegrationLeaseError(lease.id);
  return { id: lease.id, status: "PROCESSING", leaseOwner: lease.leaseOwner, fencingToken: lease.fencingToken, leaseExpiresAt: { gt: new Date() } } as const;
}

export async function markIntegrationInboxProcessed(lease: IntegrationInboxLease) {
  const result = await db.integrationInbox.updateMany({
    where: activeInboxLeaseWhere(lease),
    data: { status: "PROCESSED", processedAt: new Date(), leaseOwner: null, leaseExpiresAt: null, lastError: null },
  });
  if (result.count !== 1) throw new StaleIntegrationLeaseError(lease.id);
}

export async function heartbeatIntegrationInbox(lease: IntegrationInboxLease, leaseMs = DEFAULT_LEASE_MS) {
  const leaseExpiresAt = new Date(Date.now() + Math.max(30_000, Math.min(30 * 60 * 1000, leaseMs)));
  const result = await db.integrationInbox.updateMany({
    where: activeInboxLeaseWhere(lease),
    data: { leaseExpiresAt },
  });
  if (result.count !== 1) throw new StaleIntegrationLeaseError(lease.id);
  return { ...lease, leaseExpiresAt };
}

/**
 * Runs a database-backed inbound handler and its fenced acknowledgement in one
 * transaction. If the lease expires or ownership changes, both the handler's
 * writes and the acknowledgement roll back together.
 */
export async function finalizeIntegrationInboxWithHandler(
  lease: IntegrationInboxLease,
  handler: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  return db.$transaction(async (tx) => {
    const owned = await tx.integrationInbox.findFirst({ where: activeInboxLeaseWhere(lease), select: { id: true } });
    if (!owned) throw new StaleIntegrationLeaseError(lease.id);
    await handler(tx);
    const result = await tx.integrationInbox.updateMany({
      where: activeInboxLeaseWhere(lease),
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        nextAttemptAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    });
    if (result.count !== 1) throw new StaleIntegrationLeaseError(lease.id);
  });
}

export async function markIntegrationInboxFailed(lease: IntegrationInboxLease, error: unknown, maxAttempts = DEFAULT_MAX_ATTEMPTS) {
  const message = error instanceof Error ? error.message : String(error || "Unknown integration processing failure");
  const dead = lease.attempts >= maxAttempts;
  const result = await db.integrationInbox.updateMany({
    where: activeInboxLeaseWhere(lease),
    data: { status: dead ? "DEAD" : "RETRY", nextAttemptAt: dead ? null : new Date(Date.now() + retryDelayMs(lease.attempts)), leaseOwner: null, leaseExpiresAt: null, lastError: message.slice(0, 4000) },
  });
  if (result.count !== 1) throw new StaleIntegrationLeaseError(lease.id);
  return { dead };
}

export async function redriveIntegrationInbox(id: string, actorId: string) {
  if (!actorId) throw new Error("Manual redrive actor is required");
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, actorId);
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-inbox-redrive:${id}`}))`);
    const row = await tx.integrationInbox.findUnique({ where: { id } });
    if (!row) throw new Error("Integration inbox message not found");
    if (!['DEAD', 'RETRY'].includes(row.status)) throw new Error("Only failed or dead-letter inbound messages can be redriven");
    const updated = await tx.integrationInbox.update({
      where: { id },
      data: { status: "RECEIVED", nextAttemptAt: new Date(), leaseOwner: null, leaseExpiresAt: null, lastError: null, processedAt: null },
    });
    await tx.auditLog.create({ data: {
      actorId,
      entityType: "IntegrationInbox",
      entityId: id,
      action: "STATUS_CHANGE",
      before: { status: row.status, attempts: row.attempts, lastError: row.lastError },
      after: { status: updated.status, action: "MANUAL_REDRIVE", source: updated.source },
    } });
    return updated;
  });
}

export async function markOrderIntegrationAccepted(input: {
  tenantKey?: string;
  orderId: string;
  system: string;
  externalOrderId: string;
  correlationId?: string;
  authoritativeTotals?: Prisma.InputJsonValue;
}) {
  const tenantKey = input.tenantKey ?? "default";
  const now = new Date();
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`erp-state:${tenantKey}:${input.orderId}:${input.system}`}))`);
    const current = await tx.orderIntegrationState.findUnique({ where: { tenantKey_orderId_system: { tenantKey, orderId: input.orderId, system: input.system } } });
    if (current?.state === "REJECTED") throw new Error("ERP terminal state is monotonic: REJECTED cannot become ACCEPTED");
    return tx.orderIntegrationState.upsert({
    where: { tenantKey_orderId_system: { tenantKey, orderId: input.orderId, system: input.system } },
    update: {
      state: "ACCEPTED",
      externalOrderId: input.externalOrderId,
      correlationId: input.correlationId,
      authoritativeTotals: input.authoritativeTotals,
      lastValidatedAt: now,
      lastAttemptAt: now,
      acceptedAt: now,
      rejectedAt: null,
      rejectionReason: null,
    },
    create: {
      tenantKey,
      orderId: input.orderId,
      system: input.system,
      state: "ACCEPTED",
      externalOrderId: input.externalOrderId,
      correlationId: input.correlationId,
      authoritativeTotals: input.authoritativeTotals,
      lastValidatedAt: now,
      lastAttemptAt: now,
      acceptedAt: now,
    },
    });
  });
}

export async function markOrderIntegrationRejected(input: {
  tenantKey?: string;
  orderId: string;
  system: string;
  reason: string;
  correlationId?: string;
  authoritativeTotals?: Prisma.InputJsonValue;
}) {
  const tenantKey = input.tenantKey ?? "default";
  const now = new Date();
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`erp-state:${tenantKey}:${input.orderId}:${input.system}`}))`);
    const current = await tx.orderIntegrationState.findUnique({ where: { tenantKey_orderId_system: { tenantKey, orderId: input.orderId, system: input.system } } });
    if (current?.state === "ACCEPTED") throw new Error("ERP terminal state is monotonic: ACCEPTED cannot become REJECTED");
    return tx.orderIntegrationState.upsert({
    where: { tenantKey_orderId_system: { tenantKey, orderId: input.orderId, system: input.system } },
    update: {
      state: "REJECTED",
      correlationId: input.correlationId,
      authoritativeTotals: input.authoritativeTotals,
      lastValidatedAt: now,
      lastAttemptAt: now,
      acceptedAt: null,
      rejectedAt: now,
      rejectionReason: input.reason.slice(0, 4000),
    },
    create: {
      tenantKey,
      orderId: input.orderId,
      system: input.system,
      state: "REJECTED",
      correlationId: input.correlationId,
      authoritativeTotals: input.authoritativeTotals,
      lastValidatedAt: now,
      lastAttemptAt: now,
      rejectedAt: now,
      rejectionReason: input.reason.slice(0, 4000),
    },
    });
  });
}

export async function getIntegrationOperationalSummary(tenantKey = "default") {
  const [connections, pending, processing, retry, dead, inboxStates, orderStates] = await Promise.all([
    db.integrationConnection.findMany({
      where: { tenantKey },
      orderBy: [{ system: "asc" }, { name: "asc" }],
    }),
    db.integrationOutbox.count({ where: { tenantKey, status: "PENDING" } }),
    db.integrationOutbox.count({ where: { tenantKey, status: "PROCESSING" } }),
    db.integrationOutbox.count({ where: { tenantKey, status: "RETRY" } }),
    db.integrationOutbox.count({ where: { tenantKey, status: "DEAD" } }),
    db.integrationInbox.groupBy({
      by: ["status"],
      where: { tenantKey },
      _count: { _all: true },
    }),
    db.orderIntegrationState.groupBy({
      by: ["state"],
      where: { tenantKey },
      _count: { _all: true },
    }),
  ]);

  return {
    connections,
    outbox: { pending, processing, retry, dead },
    inbox: Object.fromEntries(inboxStates.map((row) => [row.status.toLowerCase(), row._count._all])) as Record<string, number>,
    orderStates: Object.fromEntries(orderStates.map((row) => [row.state, row._count._all])),
  };
}
