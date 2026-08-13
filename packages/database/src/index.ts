import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

// Singleton pattern — prevents multiple connections in dev with hot reload
export const db: PrismaClient =
  globalThis.__prisma ?? (globalThis.__prisma = createPrismaClient());

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__prisma = db;
}

export * from "@prisma/client";
export * from "./services/listing-health";
export * from "./services/products";
export * from "./services/orders";
export * from "./services/secure-checkout";
export * from "./services/checkout-invariants";
export * from "./services/commerce-governance";
export * from "./services/payments";
export * from "./services/seller-fulfillment";
export * from "./services/b2b-purchase-orders";
export * from "./services/promotions";
// Node-only pilot catalog ingestion is intentionally NOT re-exported here.
// Customer/seller middleware imports this shared barrel; exporting the importer
// would pull node:crypto/bcrypt into browser/edge bundles. Admin and CLI callers
// use the explicit @avenick/database/pilot-catalog subpath instead.
export * from "./services/integrations";
export * from "./services/integration-worker";
export * from "./services/erp-adapter";
export * from "./services/inventory";
export * from "./services/admin";
export * from "./services/audit";
export * from "./services/health";
export * from "./services/finance";
export * from "./services/workflow";
export * from "./services/warehouse";
export * from "./services/analytics";
export * from "./services/rfq";
export * from "./services/data-rights";

// Resilience layer: circuit breaker, timeouts/retries, and cache fallback that
// keep reads available and writes fail-fast when Postgres is degraded.
export {
  resilient,
  dbCircuitState,
  CircuitOpenError,
  DbTimeoutError,
  type ResilienceConfig,
  type ResilientOptions,
} from "./resilience";
export {
  cachedRead,
  setCacheStore,
  type CacheStore,
  type CacheEntry,
  type CachedResult,
} from "./cache";
export { read, write, type ReadOptions } from "./resilient-ops";
