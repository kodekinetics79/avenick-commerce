import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "../client";

/**
 * Seller-safe order projection. Never returns marketplace-wide order totals or
 * another seller's line items.
 */
export async function getSellerOrderProjections(
  sellerId: string,
  params: { page?: number; limit?: number; status?: OrderStatus },
) {
  const { page = 1, limit = 20, status } = params;
  const where: Prisma.OrderWhereInput = {
    items: { some: { sellerId } },
    ...(status ? { status } : {}),
  };
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        currency: true,
        type: true,
        status: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        company: { select: { nameEn: true, nameAr: true } },
        items: {
          where: { sellerId },
          include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
        },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.order.count({ where }),
  ]);

  return {
    orders: orders.map((order) => ({
      ...order,
      subtotal: order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0),
      vatAmount: order.items.reduce((sum, item) => sum + Number(item.vatAmount), 0),
      total: order.items.reduce((sum, item) => sum + Number(item.total), 0),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
