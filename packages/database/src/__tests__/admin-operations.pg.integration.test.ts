import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  AdminOperationError,
  CategorySlugTakenError,
  adminAdjustStock,
  adminAdvanceOrder,
  adminCancelOrder,
  addOrderInternalNote,
  createCategory,
  restoreProduct,
  suppressProduct,
  updateCategory,
} from "../services/admin-operations";

// Runs only against a real Postgres: advisory locks, compare-and-set and
// unique-violation handling are the behaviour under test.
const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;

const stamp = `adminops-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const created = {
  users: [] as string[],
  sellers: [] as string[],
  categories: [] as string[],
  products: [] as string[],
  orders: [] as string[],
  warehouses: [] as string[],
  locations: [] as string[],
  stocks: [] as string[],
  purchaseOrders: [] as string[],
  companies: [] as string[],
};
let adminId = "";
let suspendedAdminId = "";
let buyerId = "";
let sellerId = "";
let rootCategoryId = "";
let productId = "";
let locationId = "";
let stockId = "";
let orderSeq = 0;

async function makeProduct(label: string, data: { status: "ACTIVE" | "INACTIVE" | "PENDING_REVIEW" | "DRAFT"; publishedAt?: Date | null; categoryId?: string }) {
  const product = await db.product.create({
    data: {
      sellerId,
      categoryId: data.categoryId ?? rootCategoryId,
      sku: `${stamp}-${label}`,
      slug: `${stamp}-${label}`.toLowerCase(),
      nameEn: `${label} ${stamp}`,
      nameAr: `${label} ${stamp}`,
      status: data.status,
      publishedAt: data.publishedAt === undefined ? new Date() : data.publishedAt,
      isB2CEnabled: true,
    },
  });
  created.products.push(product.id);
  return product;
}

async function makeOrder(input: { status: "PENDING_PAYMENT" | "PAYMENT_CONFIRMED" | "CONFIRMED" | "PROCESSING"; itemStatus?: "CONFIRMED" | "PROCESSING"; quantity?: number; paymentStatus?: "UNPAID" | "PAID" }) {
  orderSeq += 1;
  const quantity = input.quantity ?? 2;
  const order = await db.order.create({
    data: {
      orderNumber: `${stamp}-${orderSeq}`,
      userId: buyerId,
      type: "B2C",
      status: input.status,
      paymentStatus: input.paymentStatus ?? "UNPAID",
      currency: "AED",
      subtotal: 100,
      vatAmount: 5,
      total: 105,
      shippingAddress: { line1: "Test", city: "Dubai", country: "AE" },
      items: {
        create: {
          productId,
          sellerId,
          sku: `${stamp}-main`,
          nameEn: "Main",
          nameAr: "Main",
          quantity,
          unitPrice: 50,
          vatAmount: 5,
          total: 105,
          status: input.itemStatus ?? "CONFIRMED",
        },
      },
    },
  });
  created.orders.push(order.id);
  return order;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const [admin, suspended, buyer, owner] = await Promise.all([
    db.user.create({ data: { email: `${stamp}-admin@test.invalid`, firstName: "Ops", lastName: "Admin", role: "ADMIN", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-suspended@test.invalid`, firstName: "Gone", lastName: "Admin", role: "ADMIN", status: "SUSPENDED" } }),
    db.user.create({ data: { email: `${stamp}-buyer@test.invalid`, firstName: "Ops", lastName: "Buyer", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-owner@test.invalid`, firstName: "Ops", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  created.users.push(admin.id, suspended.id, buyer.id, owner.id);
  adminId = admin.id;
  suspendedAdminId = suspended.id;
  buyerId = buyer.id;

  const seller = await db.sellerProfile.create({
    data: { userId: owner.id, businessNameEn: `Ops ${stamp}`, crNumber: `CR-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" },
  });
  created.sellers.push(seller.id);
  sellerId = seller.id;

  const category = await db.category.create({ data: { nameEn: `Root ${stamp}`, nameAr: `Root ${stamp}`, slug: `root-${stamp}` } });
  created.categories.push(category.id);
  rootCategoryId = category.id;

  const product = await makeProduct("main", { status: "ACTIVE" });
  productId = product.id;

  const warehouse = await db.warehouse.create({ data: { sellerId: seller.id, nameEn: `WH ${stamp}`, type: "SELLER", country: "AE", city: "Dubai" } });
  created.warehouses.push(warehouse.id);
  const location = await db.inventoryLocation.create({ data: { warehouseId: warehouse.id, code: "MAIN" } });
  created.locations.push(location.id);
  locationId = location.id;
  const stock = await db.inventoryStock.create({ data: { productId: product.id, locationId: location.id, qty: 10, reservedQty: 4 } });
  created.stocks.push(stock.id);
  stockId = stock.id;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: created.users } }, { entityId: { in: [...created.orders, ...created.products, ...created.categories, ...created.stocks] } }] } });
  await db.order.deleteMany({ where: { id: { in: created.orders } } });
  await db.purchaseOrder.deleteMany({ where: { id: { in: created.purchaseOrders } } });
  await db.company.deleteMany({ where: { id: { in: created.companies } } });
  await db.inventoryStock.deleteMany({ where: { id: { in: created.stocks } } });
  await db.inventoryLocation.deleteMany({ where: { id: { in: created.locations } } });
  await db.warehouse.deleteMany({ where: { id: { in: created.warehouses } } });
  await db.product.deleteMany({ where: { id: { in: created.products } } });
  // Children before parents: the self-relation has no cascade.
  const categories = await db.category.findMany({ where: { id: { in: created.categories } }, select: { id: true, parentId: true } });
  const remaining = new Set(categories.map((c) => c.id));
  while (remaining.size > 0) {
    const leaves = categories.filter((c) => remaining.has(c.id) && !categories.some((o) => remaining.has(o.id) && o.parentId === c.id));
    if (leaves.length === 0) break;
    await db.category.deleteMany({ where: { id: { in: leaves.map((c) => c.id) } } });
    for (const leaf of leaves) remaining.delete(leaf.id);
  }
  await db.sellerProfile.deleteMany({ where: { id: { in: created.sellers } } });
  await db.user.deleteMany({ where: { id: { in: created.users } } });
});

run("admin operations: product suppress / restore", () => {
  it("suppresses an active listing, records the reason, and restores it to ACTIVE", async () => {
    const product = await makeProduct("suppress-active", { status: "ACTIVE" });
    await expect(suppressProduct({ productId: product.id, actorId: adminId, reason: "Counterfeit report" })).resolves.toMatchObject({ previousStatus: "ACTIVE", status: "SUPPRESSED" });
    await expect(db.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ status: "SUPPRESSED" });
    const issue = await db.productIssue.findFirst({ where: { productId: product.id, issueType: "SUPPRESSED", resolvedAt: null } });
    expect(issue).toMatchObject({ severity: "ERROR", message: "Counterfeit report" });
    const audit = await db.auditLog.findFirst({ where: { entityType: "Product", entityId: product.id, action: "STATUS_CHANGE" }, orderBy: { createdAt: "desc" } });
    expect(audit?.after).toMatchObject({ status: "SUPPRESSED", reason: "Counterfeit report", source: "ADMIN_SUPPRESS" });
    expect(audit?.sellerId).toBe(sellerId);

    await expect(restoreProduct({ productId: product.id, actorId: adminId })).resolves.toEqual({ status: "ACTIVE" });
    await expect(db.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ status: "ACTIVE" });
    expect(await db.productIssue.count({ where: { productId: product.id, issueType: "SUPPRESSED", resolvedAt: null } })).toBe(0);
  });

  it("restores a seller-paused listing back to INACTIVE, not ACTIVE", async () => {
    const product = await makeProduct("suppress-paused", { status: "INACTIVE" });
    await suppressProduct({ productId: product.id, actorId: adminId, reason: "Policy review" });
    await expect(restoreProduct({ productId: product.id, actorId: adminId })).resolves.toEqual({ status: "INACTIVE" });
  });

  it("restores a never-published listing to DRAFT", async () => {
    const product = await makeProduct("suppress-unpublished", { status: "ACTIVE", publishedAt: null });
    await suppressProduct({ productId: product.id, actorId: adminId, reason: "Missing compliance" });
    await expect(restoreProduct({ productId: product.id, actorId: adminId })).resolves.toEqual({ status: "DRAFT" });
  });

  it("refuses to suppress a listing that is not live or paused", async () => {
    const product = await makeProduct("suppress-pending", { status: "PENDING_REVIEW", publishedAt: null });
    await expect(suppressProduct({ productId: product.id, actorId: adminId, reason: "Nope" })).rejects.toBeInstanceOf(AdminOperationError);
    await expect(db.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ status: "PENDING_REVIEW" });
  });

  it("refuses an empty reason and a non-current admin", async () => {
    await expect(suppressProduct({ productId, actorId: adminId, reason: "   " })).rejects.toBeInstanceOf(AdminOperationError);
    await expect(suppressProduct({ productId, actorId: suspendedAdminId, reason: "Suspended actor" })).rejects.toThrow(/current admin authority/i);
    await expect(db.product.findUniqueOrThrow({ where: { id: productId } })).resolves.toMatchObject({ status: "ACTIVE" });
  });

  it("tells a stale page to reload when the row moved under the lock", async () => {
    const product = await makeProduct("suppress-race", { status: "ACTIVE" });
    const attempt = suppressProduct({
      productId: product.id,
      actorId: adminId,
      reason: "Race",
      afterProductLock: async () => {
        // Simulates a competing writer that got in before this decision was read.
        await db.product.update({ where: { id: product.id }, data: { status: "PENDING_REVIEW" } });
      },
    });
    await expect(attempt).rejects.toBeInstanceOf(AdminOperationError);
    await expect(db.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ status: "PENDING_REVIEW" });
  });
});

run("admin operations: categories", () => {
  it("creates a category with an audit row and reports a slug collision as a typed error", async () => {
    const category = await createCategory({ actorId: adminId, nameEn: `Child ${stamp}`, nameAr: `Child ${stamp}`, slug: `child-${stamp}`, parentId: rootCategoryId, sortOrder: 3, isActive: true });
    created.categories.push(category.id);
    expect(category).toMatchObject({ parentId: rootCategoryId, sortOrder: 3 });
    expect(await db.auditLog.count({ where: { entityType: "Category", entityId: category.id, action: "CREATE" } })).toBe(1);

    await expect(createCategory({ actorId: adminId, nameEn: "Dup", nameAr: "Dup", slug: `child-${stamp}`, parentId: null, sortOrder: 0, isActive: true })).rejects.toBeInstanceOf(CategorySlugTakenError);
  });

  it("refuses a parent that would form a cycle", async () => {
    const a = await createCategory({ actorId: adminId, nameEn: `A ${stamp}`, nameAr: `A ${stamp}`, slug: `a-${stamp}`, parentId: null, sortOrder: 0, isActive: true });
    const b = await createCategory({ actorId: adminId, nameEn: `B ${stamp}`, nameAr: `B ${stamp}`, slug: `b-${stamp}`, parentId: a.id, sortOrder: 0, isActive: true });
    created.categories.push(a.id, b.id);
    await expect(updateCategory({ actorId: adminId, categoryId: a.id, nameEn: a.nameEn, nameAr: a.nameAr, slug: a.slug, parentId: b.id, sortOrder: 0, isActive: true })).rejects.toBeInstanceOf(AdminOperationError);
    await expect(updateCategory({ actorId: adminId, categoryId: a.id, nameEn: a.nameEn, nameAr: a.nameAr, slug: a.slug, parentId: a.id, sortOrder: 0, isActive: true })).rejects.toBeInstanceOf(AdminOperationError);
    await expect(db.category.findUniqueOrThrow({ where: { id: a.id } })).resolves.toMatchObject({ parentId: null });
  });

  it("refuses to deactivate a category while active products live in its subtree, naming the count", async () => {
    const parent = await createCategory({ actorId: adminId, nameEn: `P ${stamp}`, nameAr: `P ${stamp}`, slug: `p-${stamp}`, parentId: null, sortOrder: 0, isActive: true });
    const child = await createCategory({ actorId: adminId, nameEn: `C ${stamp}`, nameAr: `C ${stamp}`, slug: `c-${stamp}`, parentId: parent.id, sortOrder: 0, isActive: true });
    created.categories.push(parent.id, child.id);
    await makeProduct("deact-1", { status: "ACTIVE", categoryId: child.id });
    await makeProduct("deact-2", { status: "ACTIVE", categoryId: child.id });
    await makeProduct("deact-3", { status: "DRAFT", publishedAt: null, categoryId: child.id });

    await expect(updateCategory({ actorId: adminId, categoryId: parent.id, nameEn: parent.nameEn, nameAr: parent.nameAr, slug: parent.slug, parentId: null, sortOrder: 0, isActive: false }))
      .rejects.toThrow(/2 active products/);
    await expect(db.category.findUniqueOrThrow({ where: { id: parent.id } })).resolves.toMatchObject({ isActive: true });
  });
});

run("admin operations: stock adjustment", () => {
  it("refuses to drop on-hand below the reserved quantity and refuses a no-op", async () => {
    await db.inventoryStock.update({ where: { id: stockId }, data: { qty: 10, reservedQty: 4 } });
    await expect(adminAdjustStock({ stockId, newQty: 3, reason: "Damage", actorId: adminId })).rejects.toThrow(/reserved/);
    await expect(adminAdjustStock({ stockId, newQty: 10, reason: "Nothing", actorId: adminId })).rejects.toBeInstanceOf(AdminOperationError);
    await expect(db.inventoryStock.findUniqueOrThrow({ where: { id: stockId } })).resolves.toMatchObject({ qty: 10, reservedQty: 4 });
  });

  it("writes the new count, an ADJUSTMENT movement and an audit row", async () => {
    await db.inventoryStock.update({ where: { id: stockId }, data: { qty: 10, reservedQty: 4 } });
    await expect(adminAdjustStock({ stockId, newQty: 7, reason: "Stocktake", reference: "ST-1", actorId: adminId })).resolves.toEqual({ previousQty: 10, qty: 7 });
    await expect(db.inventoryStock.findUniqueOrThrow({ where: { id: stockId } })).resolves.toMatchObject({ qty: 7, reservedQty: 4 });
    const movement = await db.inventoryMovement.findFirst({ where: { stockId, type: "ADJUSTMENT" }, orderBy: { createdAt: "desc" } });
    expect(movement).toMatchObject({ qty: 7, reference: "ST-1", notes: "Stocktake", createdBy: adminId });
    const audit = await db.auditLog.findFirst({ where: { entityType: "InventoryStock", entityId: stockId, actorId: adminId }, orderBy: { createdAt: "desc" } });
    expect(audit?.before).toMatchObject({ qty: 10 });
    expect(audit?.after).toMatchObject({ qty: 7, movementType: "ADJUSTMENT", reason: "Stocktake", source: "ADMIN_ADJUST" });
    expect(audit?.sellerId).toBe(sellerId);
  });

  it("serialises a competing adjustment behind the stock fence so it reads the committed count", async () => {
    await db.inventoryStock.update({ where: { id: stockId }, data: { qty: 10, reservedQty: 4 } });
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const signal = new Promise<void>((resolve) => { locked = resolve; });
    const first = adminAdjustStock({ stockId, newQty: 8, reason: "Stocktake A", actorId: adminId, afterStockLock: async () => { locked(); await held; } });
    await signal;
    // Starts while the first fence is held; must wait, then read 8, not 10.
    const second = adminAdjustStock({ stockId, newQty: 9, reason: "Stocktake B", actorId: adminId });
    release();
    await expect(first).resolves.toEqual({ previousQty: 10, qty: 8 });
    await expect(second).resolves.toEqual({ previousQty: 8, qty: 9 });
    await expect(db.inventoryStock.findUniqueOrThrow({ where: { id: stockId } })).resolves.toMatchObject({ qty: 9, reservedQty: 4 });
  });
});

run("admin operations: orders", () => {
  it("cancels an unpaid order, releases the reservation with a RELEASE movement, and refuses to cancel twice", async () => {
    await db.inventoryStock.update({ where: { id: stockId }, data: { qty: 10, reservedQty: 4 } });
    const order = await makeOrder({ status: "PENDING_PAYMENT", quantity: 2 });
    await expect(adminCancelOrder({ orderId: order.id, actorId: adminId, reason: "Customer asked", expectedFrom: "PENDING_PAYMENT" })).resolves.toMatchObject({ status: "CANCELLED", releasedUnits: 2, shortfall: [] });
    await expect(db.order.findUniqueOrThrow({ where: { id: order.id } })).resolves.toMatchObject({ status: "CANCELLED" });
    expect(await db.orderItem.count({ where: { orderId: order.id, status: "CANCELLED" } })).toBe(1);
    await expect(db.inventoryStock.findUniqueOrThrow({ where: { id: stockId } })).resolves.toMatchObject({ qty: 10, reservedQty: 2 });
    const movement = await db.inventoryMovement.findFirst({ where: { stockId, type: "RELEASE", reference: order.orderNumber } });
    expect(movement).toMatchObject({ qty: 2, createdBy: adminId });
    const history = await db.orderStatusHistory.findFirst({ where: { orderId: order.id, status: "CANCELLED" } });
    expect(history).toMatchObject({ message: "Customer asked", actorId: adminId });
    await expect(adminCancelOrder({ orderId: order.id, actorId: adminId, reason: "Again" })).rejects.toThrow(/already cancelled/i);
  });

  it("records a release shortfall instead of driving reservedQty negative", async () => {
    await db.inventoryStock.update({ where: { id: stockId }, data: { qty: 10, reservedQty: 1 } });
    const order = await makeOrder({ status: "PAYMENT_CONFIRMED", quantity: 3 });
    const result = await adminCancelOrder({ orderId: order.id, actorId: adminId, reason: "Ledger drift" });
    expect(result.releasedUnits).toBe(1);
    expect(result.shortfall).toEqual([{ sku: `${stamp}-main`, units: 2 }]);
    await expect(db.inventoryStock.findUniqueOrThrow({ where: { id: stockId } })).resolves.toMatchObject({ reservedQty: 0 });
  });

  it("routes paid or in-fulfilment orders to Returns instead of cancelling", async () => {
    const processing = await makeOrder({ status: "PROCESSING", itemStatus: "PROCESSING", paymentStatus: "PAID" });
    await expect(adminCancelOrder({ orderId: processing.id, actorId: adminId, reason: "Late" })).rejects.toThrow(/handled through Returns/);
    const paidButPending = await makeOrder({ status: "PAYMENT_CONFIRMED", paymentStatus: "PAID" });
    await expect(adminCancelOrder({ orderId: paidButPending.id, actorId: adminId, reason: "Late" })).rejects.toThrow(/handled through Returns/);
    await expect(db.order.findUniqueOrThrow({ where: { id: processing.id } })).resolves.toMatchObject({ status: "PROCESSING" });
  });

  it("refuses to cancel an order bound to a governed purchase order, leaving both untouched", async () => {
    const company = await db.company.create({
      data: { nameEn: `Ops Co ${stamp}`, industry: "INDUSTRIAL_SUPPLIES", size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE" },
    });
    created.companies.push(company.id);
    const po = await db.purchaseOrder.create({
      data: { poNumber: `${stamp}-po`, companyId: company.id, requesterId: buyerId, status: "ORDERED", currency: "AED", total: 105 },
    });
    created.purchaseOrders.push(po.id);
    const governed = await makeOrder({ status: "PENDING_PAYMENT" });
    await db.order.update({ where: { id: governed.id }, data: { purchaseOrderId: po.id } });
    await db.inventoryStock.update({ where: { id: stockId }, data: { qty: 10, reservedQty: 2 } });

    await expect(adminCancelOrder({ orderId: governed.id, actorId: adminId, reason: "Late" })).rejects.toThrow(/governed purchase order/);
    await expect(db.order.findUniqueOrThrow({ where: { id: governed.id } })).resolves.toMatchObject({ status: "PENDING_PAYMENT" });
    await expect(db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).resolves.toMatchObject({ status: "ORDERED" });
    await expect(db.inventoryStock.findUniqueOrThrow({ where: { id: stockId } })).resolves.toMatchObject({ reservedQty: 2 });
  });

  it("refuses to cancel when a captured payment attempt exists even though the order row still says UNPAID", async () => {
    const order = await makeOrder({ status: "PENDING_PAYMENT" });
    await db.payment.create({ data: { orderId: order.id, method: "CREDIT_CARD", status: "PAID", amount: 105, currency: "AED", paidAt: new Date() } });
    await expect(adminCancelOrder({ orderId: order.id, actorId: adminId, reason: "Late" })).rejects.toThrow(/captured payment attempt/);
    await expect(db.order.findUniqueOrThrow({ where: { id: order.id } })).resolves.toMatchObject({ status: "PENDING_PAYMENT" });
  });

  it("advances CONFIRMED → PROCESSING → SHIPPED, consuming the reservation on the SHIPPED crossing", async () => {
    await db.inventoryStock.update({ where: { id: stockId }, data: { qty: 10, reservedQty: 4 } });
    const order = await makeOrder({ status: "CONFIRMED", quantity: 2 });

    await expect(adminAdvanceOrder({ orderId: order.id, to: "PROCESSING", actorId: adminId, expectedFrom: "CONFIRMED", message: "Picked" })).resolves.toEqual({ status: "PROCESSING" });
    await expect(db.inventoryStock.findUniqueOrThrow({ where: { id: stockId } })).resolves.toMatchObject({ qty: 10, reservedQty: 4 });
    expect(await db.orderItem.count({ where: { orderId: order.id, status: "PROCESSING" } })).toBe(1);

    await expect(adminAdvanceOrder({ orderId: order.id, to: "SHIPPED", actorId: adminId, expectedFrom: "PROCESSING" })).resolves.toEqual({ status: "SHIPPED" });
    await expect(db.inventoryStock.findUniqueOrThrow({ where: { id: stockId } })).resolves.toMatchObject({ qty: 8, reservedQty: 2 });
    const movement = await db.inventoryMovement.findFirst({ where: { stockId, type: "OUT", reference: order.orderNumber } });
    expect(movement).toMatchObject({ qty: 2, createdBy: adminId });
    const history = await db.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.status)).toEqual(["PROCESSING", "SHIPPED"]);
    expect(history[0]?.message).toBe("Picked");
    const audits = await db.auditLog.findMany({ where: { entityType: "Order", entityId: order.id, action: "STATUS_CHANGE" } });
    expect(audits).toHaveLength(2);
    expect(audits.every((a) => (a.after as { source?: string }).source === "ADMIN_OVERRIDE")).toBe(true);
  });

  it("refuses a backward move, a stale expectedFrom, and an order outside fulfilment", async () => {
    const order = await makeOrder({ status: "PROCESSING", itemStatus: "PROCESSING" });
    await expect(adminAdvanceOrder({ orderId: order.id, to: "PROCESSING", actorId: adminId })).rejects.toBeInstanceOf(AdminOperationError);
    await expect(adminAdvanceOrder({ orderId: order.id, to: "SHIPPED", actorId: adminId, expectedFrom: "CONFIRMED" })).rejects.toThrow(/reload/);
    const pending = await makeOrder({ status: "PENDING_PAYMENT" });
    await expect(adminAdvanceOrder({ orderId: pending.id, to: "PROCESSING", actorId: adminId })).rejects.toThrow(/not in fulfilment/);
    await expect(db.order.findUniqueOrThrow({ where: { id: order.id } })).resolves.toMatchObject({ status: "PROCESSING" });
  });

  it("refuses to ship when the reservation ledger cannot cover the line", async () => {
    await db.inventoryStock.update({ where: { id: stockId }, data: { qty: 10, reservedQty: 0 } });
    const order = await makeOrder({ status: "PROCESSING", itemStatus: "PROCESSING", quantity: 2 });
    await expect(adminAdvanceOrder({ orderId: order.id, to: "SHIPPED", actorId: adminId })).rejects.toThrow(/Reserved inventory is incomplete/);
    await expect(db.order.findUniqueOrThrow({ where: { id: order.id } })).resolves.toMatchObject({ status: "PROCESSING" });
    await expect(db.inventoryStock.findUniqueOrThrow({ where: { id: stockId } })).resolves.toMatchObject({ qty: 10, reservedQty: 0 });
  });

  it("serialises a concurrent override behind the fulfilment fence and tells the loser to reload", async () => {
    await db.inventoryStock.update({ where: { id: stockId }, data: { qty: 10, reservedQty: 4 } });
    const order = await makeOrder({ status: "CONFIRMED" });
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const signal = new Promise<void>((resolve) => { locked = resolve; });
    const first = adminAdvanceOrder({ orderId: order.id, to: "PROCESSING", actorId: adminId, expectedFrom: "CONFIRMED", afterOrderLock: async () => { locked(); await held; } });
    await signal;
    const second = adminAdvanceOrder({ orderId: order.id, to: "PROCESSING", actorId: adminId, expectedFrom: "CONFIRMED" });
    release();
    await expect(first).resolves.toEqual({ status: "PROCESSING" });
    await expect(second).rejects.toThrow(/reload/);
    expect(await db.orderStatusHistory.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("stores an internal note in the audit log without touching the order", async () => {
    const order = await makeOrder({ status: "CONFIRMED" });
    const before = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    await addOrderInternalNote({ orderId: order.id, actorId: adminId, note: "Called the customer" });
    const note = await db.auditLog.findFirst({ where: { entityType: "OrderInternalNote", entityId: order.id } });
    expect(note?.after).toMatchObject({ note: "Called the customer", orderStatus: "CONFIRMED" });
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after).toMatchObject({ status: before.status, notes: before.notes });
    expect(await db.orderStatusHistory.count({ where: { orderId: order.id } })).toBe(0);
    await expect(addOrderInternalNote({ orderId: order.id, actorId: suspendedAdminId, note: "x" })).rejects.toThrow(/current admin authority/i);
  });
});
