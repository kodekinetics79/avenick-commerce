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
export * from "./services/inventory";
export * from "./services/admin";
export * from "./services/audit";
export * from "./services/health";
export * from "./services/finance";
export * from "./services/workflow";
export * from "./services/warehouse";
export * from "./services/analytics";
export * from "./services/rfq";
