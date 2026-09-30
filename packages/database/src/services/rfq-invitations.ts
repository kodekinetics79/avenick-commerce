import { AuditAction, Prisma, type Currency } from "@prisma/client";
import { db } from "../index";
import { lockCompanyApprovalRows, requireCurrentCompanyActor } from "./checkout-invariants";

export interface CreateInvitedRFQInput {
  buyerId: string;
  companyId: string;
  currency: Currency;
  creationKey: string;
  responseDueAt: Date;
  awardByAt: Date;
  requiredBy?: Date;
  notes?: string;
  sellerIds: string[];
  items: Array<{
    nameEn: string;
    quantity: number;
    notes?: string;
    productId?: string;
  }>;
}

function generateRfqNumber(): string {
  const year = new Date().getFullYear();
  const time = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  return `RFQ-${year}-${time}${random}`;
}

function normalizedItems(items: Array<{
  nameEn: string;
  quantity: number;
  notes?: string | null;
  productId?: string | null;
}>) {
  return items
    .map((item) => ({
      nameEn: item.nameEn.trim(),
      quantity: item.quantity,
      notes: item.notes?.trim() || null,
      productId: item.productId || null,
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function validateCreateInput(input: CreateInvitedRFQInput) {
  const creationKey = input.creationKey.trim();
  if (!creationKey || creationKey.length > 200) throw new Error("A bounded RFQ creation key is required");
  if (!input.items.length || input.items.length > 50) throw new Error("An RFQ must contain between 1 and 50 items");
  if (!input.sellerIds.length || input.sellerIds.length > 20) {
    throw new Error("An invited RFQ must select between 1 and 20 suppliers");
  }
  const sellerIds = [...new Set(input.sellerIds)];
  if (sellerIds.length !== input.sellerIds.length || sellerIds.some((id) => !id || id.length > 128)) {
    throw new Error("Invited suppliers must be distinct valid records");
  }
  for (const item of input.items) {
    const name = item.nameEn.trim();
    if (name.length < 2 || name.length > 300) throw new Error("RFQ item descriptions must be between 2 and 300 characters");
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 1_000_000) {
      throw new Error("RFQ item quantity must be a positive whole number within the supported limit");
    }
    if (item.notes && item.notes.trim().length > 500) throw new Error("RFQ item notes are limited to 500 characters");
  }
  if (input.notes && input.notes.trim().length > 2000) throw new Error("RFQ notes are limited to 2000 characters");
  const now = Date.now();
  if (!(input.responseDueAt instanceof Date) || Number.isNaN(input.responseDueAt.getTime()) || input.responseDueAt.getTime() <= now) {
    throw new Error("Supplier response deadline must be in the future");
  }
  if (!(input.awardByAt instanceof Date) || Number.isNaN(input.awardByAt.getTime())
    || input.awardByAt.getTime() <= input.responseDueAt.getTime()) {
    throw new Error("Award deadline must be later than the supplier response deadline");
  }
  if (input.requiredBy && (Number.isNaN(input.requiredBy.getTime()) || input.requiredBy.getTime() <= input.awardByAt.getTime())) {
    throw new Error("Required delivery date must be later than the award deadline");
  }
  return { creationKey, sellerIds };
}

function sameReplay(
  existing: {
    buyerId: string;
    currency: Currency;
    notes: string | null;
    responseDueAt: Date | null;
    awardByAt: Date | null;
    requiredBy: Date | null;
    items: Array<{ nameEn: string; quantity: number; notes: string | null; productId: string | null }>;
    invitations: Array<{ sellerId: string }>;
  },
  input: CreateInvitedRFQInput,
  sellerIds: string[],
) {
  return existing.buyerId === input.buyerId
    && existing.currency === input.currency
    && existing.notes === (input.notes?.trim() || null)
    && existing.responseDueAt?.getTime() === input.responseDueAt.getTime()
    && existing.awardByAt?.getTime() === input.awardByAt.getTime()
    && (existing.requiredBy?.getTime() ?? null) === (input.requiredBy?.getTime() ?? null)
    && JSON.stringify(normalizedItems(existing.items)) === JSON.stringify(normalizedItems(input.items))
    && JSON.stringify(existing.invitations.map((row) => row.sellerId).sort()) === JSON.stringify([...sellerIds].sort());
}

/**
 * Create one private RFQ and all supplier invitations atomically.
 * The company-scoped creation key makes browser retries return the same RFQ;
 * reuse with different requirements fails closed.
 */
export async function createInvitedRFQ(input: CreateInvitedRFQInput) {
  const { creationKey, sellerIds } = validateCreateInput(input);

  return db.$transaction(async (tx) => {
    await lockCompanyApprovalRows(tx, [input.companyId]);
    await requireCurrentCompanyActor(tx, { companyId: input.companyId, actorId: input.buyerId }, [
      "COMPANY_ADMIN",
      "COMPANY_BUYER",
    ]);

    const replay = await tx.rFQRequest.findUnique({
      where: { companyId_creationKey: { companyId: input.companyId, creationKey } },
      include: { items: true, invitations: true },
    });
    if (replay) {
      if (!sameReplay(replay, input, sellerIds)) throw new Error("RFQ creation key was already used for different requirements");
      return replay;
    }

    const sellers = await tx.sellerProfile.findMany({
      where: { id: { in: sellerIds }, status: "ACTIVE", deletedAt: null },
      select: { id: true, userId: true },
    });
    if (sellers.length !== sellerIds.length) throw new Error("Every invited supplier must be active");

    const productIds = [...new Set(input.items.flatMap((item) => item.productId ? [item.productId] : []))];
    if (productIds.length) {
      const availableProducts = await tx.product.count({
        where: { id: { in: productIds }, status: "ACTIVE", deletedAt: null, isB2BEnabled: true },
      });
      if (availableProducts !== productIds.length) throw new Error("Referenced RFQ products must be active for business purchasing");
    }

    const rfq = await tx.rFQRequest.create({
      data: {
        rfqNumber: generateRfqNumber(),
        buyerId: input.buyerId,
        companyId: input.companyId,
        creationKey,
        status: "SUBMITTED",
        currency: input.currency,
        notes: input.notes?.trim() || null,
        responseDueAt: input.responseDueAt,
        awardByAt: input.awardByAt,
        expiresAt: input.awardByAt,
        requiredBy: input.requiredBy,
        items: {
          create: input.items.map((item) => ({
            nameEn: item.nameEn.trim(),
            quantity: item.quantity,
            notes: item.notes?.trim() || null,
            productId: item.productId,
          })),
        },
        invitations: {
          create: sellerIds.map((sellerId) => ({ sellerId, invitedById: input.buyerId })),
        },
      },
      include: { items: true, invitations: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.buyerId,
        companyId: input.companyId,
        entityType: "RFQRequest",
        entityId: rfq.id,
        action: AuditAction.CREATE,
        after: {
          status: rfq.status,
          currency: rfq.currency,
          lineCount: rfq.items.length,
          invitationCount: rfq.invitations.length,
          responseDueAt: rfq.responseDueAt?.toISOString(),
          awardByAt: rfq.awardByAt?.toISOString(),
        },
      },
    });

    const invitationBySeller = new Map(rfq.invitations.map((invitation) => [invitation.sellerId, invitation.id]));
    await tx.notification.createMany({
      data: sellers.map((seller) => ({
        userId: seller.userId,
        type: "RFQ" as const,
        titleEn: "New private RFQ invitation",
        bodyEn: `You have been invited to quote ${rfq.rfqNumber}.`,
        data: { rfqId: rfq.id, invitationId: invitationBySeller.get(seller.id) },
      })),
    });

    return rfq;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
