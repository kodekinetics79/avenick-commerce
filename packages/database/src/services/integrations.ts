import { Prisma, type IntegrationInbox, type IntegrationOutbox } from "@prisma/client";
import { db } from "../index";

const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 8;

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
  destination?: string;
  limit?: number;
  leaseMs?: number;
} = {}): Promise<IntegrationOutbox[]> {
  const limit = boundedLimit(input.limit ?? 20);
  const leaseMs = Math.max(30_000, Math.min(30 * 60 * 1000, input.leaseMs ?? DEFAULT_LEASE_MS));
  const leaseUntil = new Date(Date.now() + leaseMs);

  return db.$transaction(async (tx) => {
    const ids = input.destination
      ? await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id"
          FROM "IntegrationOutbox"
          WHERE "destination" = ${input.destination}
            AND (
              ("status" IN ('PENDING', 'RETRY') AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW()))
              OR ("status" = 'PROCESSING' AND "nextAttemptAt" <= NOW())
            )
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        `)
      : await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id"
          FROM "IntegrationOutbox"
          WHERE (
            ("status" IN ('PENDING', 'RETRY') AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW()))
            OR ("status" = 'PROCESSING' AND "nextAttemptAt" <= NOW())
          )
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        `);

    if (ids.length === 0) return [];
    const claimIds = ids.map((row) => row.id);
    await tx.integrationOutbox.updateMany({
      where: { id: { in: claimIds } },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        nextAttemptAt: leaseUntil,
        lastError: null,
      },
    });

    return tx.integrationOutbox.findMany({
      where: { id: { in: claimIds } },
      orderBy: { createdAt: "asc" },
    });
  });
}

export async function completeIntegrationOutbox(id: string) {
  return db.integrationOutbox.update({
    where: { id },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      nextAttemptAt: null,
      lastError: null,
    },
  });
}

export async function failIntegrationOutbox(
  id: string,
  error: unknown,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
) {
  const row = await db.integrationOutbox.findUnique({ where: { id } });
  if (!row) throw new Error("Integration outbox message not found");
  const message = error instanceof Error ? error.message : String(error || "Unknown integration failure");
  const dead = row.attempts >= Math.max(1, maxAttempts);

  return db.integrationOutbox.update({
    where: { id },
    data: {
      status: dead ? "DEAD" : "RETRY",
      nextAttemptAt: dead ? null : new Date(Date.now() + retryDelayMs(row.attempts)),
      lastError: message.slice(0, 4000),
    },
  });
}

export async function redriveIntegrationOutbox(id: string) {
  const row = await db.integrationOutbox.findUnique({ where: { id } });
  if (!row) throw new Error("Integration outbox message not found");
  if (!["DEAD", "RETRY"].includes(row.status)) {
    throw new Error("Only failed or dead-letter integration messages can be redriven");
  }
  return db.integrationOutbox.update({
    where: { id },
    data: { status: "PENDING", nextAttemptAt: new Date(), lastError: null, processedAt: null },
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

export async function markIntegrationInboxProcessed(id: string) {
  return db.integrationInbox.update({
    where: { id },
    data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
  });
}

export async function markIntegrationInboxFailed(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown integration processing failure");
  return db.integrationInbox.update({
    where: { id },
    data: { status: "FAILED", lastError: message.slice(0, 4000) },
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
  return db.orderIntegrationState.upsert({
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
  return db.orderIntegrationState.upsert({
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
}

export async function getIntegrationOperationalSummary(tenantKey = "default") {
  const [connections, pending, processing, retry, dead, receivedFailed, orderStates] = await Promise.all([
    db.integrationConnection.findMany({
      where: { tenantKey },
      orderBy: [{ system: "asc" }, { name: "asc" }],
    }),
    db.integrationOutbox.count({ where: { tenantKey, status: "PENDING" } }),
    db.integrationOutbox.count({ where: { tenantKey, status: "PROCESSING" } }),
    db.integrationOutbox.count({ where: { tenantKey, status: "RETRY" } }),
    db.integrationOutbox.count({ where: { tenantKey, status: "DEAD" } }),
    db.integrationInbox.count({ where: { tenantKey, status: "FAILED" } }),
    db.orderIntegrationState.groupBy({
      by: ["state"],
      where: { tenantKey },
      _count: { _all: true },
    }),
  ]);

  return {
    connections,
    outbox: { pending, processing, retry, dead },
    inbox: { failed: receivedFailed },
    orderStates: Object.fromEntries(orderStates.map((row) => [row.state, row._count._all])),
  };
}
