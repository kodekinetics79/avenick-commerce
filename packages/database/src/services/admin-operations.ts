import { AuditAction, Prisma, type OrderStatus, type ProductStatus } from "@prisma/client";
import { db } from "../index";
import {
  inventoryStockIdentityWhere,
  lockInventoryStockRows,
  lockProductCommercialRows,
  requireCurrentAdminActor,
} from "./checkout-invariants";

// Admin operational mutations: product suppress/restore, category taxonomy,
// order overrides and stock adjustments. Every writer here re-resolves admin
// authority inside its own transaction, takes the same fences the seller and
// checkout paths take, and compare-and-sets the row it decided on so a page
// that went stale between render and click is told to reload instead of
// silently applying a decision to a row that has since moved.

type Tx = Prisma.TransactionClient;

/**
 * A refusal the operator can act on. Its message is authored for humans and
 * contains no internals, so the UI may show it verbatim. Anything else thrown
 * out of this module is an infrastructure failure and must be reported
 * generically (see describeAdminFailure).
 */
export class AdminOperationError extends Error {
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "AdminOperationError";
    this.field = field;
  }
}

/** Slug collision on Category. Reported against the slug field. */
export class CategorySlugTakenError extends AdminOperationError {
  constructor(slug: string) {
    super(`The slug "${slug}" is already used by another category`, "slug");
    this.name = "CategorySlugTakenError";
  }
}

function isPrismaFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  );
}

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Map a failure onto the line the operator sees. Refusals authored here and
 * by the actor/lock helpers are shown as written; database and driver errors
 * are never surfaced (they carry query text and ids) and fall back to the
 * caller's generic message. Callers log the original before calling this.
 */
export function describeAdminFailure(error: unknown, fallback: string): string {
  if (error instanceof AdminOperationError) return error.message;
  if (error instanceof Error && !isPrismaFailure(error) && error.message.trim()) return error.message;
  return fallback;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "draft",
  PENDING_REVIEW: "pending review",
  ACTIVE: "active",
  SUPPRESSED: "suppressed",
  SUSPENDED: "suspended",
  REJECTED: "rejected",
  INACTIVE: "paused",
};

function humanStatus(status: string): string {
  return STATUS_LABEL[status] ?? status.toLowerCase().replace(/_/g, " ");
}

// ─── PRODUCT SUPPRESS / RESTORE ───────────────────────────────────────────────

/** Only a listing the seller controls (live or paused) can be taken over by the platform. */
const SUPPRESSIBLE: ProductStatus[] = ["ACTIVE", "INACTIVE"];

/**
 * Platform-side takedown. SUPPRESSED is owned by the platform: the seller's
 * bulk status action treats it as PLATFORM_SUPPRESSED and refuses to leave it,
 * so the only way back is restoreProduct below. The reason is written as an
 * open ProductIssue of type SUPPRESSED — the seller's "Fix Your Products"
 * queue already knows that type — and into the audit row.
 */
export async function suppressProduct(input: {
  productId: string;
  actorId: string;
  reason: string;
  /** Deterministic seam after the product commercial lock is held. */
  afterProductLock?: () => Promise<void>;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new AdminOperationError("A suppression reason is required", "reason");

  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, input.actorId);
    await lockProductCommercialRows(tx, [input.productId]);
    await input.afterProductLock?.();

    const current = await tx.product.findFirst({
      where: { id: input.productId, deletedAt: null },
      select: { status: true, sellerId: true },
    });
    if (!current) throw new AdminOperationError("Product not found");
    if (!SUPPRESSIBLE.includes(current.status)) {
      throw new AdminOperationError(`Only active or paused listings can be suppressed (this one is ${humanStatus(current.status)})`);
    }

    // Compare-and-set on the exact status read above so the audit row's
    // `before` is the status that was actually replaced.
    const { count } = await tx.product.updateMany({
      where: { id: input.productId, status: current.status, deletedAt: null },
      data: { status: "SUPPRESSED" },
    });
    if (count !== 1) throw new AdminOperationError("Product changed, reload");

    // Exactly one open suppression reason per product: supersede any stale
    // open row before writing the current one.
    await tx.productIssue.updateMany({
      where: { productId: input.productId, issueType: "SUPPRESSED", resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    await tx.productIssue.create({
      data: { productId: input.productId, issueType: "SUPPRESSED", severity: "ERROR", message: reason },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: current.sellerId,
        entityType: "Product",
        entityId: input.productId,
        action: AuditAction.STATUS_CHANGE,
        before: { status: current.status },
        after: { status: "SUPPRESSED", reason, source: "ADMIN_SUPPRESS" },
      },
    });
    return { previousStatus: current.status, status: "SUPPRESSED" as const };
  });
}

/**
 * Lift a suppression. The listing goes back to where it was before the
 * platform took it: a seller-paused (INACTIVE) listing stays paused, and a
 * listing that was never approved (no publishedAt) becomes DRAFT — a restore
 * must never be the event that makes an unreviewed product live.
 */
export async function restoreProduct(input: { productId: string; actorId: string }) {
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, input.actorId);
    await lockProductCommercialRows(tx, [input.productId]);

    const current = await tx.product.findFirst({
      where: { id: input.productId, deletedAt: null },
      select: { status: true, sellerId: true, publishedAt: true },
    });
    if (!current) throw new AdminOperationError("Product not found");
    if (current.status !== "SUPPRESSED") {
      throw new AdminOperationError(`Only suppressed listings can be restored (this one is ${humanStatus(current.status)})`);
    }

    const suppression = await tx.auditLog.findFirst({
      where: {
        entityType: "Product",
        entityId: input.productId,
        action: AuditAction.STATUS_CHANGE,
        after: { path: ["status"], equals: "SUPPRESSED" },
      },
      orderBy: { createdAt: "desc" },
      select: { before: true },
    });
    const previous = (suppression?.before as { status?: string } | null)?.status;
    const to: ProductStatus = previous === "INACTIVE" ? "INACTIVE" : current.publishedAt ? "ACTIVE" : "DRAFT";

    const { count } = await tx.product.updateMany({
      where: { id: input.productId, status: "SUPPRESSED", deletedAt: null },
      data: { status: to },
    });
    if (count !== 1) throw new AdminOperationError("Product changed, reload");

    await tx.productIssue.updateMany({
      where: { productId: input.productId, issueType: "SUPPRESSED", resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: current.sellerId,
        entityType: "Product",
        entityId: input.productId,
        action: AuditAction.STATUS_CHANGE,
        before: { status: "SUPPRESSED" },
        after: { status: to, source: "ADMIN_RESTORE" },
      },
    });
    return { status: to };
  });
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

export interface CategoryInput {
  nameEn: string;
  nameAr: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

/**
 * The whole taxonomy is one small tree edited by a handful of people, so one
 * fence for every write is cheaper than reasoning about which ancestors two
 * concurrent edits could each re-parent into a cycle.
 */
async function lockCategoryTree(tx: Pick<Tx, "$executeRaw">): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"category-tree"}))`);
}

/** Walk up from the proposed parent; reaching the category itself means a cycle. */
async function assertNoCycle(tx: Tx, categoryId: string | null, parentId: string | null): Promise<void> {
  if (!parentId) return;
  if (categoryId && parentId === categoryId) throw new AdminOperationError("A category cannot be its own parent", "parentId");
  const seen = new Set<string>();
  let cursor: string | null = parentId;
  while (cursor) {
    if (seen.has(cursor)) throw new AdminOperationError("The category tree already contains a cycle above the chosen parent", "parentId");
    seen.add(cursor);
    const node: { parentId: string | null } | null = await tx.category.findUnique({ where: { id: cursor }, select: { parentId: true } });
    if (!node) throw new AdminOperationError("The chosen parent category does not exist", "parentId");
    if (categoryId && node.parentId === categoryId) {
      throw new AdminOperationError("The chosen parent is a descendant of this category", "parentId");
    }
    cursor = node.parentId;
  }
}

/** Ids of the category and every descendant (breadth-first). */
async function subtreeIds(tx: Tx, rootId: string): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await tx.category.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
    frontier = children.map((child) => child.id).filter((id) => !ids.includes(id));
    ids.push(...frontier);
  }
  return ids;
}

async function withSlugCollision<T>(slug: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    // P2002 aborts the Postgres transaction, so it is translated here, after
    // the transaction has unwound, rather than inside the callback.
    if (isUniqueViolation(error)) throw new CategorySlugTakenError(slug);
    throw error;
  }
}

export async function createCategory(input: CategoryInput & { actorId: string }) {
  return withSlugCollision(input.slug, () =>
    db.$transaction(async (tx) => {
      await requireCurrentAdminActor(tx, input.actorId);
      await lockCategoryTree(tx);
      await assertNoCycle(tx, null, input.parentId);
      const category = await tx.category.create({
        data: {
          nameEn: input.nameEn,
          nameAr: input.nameAr,
          slug: input.slug,
          parentId: input.parentId,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          entityType: "Category",
          entityId: category.id,
          action: AuditAction.CREATE,
          after: {
            nameEn: category.nameEn,
            nameAr: category.nameAr,
            slug: category.slug,
            parentId: category.parentId,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
          },
        },
      });
      return category;
    }),
  );
}

export async function updateCategory(input: CategoryInput & { categoryId: string; actorId: string }) {
  return withSlugCollision(input.slug, () =>
    db.$transaction(async (tx) => {
      await requireCurrentAdminActor(tx, input.actorId);
      await lockCategoryTree(tx);
      const current = await tx.category.findUnique({ where: { id: input.categoryId } });
      if (!current) throw new AdminOperationError("Category not found");
      await assertNoCycle(tx, input.categoryId, input.parentId);

      if (current.isActive && !input.isActive) {
        // Deactivation hides the whole subtree from customer navigation, so
        // live products anywhere under it would silently lose their shelf.
        const ids = await subtreeIds(tx, input.categoryId);
        const live = await tx.product.count({ where: { categoryId: { in: ids }, status: "ACTIVE", deletedAt: null } });
        if (live > 0) {
          throw new AdminOperationError(
            `Cannot deactivate: ${live} active product${live === 1 ? "" : "s"} still ${live === 1 ? "lives" : "live"} in this category or its subcategories. Move or pause them first.`,
            "isActive",
          );
        }
      }

      const category = await tx.category.update({
        where: { id: input.categoryId },
        data: {
          nameEn: input.nameEn,
          nameAr: input.nameAr,
          slug: input.slug,
          parentId: input.parentId,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          entityType: "Category",
          entityId: category.id,
          action: AuditAction.UPDATE,
          before: {
            nameEn: current.nameEn,
            nameAr: current.nameAr,
            slug: current.slug,
            parentId: current.parentId,
            sortOrder: current.sortOrder,
            isActive: current.isActive,
          },
          after: {
            nameEn: category.nameEn,
            nameAr: category.nameAr,
            slug: category.slug,
            parentId: category.parentId,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
          },
        },
      });
      return category;
    }),
  );
}

// ─── ORDER OVERRIDES ──────────────────────────────────────────────────────────

/** Same chain and ranking as advanceSellerOrderItems in seller-fulfillment.ts. */
const FULFILMENT_CHAIN: OrderStatus[] = ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const CHAIN_RANK = new Map(FULFILMENT_CHAIN.map((status, index) => [status, index]));
const SHIPPED_STATES: OrderStatus[] = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

function chainRank(status: OrderStatus): number {
  return CHAIN_RANK.get(status) ?? -1;
}

export type AdminAdvanceTarget = Extract<OrderStatus, "PROCESSING" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED">;
export const ADMIN_ADVANCE_TARGETS: AdminAdvanceTarget[] = ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

/** Statuses an operator may cancel outright: nothing has been paid or picked. */
export const ADMIN_CANCELLABLE: OrderStatus[] = ["PENDING_PAYMENT", "PAYMENT_CONFIRMED"];

const ORDER_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "pending payment",
  PAYMENT_CONFIRMED: "payment confirmed",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  OUT_FOR_DELIVERY: "out for delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  RETURN_REQUESTED: "return requested",
  RETURNED: "returned",
};

async function lockOrderFulfillment(tx: Pick<Tx, "$executeRaw">, orderId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`seller-fulfillment:${orderId}`}))`);
}

async function lockOrderPayment(tx: Pick<Tx, "$executeRaw">, orderId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`order-payment:${orderId}`}))`);
}

type ReservedLine = { productId: string; variantId: string | null; sku: string; quantity: number };

/**
 * Consume reservations for lines crossing into SHIPPED. Mirrors the seller
 * path line for line: the same inventory-stock fence, the same
 * compare-and-set against the row the decision was read from, the same OUT
 * movement. An admin override that skipped this would leave every shipped
 * unit reserved forever.
 */
async function consumeReservations(tx: Tx, lines: ReservedLine[], orderNumber: string, actorId: string): Promise<void> {
  if (lines.length === 0) return;
  const fenced = await tx.inventoryStock.findMany({
    where: { OR: lines.map((line) => inventoryStockIdentityWhere(line.productId, line.variantId)) },
    select: { id: true },
  });
  await lockInventoryStockRows(tx, fenced.map((row) => row.id));

  for (const line of lines) {
    let remaining = line.quantity;
    const rows = await tx.inventoryStock.findMany({
      where: inventoryStockIdentityWhere(line.productId, line.variantId),
      orderBy: { updatedAt: "asc" },
    });
    for (const stock of rows) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, stock.reservedQty);
      if (take <= 0) continue;
      const { count } = await tx.inventoryStock.updateMany({
        where: { id: stock.id, qty: stock.qty, reservedQty: stock.reservedQty },
        data: { reservedQty: { decrement: take }, qty: { decrement: take } },
      });
      if (count !== 1) continue;
      await tx.inventoryMovement.create({
        data: {
          stockId: stock.id,
          type: "OUT",
          qty: take,
          reference: orderNumber,
          notes: `Line ${line.sku} shipped by marketplace operations — reservation consumed`,
          createdBy: actorId,
        },
      });
      remaining -= take;
    }
    if (remaining > 0) {
      throw new AdminOperationError(`Reserved inventory is incomplete for ${line.sku}; the order was not advanced`);
    }
  }
}

/**
 * Platform override of the fulfilment chain for a whole order. Takes the same
 * per-order fence as the seller path, moves every line that is behind the
 * target forward (a line another seller already delivered is never pulled
 * back), consumes reservations on the SHIPPED crossing, and derives the
 * parent status from the least-advanced line exactly as the seller path does.
 */
export async function adminAdvanceOrder(input: {
  orderId: string;
  to: AdminAdvanceTarget;
  actorId: string;
  /** Status the operator was looking at; a mismatch means the page is stale. */
  expectedFrom?: OrderStatus;
  /** Written to the customer-visible status history. */
  message?: string;
  /** Deterministic seam after the order fence is held. */
  afterOrderLock?: () => Promise<void>;
}) {
  if (!ADMIN_ADVANCE_TARGETS.includes(input.to)) throw new AdminOperationError("Unsupported order transition");
  const targetRank = chainRank(input.to);

  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, input.actorId);
    await lockOrderFulfillment(tx, input.orderId);
    await input.afterOrderLock?.();

    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
    if (!order) throw new AdminOperationError("Order not found");
    if (input.expectedFrom && order.status !== input.expectedFrom) throw new AdminOperationError("Order changed, reload");
    const fromRank = chainRank(order.status);
    if (fromRank < 0) {
      throw new AdminOperationError(`Order is ${ORDER_LABEL[order.status]} and not in fulfilment; it cannot be marked ${ORDER_LABEL[input.to]}`);
    }
    if (targetRank <= fromRank) throw new AdminOperationError("Order changed, reload");
    for (const item of order.items) {
      if (chainRank(item.status) < 0) {
        throw new AdminOperationError(`Line ${item.sku} is ${ORDER_LABEL[item.status]} and cannot be advanced`);
      }
    }

    const behind = order.items.filter((item) => chainRank(item.status) < targetRank);
    await consumeReservations(
      tx,
      behind.filter((item) => chainRank(item.status) < chainRank("SHIPPED") && targetRank >= chainRank("SHIPPED")),
      order.orderNumber,
      input.actorId,
    );

    await tx.orderItem.updateMany({
      where: { orderId: order.id, status: { in: FULFILMENT_CHAIN.slice(0, targetRank) } },
      data: { status: input.to },
    });
    const refreshed = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { status: true } });
    const aggregate = FULFILMENT_CHAIN[Math.min(...refreshed.map((item) => chainRank(item.status)))] ?? input.to;

    // Payment confirmation writes order.status under a different fence, so
    // the parent row is compare-and-set against the status read above.
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: aggregate },
    });
    if (count !== 1) throw new AdminOperationError("Order changed, reload");

    const message = input.message?.trim() || `Order marked ${ORDER_LABEL[aggregate]} by marketplace operations`;
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, status: aggregate, message, actorId: input.actorId },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        entityType: "Order",
        entityId: order.id,
        action: AuditAction.STATUS_CHANGE,
        before: { status: order.status, lineStatuses: order.items.map((item) => ({ id: item.id, sku: item.sku, status: item.status })) },
        after: { status: aggregate, lineStatus: input.to, source: "ADMIN_OVERRIDE", message },
      },
    });
    return { status: aggregate };
  });
}

/**
 * Cancel an order nothing has been paid for or picked. Later cancellations
 * need a refund, and the only refund primitive in the system is the returns
 * workflow, so paid orders are routed there rather than half-cancelled here.
 *
 * Holds the payment fence as well as the fulfilment fence: a gateway webhook
 * confirming payment for this order serialises behind the cancel, then sees
 * CANCELLED and refuses (payments.ts CLOSED_ORDER_STATUSES).
 *
 * Reservations are released the way checkout took them — per identity row,
 * compare-and-set, RELEASE movement. If the ledger holds fewer reserved units
 * than the order claims, only what exists is released and the shortfall is
 * recorded in the audit row: driving reservedQty negative to balance an
 * already-inconsistent ledger would hide the discrepancy, not fix it.
 */
export async function adminCancelOrder(input: {
  orderId: string;
  actorId: string;
  reason: string;
  expectedFrom?: OrderStatus;
  afterOrderLock?: () => Promise<void>;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new AdminOperationError("A cancellation reason is required", "reason");

  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, input.actorId);
    await lockOrderPayment(tx, input.orderId);
    await lockOrderFulfillment(tx, input.orderId);
    await input.afterOrderLock?.();

    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
    if (!order) throw new AdminOperationError("Order not found");
    if (input.expectedFrom && order.status !== input.expectedFrom) throw new AdminOperationError("Order changed, reload");
    if (!ADMIN_CANCELLABLE.includes(order.status)) {
      throw new AdminOperationError(
        order.status === "CANCELLED"
          ? "Order is already cancelled"
          : "Cancellation after payment is handled through Returns",
      );
    }
    if (order.paymentStatus !== "UNPAID" && order.paymentStatus !== "FAILED") {
      throw new AdminOperationError("A payment is recorded against this order; cancellation after payment is handled through Returns");
    }
    // A governed B2B purchase order is bound to its placed order: the PO moved
    // to ORDERED at placement, PO cancellation is only allowed before that,
    // and re-placement returns this same order. Cancelling here would strand
    // the purchase order with no way back, so refuse until a PO unwind exists.
    if (order.purchaseOrderId) {
      throw new AdminOperationError(
        "This order was placed from a governed purchase order; nothing can return that purchase order to an orderable state, so it cannot be cancelled here",
      );
    }
    // Order.paymentStatus is reconciled from payment attempts; a captured
    // attempt the order row has not caught up with is still money taken.
    const captured = await tx.payment.count({
      where: { orderId: order.id, status: { in: ["PAID", "PARTIALLY_PAID"] } },
    });
    if (captured > 0) {
      throw new AdminOperationError("A captured payment attempt exists for this order; cancellation after payment is handled through Returns");
    }

    const fenced = await tx.inventoryStock.findMany({
      where: { OR: order.items.map((item) => inventoryStockIdentityWhere(item.productId, item.variantId)) },
      select: { id: true },
    });
    await lockInventoryStockRows(tx, fenced.map((row) => row.id));

    let releasedUnits = 0;
    const shortfall: Array<{ sku: string; units: number }> = [];
    for (const item of order.items) {
      let remaining = item.quantity;
      const rows = await tx.inventoryStock.findMany({
        where: inventoryStockIdentityWhere(item.productId, item.variantId),
        orderBy: { updatedAt: "asc" },
      });
      for (const stock of rows) {
        if (remaining <= 0) break;
        const give = Math.min(remaining, stock.reservedQty);
        if (give <= 0) continue;
        const { count } = await tx.inventoryStock.updateMany({
          where: { id: stock.id, qty: stock.qty, reservedQty: stock.reservedQty },
          data: { reservedQty: { decrement: give } },
        });
        if (count !== 1) continue;
        await tx.inventoryMovement.create({
          data: {
            stockId: stock.id,
            type: "RELEASE",
            qty: give,
            reference: order.orderNumber,
            notes: `Order cancelled — reservation released for ${item.sku}`,
            createdBy: input.actorId,
          },
        });
        remaining -= give;
        releasedUnits += give;
      }
      if (remaining > 0) shortfall.push({ sku: item.sku, units: remaining });
    }

    await tx.orderItem.updateMany({
      where: { orderId: order.id, status: { notIn: SHIPPED_STATES } },
      data: { status: "CANCELLED" },
    });
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: order.status, paymentStatus: order.paymentStatus },
      data: { status: "CANCELLED" },
    });
    if (count !== 1) throw new AdminOperationError("Order changed, reload");

    await tx.orderStatusHistory.create({
      data: { orderId: order.id, status: "CANCELLED", message: reason, actorId: input.actorId },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        entityType: "Order",
        entityId: order.id,
        action: AuditAction.STATUS_CHANGE,
        before: { status: order.status, paymentStatus: order.paymentStatus, purchaseOrderId: order.purchaseOrderId },
        after: { status: "CANCELLED", reason, source: "ADMIN_CANCEL", releasedUnits, releaseShortfall: shortfall },
      },
    });
    return { status: "CANCELLED" as const, releasedUnits, shortfall };
  });
}

/**
 * Staff-only annotation. Order.notes is the buyer's own checkout note and
 * OrderStatusHistory is rendered to the buyer, so neither can hold an
 * internal remark. The audit log is admin-only, append-only and actor-stamped,
 * which is exactly what an internal note needs; it is filed under its own
 * entity type so the trail and the order page can list notes without
 * scanning status changes.
 */
export const ORDER_INTERNAL_NOTE_ENTITY = "OrderInternalNote";

export async function addOrderInternalNote(input: { orderId: string; actorId: string; note: string }) {
  const note = input.note.trim();
  if (!note) throw new AdminOperationError("A note is required", "note");
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, input.actorId);
    const order = await tx.order.findUnique({ where: { id: input.orderId }, select: { id: true, status: true } });
    if (!order) throw new AdminOperationError("Order not found");
    return tx.auditLog.create({
      data: {
        actorId: input.actorId,
        entityType: ORDER_INTERNAL_NOTE_ENTITY,
        entityId: order.id,
        action: AuditAction.CREATE,
        after: { note, orderStatus: order.status },
      },
    });
  });
}

// ─── WAREHOUSE STOCK ──────────────────────────────────────────────────────────

/**
 * Platform-side on-hand correction. Mirrors adjustInventory (which requires a
 * seller actor) with admin authority: the same stock fence, the same refusal
 * to go below the reserved quantity, the same compare-and-set and the same
 * ADJUSTMENT movement row, so the movement ledger reads identically whoever
 * made the correction.
 */
export async function adminAdjustStock(input: {
  stockId: string;
  newQty: number;
  reason: string;
  actorId: string;
  reference?: string;
  /** Deterministic seam after the stock fence is held. */
  afterStockLock?: () => Promise<void>;
}) {
  if (!Number.isInteger(input.newQty) || input.newQty < 0) {
    throw new AdminOperationError("On-hand quantity must be a whole number of zero or more", "newQty");
  }
  const reason = input.reason.trim();
  if (!reason) throw new AdminOperationError("An adjustment reason is required", "reason");

  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, input.actorId);
    await lockInventoryStockRows(tx, [input.stockId]);
    await input.afterStockLock?.();

    // Read only after the fence is held: the values compared below are the
    // values every other stock writer serialised on.
    const stock = await tx.inventoryStock.findUnique({
      where: { id: input.stockId },
      include: {
        product: { select: { sellerId: true } },
        variant: { select: { product: { select: { sellerId: true } } } },
      },
    });
    if (!stock) throw new AdminOperationError("Stock record not found");
    const sellerId = stock.product?.sellerId ?? stock.variant?.product.sellerId ?? null;
    if (input.newQty < stock.reservedQty) {
      throw new AdminOperationError(`On-hand cannot go below the ${stock.reservedQty} reserved for open orders`, "newQty");
    }
    if (input.newQty === stock.qty) {
      throw new AdminOperationError(`On-hand is already ${stock.qty}; nothing to adjust`, "newQty");
    }

    const { count } = await tx.inventoryStock.updateMany({
      where: { id: stock.id, qty: stock.qty, reservedQty: stock.reservedQty },
      data: { qty: input.newQty },
    });
    if (count !== 1) throw new AdminOperationError("Stock changed, reload");

    await tx.inventoryMovement.create({
      data: {
        stockId: stock.id,
        type: "ADJUSTMENT",
        qty: input.newQty,
        reference: input.reference?.trim() || undefined,
        notes: reason,
        createdBy: input.actorId,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId,
        entityType: "InventoryStock",
        entityId: stock.id,
        action: AuditAction.UPDATE,
        before: { qty: stock.qty, reservedQty: stock.reservedQty },
        after: {
          qty: input.newQty,
          movementType: "ADJUSTMENT",
          quantity: input.newQty,
          reference: input.reference?.trim() || null,
          reason,
          source: "ADMIN_ADJUST",
        },
      },
    });
    return { previousQty: stock.qty, qty: input.newQty };
  });
}
