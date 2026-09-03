import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Read a positive integer from the environment, falling back when unset or junk.
 */
function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
    /**
     * Interactive-transaction budget, applied to every `$transaction` in the
     * codebase rather than one at a time — 35 of the 36 previously relied on
     * Prisma's 5s default.
     *
     * That default is generous against a local database (~0.1ms/query) and tight
     * against a remote one. Measured: ~12ms/query to a managed Postgres in
     * another region, which is ~125x local and already enough to time out the
     * governed purchase-order transaction. Compute and database in different
     * continents makes it worse again.
     *
     * Defaults are unchanged, so local and CI behave exactly as before. Raise
     * DB_TX_TIMEOUT_MS where latency demands it — but treat needing to as a
     * signal to co-locate compute with the database, not as the fix.
     */
    transactionOptions: {
      maxWait: envInt("DB_TX_MAX_WAIT_MS", 2_000),
      timeout: envInt("DB_TX_TIMEOUT_MS", 5_000),
    },
  });
}

export const db: PrismaClient =
  globalThis.__prisma ?? (globalThis.__prisma = createPrismaClient());

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__prisma = db;
}
