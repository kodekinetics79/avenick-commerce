import { describe, expect, it, vi } from "vitest";

/**
 * Pure unit tests: nothing here opens a connection. `../client` is replaced
 * with a `$transaction` that hands the importer an in-memory stand-in for the
 * Prisma transaction client, so the assertions are about the payloads the
 * importer actually builds and the row that actually survives a second import.
 *
 * What is protected here is one decision. `isB2CEnabled` used to be a hardcoded
 * `false` on both product write paths, which meant two separate things were
 * broken at once: no caller could ask for a consumer-sellable product, and a
 * product flagged by hand afterwards was reverted by the next re-import of the
 * same sheet. The default is deliberately still `false` — orders.ts refuses a
 * B2C line whose product lacks the flag, so setting it is a commitment to sell,
 * and imported supplier data does not carry one. What must hold is that the
 * default is a DEFAULT: stateable, and not written over an answer somebody has
 * already given.
 */

const harness = vi.hoisted(() => ({ tx: null as unknown as FakeTx }));

vi.mock("../client", () => ({
  db: {
    $transaction: <T>(run: (tx: unknown) => Promise<T>) => run(harness.tx),
  },
}));

import {
  PILOT_DEFAULT_B2C_ENABLED,
  applyPilotCatalog,
  resolvePilotB2CEnabled,
  validatePilotCatalog,
  type PilotCatalogFile,
} from "../services/pilot-catalog";

type StoredProduct = Record<string, unknown> & { id: string; sku: string; sellerId: string; nameEn: string; nameAr: string; isB2CEnabled: boolean };

/** Deterministic ids, so a seeded product can claim the seller the importer will resolve. */
const sellerIdFor = (sellerKey: string) => `seller-user-pilot.catalog+${sellerKey}@avenick.test`;

/** Prisma treats `undefined` in an update as "leave this column alone". */
const defined = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

type FakeTx = ReturnType<typeof createFakeTx>;

function createFakeTx(seed: StoredProduct[] = []) {
  const products = new Map(seed.map((product) => [product.sku, { ...product }]));
  /** Every `product.upsert` argument the importer produced, in order. */
  const productUpserts: { where: { sku: string }; update: Record<string, unknown>; create: Record<string, unknown> }[] = [];

  const upsertReturningId = (prefix: string) => ({
    upsert: async (args: { where: Record<string, unknown> }) => ({
      id: `${prefix}-${Object.values(args.where).map((value) =>
        typeof value === "object" && value !== null ? Object.values(value).join(":") : String(value),
      ).join(":")}`,
    }),
  });

  return {
    products,
    productUpserts,
    $executeRaw: async () => 0,
    user: {
      ...upsertReturningId("user"),
      findMany: async () => [],
      findUniqueOrThrow: async () => ({ role: "ADMIN" }),
    },
    sellerProfile: upsertReturningId("seller"),
    warehouse: upsertReturningId("wh"),
    inventoryLocation: upsertReturningId("loc"),
    category: upsertReturningId("cat"),
    brand: upsertReturningId("brand"),
    product: {
      findMany: async (args: { where: { sku?: { in: string[] } } }) =>
        [...products.values()]
          .filter((product) => args.where.sku?.in.includes(product.sku) ?? true)
          .map((product) => ({ ...product, commercialMetadata: { sourceSystem: "CLIENT_PILOT_CATALOG" } })),
      upsert: async (args: { where: { sku: string }; update: Record<string, unknown>; create: Record<string, unknown> }) => {
        productUpserts.push(args);
        const existing = products.get(args.where.sku);
        // Exactly Prisma's semantics: update merges into the stored row and an
        // absent key changes nothing; create writes a whole new row.
        const next = existing
          ? { ...existing, ...defined(args.update) }
          : { id: `product-${args.where.sku}`, ...defined(args.create) };
        products.set(args.where.sku, next as StoredProduct);
        return next;
      },
    },
    productCommercialMetadata: { upsert: async () => ({}) },
    productPrice: { deleteMany: async () => ({ count: 0 }), create: async () => ({}) },
    productIssue: { deleteMany: async () => ({ count: 0 }), create: async () => ({}) },
    productImage: { deleteMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
    inventoryStock: {
      findMany: async () => [],
      create: async () => ({}),
      updateMany: async () => ({ count: 1 }),
      delete: async () => ({}),
    },
    auditLog: { create: async () => ({}) },
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    sourceSheet: "Mennekes",
    sourceRow: 2,
    sellerKey: "mennekes",
    sku: "MEN-1000",
    name: "Industrial plug 16A",
    unitPriceSAR: 120,
    ...overrides,
  };
}

const file = (records: Record<string, unknown>[]) => ({ version: 1, records } as unknown as PilotCatalogFile);

async function runImport(records: Record<string, unknown>[], options: Parameters<typeof applyPilotCatalog>[1] = {}, seed: StoredProduct[] = []) {
  harness.tx = createFakeTx(seed);
  const result = await applyPilotCatalog(file(records), options);
  return { result, tx: harness.tx };
}

function seededProduct(overrides: Partial<StoredProduct> = {}): StoredProduct {
  return {
    id: "product-MEN-1000",
    sku: "MEN-1000",
    sellerId: sellerIdFor("mennekes"),
    nameEn: "Industrial plug 16A",
    nameAr: "قابس صناعي",
    isB2CEnabled: false,
    ...overrides,
  };
}

describe("pilot catalog consumer-channel flag", () => {
  it("creates a product quote-only when nothing states a channel", async () => {
    const { result, tx } = await runImport([row()]);

    expect(PILOT_DEFAULT_B2C_ENABLED).toBe(false);
    expect(tx.productUpserts[0]?.create).toMatchObject({ isB2CEnabled: false, isB2BEnabled: true });
    expect(tx.products.get("MEN-1000")?.isB2CEnabled).toBe(false);
    expect(result.rowsFlaggedConsumerSellable).toBe(0);
  });

  it("honours an explicit true on the row", async () => {
    const { result, tx } = await runImport([row({ isB2CEnabled: true })]);

    expect(tx.productUpserts[0]?.create).toMatchObject({ isB2CEnabled: true });
    expect(tx.products.get("MEN-1000")?.isB2CEnabled).toBe(true);
    expect(result.rowsFlaggedConsumerSellable).toBe(1);
  });

  it("honours an explicit true from the import-wide option", async () => {
    const { tx } = await runImport([row()], { defaultB2CEnabled: true });

    expect(tx.products.get("MEN-1000")?.isB2CEnabled).toBe(true);
  });

  it("lets a row override the import-wide option in both directions", async () => {
    const { tx } = await runImport(
      [row({ isB2CEnabled: false }), row({ sourceRow: 3, sku: "MEN-1001", isB2CEnabled: true })],
      { defaultB2CEnabled: true },
    );

    expect(tx.products.get("MEN-1000")?.isB2CEnabled).toBe(false);
    expect(tx.products.get("MEN-1001")?.isB2CEnabled).toBe(true);
  });

  it("does not clobber an existing true when the import states nothing", async () => {
    const { result, tx } = await runImport([row()], {}, [seededProduct({ isB2CEnabled: true })]);

    // The mechanism: the update payload omits the column entirely, so the
    // stored answer — a backfill, an admin decision, a seller edit — survives.
    expect(tx.productUpserts[0]?.update).not.toHaveProperty("isB2CEnabled");
    expect(tx.products.get("MEN-1000")?.isB2CEnabled).toBe(true);
    // And the import does not claim credit for a flag it did not set.
    expect(result.rowsFlaggedConsumerSellable).toBe(0);
    // The rest of the row is still re-imported as before.
    expect(tx.productUpserts[0]?.update).toMatchObject({ isB2BEnabled: true, status: "ACTIVE" });
  });

  it("honours an explicit true on re-import of a product that already exists", async () => {
    // The owner's actual lever: re-import the same sheet with the flag set on
    // the rows that were agreed, against products this importer already made.
    const { result, tx } = await runImport([row({ isB2CEnabled: true })], {}, [seededProduct({ isB2CEnabled: false })]);

    expect(tx.productUpserts[0]?.update).toMatchObject({ isB2CEnabled: true });
    expect(tx.products.get("MEN-1000")?.isB2CEnabled).toBe(true);
    expect(result.rowsFlaggedConsumerSellable).toBe(1);
  });

  it("still lets an explicit false take a flagged product back off the consumer channel", async () => {
    const { tx } = await runImport([row({ isB2CEnabled: false })], {}, [seededProduct({ isB2CEnabled: true })]);

    expect(tx.productUpserts[0]?.update).toMatchObject({ isB2CEnabled: false });
    expect(tx.products.get("MEN-1000")?.isB2CEnabled).toBe(false);
  });
});

describe("resolvePilotB2CEnabled", () => {
  it("prefers the row, then the option, and otherwise states nothing", () => {
    expect(resolvePilotB2CEnabled({ isB2CEnabled: true }, false)).toBe(true);
    expect(resolvePilotB2CEnabled({ isB2CEnabled: false }, true)).toBe(false);
    expect(resolvePilotB2CEnabled({}, true)).toBe(true);
    expect(resolvePilotB2CEnabled({}, false)).toBe(false);
    expect(resolvePilotB2CEnabled({})).toBeUndefined();
    expect(resolvePilotB2CEnabled({ isB2CEnabled: null })).toBeUndefined();
  });
});

describe("pilot catalog validation of the consumer-channel flag", () => {
  it("counts flagged rows and accepts true, false and absent", () => {
    const validation = validatePilotCatalog(file([
      row({ isB2CEnabled: true }),
      row({ sourceRow: 3, sku: "MEN-1001", isB2CEnabled: false }),
      row({ sourceRow: 4, sku: "MEN-1002" }),
    ]));

    expect(validation.errors).toEqual([]);
    expect(validation.b2cEnabledRows).toBe(1);
  });

  it("refuses a non-boolean rather than coercing a string into a sale", () => {
    const validation = validatePilotCatalog(file([row({ isB2CEnabled: "FALSE" })]));

    expect(validation.errors).toEqual([
      "Mennekes:2 isB2CEnabled must be true, false or absent (received string)",
    ]);
  });

  it("warns when a flagged row has no verified price, because it stays DRAFT", () => {
    const validation = validatePilotCatalog(file([row({ isB2CEnabled: true, unitPriceSAR: null })]));

    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toContain(
      "MEN-1000: flagged consumer-sellable but has no verified SAR price; it stays DRAFT and cannot be ordered",
    );
  });
});
