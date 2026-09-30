import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { integrationSuite } from "../testing/integration-db";
import { acceptSupplierQuote, submitSupplierQuote, type SubmitSupplierQuoteInput } from "../services/rfq";

const run = integrationSuite();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

let companyId = "";
let buyerAId = "";
let buyerBId = "";
let adminId = "";
let sellerAId = "";
let sellerBId = "";
let sellerCId = "";
let sellerAOwnerId = "";
let sellerBOwnerId = "";
let sellerCOwnerId = "";
let productAId = "";
let productBId = "";
let productCId = "";
let categoryId = "";
const createdUserIds: string[] = [];

run("multi-supplier RFQ commercial foundation", () => {
  beforeAll(async () => {
    const [buyerA, buyerB, admin, ownerA, ownerB, ownerC] = await Promise.all([
      db.user.create({ data: { email: `rfq-buyer-a-${stamp}@example.test`, firstName: "Buyer", lastName: "A", role: "COMPANY_BUYER", status: "ACTIVE" } }),
      db.user.create({ data: { email: `rfq-buyer-b-${stamp}@example.test`, firstName: "Buyer", lastName: "B", role: "COMPANY_BUYER", status: "ACTIVE" } }),
      db.user.create({ data: { email: `rfq-admin-${stamp}@example.test`, firstName: "Company", lastName: "Admin", role: "COMPANY_ADMIN", status: "ACTIVE" } }),
      db.user.create({ data: { email: `rfq-owner-a-${stamp}@example.test`, firstName: "Seller", lastName: "A", role: "SELLER_OWNER", status: "ACTIVE" } }),
      db.user.create({ data: { email: `rfq-owner-b-${stamp}@example.test`, firstName: "Seller", lastName: "B", role: "SELLER_OWNER", status: "ACTIVE" } }),
      db.user.create({ data: { email: `rfq-owner-c-${stamp}@example.test`, firstName: "Seller", lastName: "C", role: "SELLER_OWNER", status: "ACTIVE" } }),
    ]);
    buyerAId = buyerA.id;
    buyerBId = buyerB.id;
    adminId = admin.id;
    sellerAOwnerId = ownerA.id;
    sellerBOwnerId = ownerB.id;
    sellerCOwnerId = ownerC.id;
    createdUserIds.push(buyerA.id, buyerB.id, admin.id, ownerA.id, ownerB.id, ownerC.id);

    const company = await db.company.create({ data: {
      nameEn: `RFQ Company ${stamp}`, industry: "OTHER", size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE",
      members: { create: [
        { userId: buyerA.id, role: "COMPANY_BUYER", isActive: true },
        { userId: buyerB.id, role: "COMPANY_BUYER", isActive: true },
        { userId: admin.id, role: "COMPANY_ADMIN", isActive: true },
      ] },
    } });
    companyId = company.id;

    const [sellerA, sellerB, sellerC, category] = await Promise.all([
      db.sellerProfile.create({ data: { userId: ownerA.id, businessNameEn: `RFQ Supplier A ${stamp}`, crNumber: `RFQA-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
      db.sellerProfile.create({ data: { userId: ownerB.id, businessNameEn: `RFQ Supplier B ${stamp}`, crNumber: `RFQB-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
      db.sellerProfile.create({ data: { userId: ownerC.id, businessNameEn: `RFQ Supplier C ${stamp}`, crNumber: `RFQC-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
      db.category.create({ data: { nameEn: `RFQ Parts ${stamp}`, nameAr: "قطع", slug: `rfq-parts-${stamp}`, isActive: true } }),
    ]);
    sellerAId = sellerA.id;
    sellerBId = sellerB.id;
    sellerCId = sellerC.id;
    categoryId = category.id;

    const [productA, productB, productC] = await Promise.all([
      db.product.create({ data: { sellerId: sellerA.id, categoryId: category.id, sku: `RFQA-${stamp}`, slug: `rfqa-${stamp}`, nameEn: "Supplier A pump", nameAr: "مضخة أ", status: "ACTIVE", isB2BEnabled: true } }),
      db.product.create({ data: { sellerId: sellerB.id, categoryId: category.id, sku: `RFQB-${stamp}`, slug: `rfqb-${stamp}`, nameEn: "Supplier B pump", nameAr: "مضخة ب", status: "ACTIVE", isB2BEnabled: true } }),
      db.product.create({ data: { sellerId: sellerC.id, categoryId: category.id, sku: `RFQC-${stamp}`, slug: `rfqc-${stamp}`, nameEn: "Supplier C pump", nameAr: "مضخة ج", status: "ACTIVE", isB2BEnabled: true } }),
    ]);
    productAId = productA.id;
    productBId = productB.id;
    productCId = productC.id;
  });

  afterAll(async () => {
    if (!createdUserIds.length) return;
    const sellerIds = [sellerAId, sellerBId, sellerCId].filter(Boolean);
    const productIds = [productAId, productBId, productCId].filter(Boolean);
    await db.$transaction(async (tx) => {
      // These are immutable commercial records by design. The integration gate
      // limits this suite to an explicitly disposable database; a transaction-
      // local replica role lets cleanup remove only this suite's stamped rows
      // without weakening or globally disabling production triggers.
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
      await tx.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
      await tx.auditLog.deleteMany({ where: {
        OR: [{ actorId: { in: createdUserIds } }, ...(companyId ? [{ companyId }] : [])],
      } });
      if (companyId) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { companyId } } });
        await tx.purchaseOrder.deleteMany({ where: { companyId } });
        await tx.rFQQuoteItem.deleteMany({ where: { quote: { rfq: { companyId } } } });
        await tx.rFQQuote.deleteMany({ where: { rfq: { companyId } } });
        await tx.rFQSupplierInvitation.deleteMany({ where: { rfq: { companyId } } });
        await tx.rFQItem.deleteMany({ where: { rfq: { companyId } } });
        await tx.rFQRequest.deleteMany({ where: { companyId } });
      }
      if (productIds.length) await tx.product.deleteMany({ where: { id: { in: productIds } } });
      if (categoryId) await tx.category.deleteMany({ where: { id: categoryId } });
      if (sellerIds.length) await tx.sellerProfile.deleteMany({ where: { id: { in: sellerIds } } });
      if (companyId) {
        await tx.companyMember.deleteMany({ where: { companyId } });
        await tx.company.deleteMany({ where: { id: companyId } });
      }
      await tx.user.deleteMany({ where: { id: { in: createdUserIds } } });
    });
  });

  async function createRfq(label: string, buyerId = buyerAId) {
    return db.rFQRequest.create({
      data: {
        rfqNumber: `RFQ-W1-${label}-${stamp}`,
        buyerId,
        companyId,
        status: "SUBMITTED",
        currency: "AED",
        responseDueAt: new Date(Date.now() + 3_600_000),
        awardByAt: new Date(Date.now() + 7_200_000),
        expiresAt: new Date(Date.now() + 10_800_000),
        items: { create: [
          { nameEn: "Industrial pump", quantity: 2 },
          { nameEn: "Seal kit", quantity: 3 },
        ] },
        invitations: { create: [
          { sellerId: sellerAId, invitedById: buyerId },
          { sellerId: sellerBId, invitedById: buyerId },
        ] },
      },
      include: { items: { orderBy: { nameEn: "asc" } } },
    });
  }

  function quoteInput(
    rfq: Awaited<ReturnType<typeof createRfq>>,
    seller: "A" | "B" | "C",
    key: string,
    price = 10,
  ): SubmitSupplierQuoteInput {
    const config = seller === "A"
      ? { sellerId: sellerAId, actorId: sellerAOwnerId, productId: productAId }
      : seller === "B"
        ? { sellerId: sellerBId, actorId: sellerBOwnerId, productId: productBId }
        : { sellerId: sellerCId, actorId: sellerCOwnerId, productId: productCId };
    return {
      rfqId: rfq.id,
      ...config,
      submissionKey: `${key}-${stamp}`,
      items: rfq.items.map((item, index) => ({
        rfqItemId: item.id,
        productId: config.productId,
        unitPrice: price + index,
        vatRate: 5,
      })),
      freightAmount: 25,
      freightVatRate: 5,
      validUntil: new Date(Date.now() + 86_400_000),
      leadTimeDays: 7,
      paymentTermsDays: 30,
    };
  }

  it("accepts two invited suppliers and makes retry/revision semantics deterministic", async () => {
    const rfq = await createRfq("REVISIONS");
    const inputA = quoteInput(rfq, "A", "revision-a", 10);
    const inputB = quoteInput(rfq, "B", "revision-b", 12);
    const [quoteA, quoteB] = await Promise.all([submitSupplierQuote(inputA), submitSupplierQuote(inputB)]);
    expect(quoteA).toMatchObject({ sellerId: sellerAId, revision: 1, status: "SUBMITTED" });
    expect(quoteB).toMatchObject({ sellerId: sellerBId, revision: 1, status: "SUBMITTED" });

    const replay = await submitSupplierQuote(inputA);
    expect(replay.id).toBe(quoteA.id);
    await expect(submitSupplierQuote({ ...inputA, freightAmount: inputA.freightAmount + 1 }))
      .rejects.toThrow(/Idempotency-Key/i);
    const revision = await submitSupplierQuote(quoteInput(rfq, "A", "revision-a-2", 15));
    expect(revision).toMatchObject({ sellerId: sellerAId, revision: 2, status: "SUBMITTED" });
    await expect(db.rFQQuote.findUniqueOrThrow({ where: { id: quoteA.id } })).resolves.toMatchObject({
      status: "SUPERSEDED", supersededById: revision.id,
    });

    await expect(submitSupplierQuote(quoteInput(rfq, "C", "uninvited", 9))).rejects.toThrow(/invitation/i);
    await expect(submitSupplierQuote({ ...quoteInput(rfq, "A", "wrong-actor", 9), actorId: sellerBOwnerId }))
      .rejects.toThrow(/seller/i);
    await expect(db.rFQQuoteItem.create({ data: {
      quoteId: revision.id, rfqItemId: rfq.items[0]!.id, productId: productAId,
      sku: "FORGED", nameEn: "Forged", quantity: 1, unitPrice: 1, vatRate: 5,
      lineSubtotal: 1, lineVatAmount: 0.05, lineTotal: 1.05,
    } })).rejects.toThrow(/immutable/i);
  });

  it("allows only the RFQ buyer or a company admin to award and preserves the requester", async () => {
    const rfq = await createRfq("ACTOR-SCOPE", buyerBId);
    const quote = await submitSupplierQuote(quoteInput(rfq, "A", "actor-scope", 20));
    await expect(acceptSupplierQuote({
      rfqId: rfq.id, quoteId: quote.id, companyId, actorId: buyerAId,
      expectedFingerprint: quote.commercialFingerprint,
    })).rejects.toThrow(/admin may award another buyer/i);

    const accepted = await acceptSupplierQuote({
      rfqId: rfq.id, quoteId: quote.id, companyId, actorId: adminId,
      expectedFingerprint: quote.commercialFingerprint,
    });
    expect(accepted.purchaseOrder).toMatchObject({ status: "DRAFT", requesterId: buyerBId, sourceRfqQuoteId: quote.id });
  });

  it("gives concurrent awards one winner and creates one exact draft PO snapshot", async () => {
    const rfq = await createRfq("AWARD-RACE");
    const [quoteA, quoteB] = await Promise.all([
      submitSupplierQuote(quoteInput(rfq, "A", "award-a", 30)),
      submitSupplierQuote(quoteInput(rfq, "B", "award-b", 28)),
    ]);
    const outcomes = await Promise.allSettled([quoteA, quoteB].map((quote) => acceptSupplierQuote({
      rfqId: rfq.id, quoteId: quote.id, companyId, actorId: buyerAId,
      expectedFingerprint: quote.commercialFingerprint,
    })));
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);

    const finalRfq = await db.rFQRequest.findUniqueOrThrow({ where: { id: rfq.id } });
    const acceptedQuote = await db.rFQQuote.findUniqueOrThrow({
      where: { id: finalRfq.acceptedQuoteId! }, include: { items: { orderBy: { rfqItemId: "asc" } } },
    });
    const po = await db.purchaseOrder.findUniqueOrThrow({
      where: { sourceRfqQuoteId: acceptedQuote.id }, include: { items: { orderBy: { sourceRfqQuoteItemId: "asc" } } },
    });
    expect(po).toMatchObject({
      status: "DRAFT", requesterId: buyerAId, currency: acceptedQuote.currency,
      sourceRfqQuoteId: acceptedQuote.id,
    });
    expect(po.total.toFixed(2)).toBe(acceptedQuote.total.toFixed(2));
    expect(po.subtotal?.toFixed(2)).toBe(acceptedQuote.subtotal.toFixed(2));
    expect(po.vatAmount?.toFixed(2)).toBe(acceptedQuote.vatAmount.toFixed(2));
    expect(po.freightAmount?.toFixed(2)).toBe(acceptedQuote.freightAmount.toFixed(2));
    expect(po.freightVatRate?.toFixed(2)).toBe(acceptedQuote.freightVatRate.toFixed(2));
    expect(po.freightVatAmount?.toFixed(2)).toBe(acceptedQuote.freightVatAmount.toFixed(2));
    expect(po.items.map((line) => line.sourceRfqQuoteItemId).sort()).toEqual(acceptedQuote.items.map((line) => line.id).sort());
    expect(await db.purchaseOrder.count({ where: { sourceRfqQuoteId: acceptedQuote.id } })).toBe(1);
    await expect(db.purchaseOrderItem.delete({ where: { id: po.items[0]!.id } }))
      .rejects.toThrow(/cannot be deleted/i);

    const losingQuote = acceptedQuote.id === quoteA.id ? quoteB : quoteA;
    const losingOwnerId = losingQuote.sellerId === sellerAId ? sellerAOwnerId : sellerBOwnerId;
    const loserNotice = await db.notification.findFirstOrThrow({
      where: { userId: losingOwnerId, type: "RFQ", data: { path: ["rfqId"], equals: rfq.id } },
      orderBy: { createdAt: "desc" },
    });
    expect(loserNotice.data).toEqual({ rfqId: rfq.id, status: "CLOSED" });

    const replay = await acceptSupplierQuote({
      rfqId: rfq.id, quoteId: acceptedQuote.id, companyId, actorId: buyerAId,
      expectedFingerprint: acceptedQuote.commercialFingerprint,
    });
    expect(replay.purchaseOrder.id).toBe(po.id);
  });

  it("revalidates invitation eligibility and RFQ line requirements at award time", async () => {
    const closedRfq = await createRfq("CLOSED-INVITE");
    const closedQuote = await submitSupplierQuote(quoteInput(closedRfq, "A", "closed-invite", 32));
    await db.rFQSupplierInvitation.update({
      where: { rfqId_sellerId: { rfqId: closedRfq.id, sellerId: sellerAId } },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await expect(acceptSupplierQuote({
      rfqId: closedRfq.id, quoteId: closedQuote.id, companyId, actorId: buyerAId,
      expectedFingerprint: closedQuote.commercialFingerprint,
    })).rejects.toThrow(/invitation is no longer awardable/i);

    const changedRfq = await createRfq("CHANGED-REQUIREMENTS");
    const changedQuote = await submitSupplierQuote(quoteInput(changedRfq, "A", "changed-requirements", 34));
    await db.rFQItem.update({ where: { id: changedRfq.items[0]!.id }, data: { quantity: 99 } });
    await expect(acceptSupplierQuote({
      rfqId: changedRfq.id, quoteId: changedQuote.id, companyId, actorId: buyerAId,
      expectedFingerprint: changedQuote.commercialFingerprint,
    })).rejects.toThrow(/requirements changed/i);
  });

  it("rolls back award, PO, audit and notifications when the atomic path faults", async () => {
    const rfq = await createRfq("ROLLBACK");
    const quote = await submitSupplierQuote(quoteInput(rfq, "A", "rollback", 40));
    await expect(acceptSupplierQuote({
      rfqId: rfq.id, quoteId: quote.id, companyId, actorId: buyerAId,
      expectedFingerprint: quote.commercialFingerprint,
      faultAfterPurchaseOrderCreate: () => { throw new Error("forced rollback"); },
    })).rejects.toThrow("forced rollback");

    await expect(db.rFQRequest.findUniqueOrThrow({ where: { id: rfq.id } })).resolves.toMatchObject({
      status: "QUOTED", acceptedQuoteId: null,
    });
    await expect(db.rFQQuote.findUniqueOrThrow({ where: { id: quote.id } })).resolves.toMatchObject({ status: "SUBMITTED" });
    expect(await db.purchaseOrder.count({ where: { sourceRfqQuoteId: quote.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { entityType: "RFQQuote", entityId: quote.id, action: "APPROVE" } })).toBe(0);
  });
});
