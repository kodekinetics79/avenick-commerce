import { db } from "../index";
import type { Prisma, OrderStatus, Currency, PaymentMethod } from "@prisma/client";

export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `MNZ-${year}-${rand}`;
}

export interface CreateOrderInput {
  userId: string;
  companyId?: string;
  type: "B2C" | "B2B";
  currency: Currency;
  items: { productId: string; variantId?: string; quantity: number; unitPrice: number; sellerId: string; vatRate?: number }[];
  shippingAddress: Record<string, string>;
  paymentMethod?: PaymentMethod;
  notes?: string;
  purchaseOrderId?: string;
}

export async function createOrder(input: CreateOrderInput) {
  const vatRate = input.currency === "SAR" ? 15 : 5;

  let subtotal = 0;
  const itemData = input.items.map((item) => {
    const effectiveVat = item.vatRate ?? vatRate;
    const vatAmount = parseFloat(((item.unitPrice * item.quantity * effectiveVat) / 100).toFixed(2));
    const total = parseFloat((item.unitPrice * item.quantity + vatAmount).toFixed(2));
    subtotal += item.unitPrice * item.quantity;
    return { ...item, vatRate: effectiveVat, vatAmount, total };
  });

  const vatAmount = parseFloat(((subtotal * vatRate) / 100).toFixed(2));
  const total = parseFloat((subtotal + vatAmount).toFixed(2));

  // Fetch product names for order items
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await db.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const order = await db.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: input.userId,
      companyId: input.companyId,
      purchaseOrderId: input.purchaseOrderId,
      type: input.type,
      currency: input.currency,
      subtotal,
      vatAmount,
      total,
      paymentMethod: input.paymentMethod,
      shippingAddress: input.shippingAddress,
      notes: input.notes,
      items: {
        create: itemData.map((item) => {
          const product = productMap.get(item.productId);
          return {
            productId: item.productId,
            variantId: item.variantId,
            sellerId: item.sellerId,
            sku: product?.sku ?? "UNKNOWN",
            nameEn: product?.nameEn ?? "Product",
            nameAr: product?.nameAr ?? "منتج",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            vatAmount: item.vatAmount,
            total: item.total,
          };
        }),
      },
      statusHistory: {
        create: { status: "PENDING_PAYMENT", message: "Order created, awaiting payment" },
      },
    },
    include: { items: true, statusHistory: true },
  });

  // Reserve inventory
  for (const item of input.items) {
    const stock = await db.inventoryStock.findFirst({ where: { productId: item.productId } });
    if (stock) {
      await db.inventoryStock.update({ where: { id: stock.id }, data: { reservedQty: { increment: item.quantity } } });
    }
  }

  return order;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, actorId?: string, message?: string) {
  const [order] = await db.$transaction([
    db.order.update({ where: { id: orderId }, data: { status } }),
    db.orderStatusHistory.create({ data: { orderId, status, message, actorId } }),
  ]);
  return order;
}

export async function getOrdersForSeller(sellerId: string, params: { page?: number; limit?: number; status?: OrderStatus }) {
  const { page = 1, limit = 20, status } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    items: { some: { sellerId } },
    ...(status && { status }),
  };

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        items: { where: { sellerId }, include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
        user: { select: { firstName: true, lastName: true, email: true } },
        company: { select: { nameEn: true, nameAr: true } },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.order.count({ where }),
  ]);

  return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
}
