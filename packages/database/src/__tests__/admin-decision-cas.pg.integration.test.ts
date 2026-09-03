import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  DocumentNotPendingError,
  ProductNotPendingError,
  SellerNotPendingError,
  approveProduct,
  approveSeller,
  rejectProduct,
  rejectSeller,
  reviewDocument,
} from "../services/admin";
import { SUPERSEDED_REJECTION_REASON, sellerDocumentKeyPrefix } from "../services/seller-documents";

/**
 * Admin review decisions against a real Postgres.
 *
 * What is under test is the compare-and-set on PENDING_REVIEW: a decision
 * reaching a row that has already moved (withdrawn, decided, suppressed,
 * replaced) must write nothing, audit nothing, and say so with a typed error
 * — never flip the row. Approving a document must also retire the older
 * approved one of the same type. Skipped without DATABASE_URL, like the
 * other pg suites.
 */
const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const stamp = `admin-cas-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const created = {
  users: [] as string[],
  sellers: [] as string[],
  categories: [] as string[],
  products: [] as string[],
  documents: [] as string[],
};
let adminId = "";
let sellerId = "";
let categoryId = "";
let productSeq = 0;
let documentSeq = 0;

async function makeProduct(status: "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "SUPPRESSED" | "REJECTED", publishedAt: Date | null = null) {
  productSeq += 1;
  const product = await db.product.create({
    data: {
      sellerId,
      categoryId,
      sku: `${stamp}-p${productSeq}`,
      slug: `${stamp}-p${productSeq}`.toLowerCase(),
      nameEn: `Product ${productSeq} ${stamp}`,
      nameAr: `Product ${productSeq} ${stamp}`,
      status,
      publishedAt,
    },
  });
  created.products.push(product.id);
  return product;
}

async function makeDocument(type: "TRADE_LICENSE" | "VAT_CERTIFICATE", status: "PENDING_REVIEW" | "APPROVED" | "REJECTED", extra: { reviewedBy?: string; rejectionReason?: string } = {}) {
  documentSeq += 1;
  const document = await db.sellerDocument.create({
    data: {
      sellerId,
      type,
      status,
      fileUrl: `${sellerDocumentKeyPrefix(sellerId)}doc-${stamp}-${documentSeq}.pdf`,
      fileName: `${type.toLowerCase()}-${documentSeq}.pdf`,
      reviewedAt: status === "PENDING_REVIEW" ? null : new Date(Date.now() - 60_000),
      reviewedBy: status === "PENDING_REVIEW" ? null : extra.reviewedBy ?? null,
      rejectionReason: extra.rejectionReason ?? null,
    },
  });
  created.documents.push(document.id);
  return document;
}

/**
 * A seller application in a given state. Each case gets its own because a
 * decision is terminal — reusing one would make the second assertion depend on
 * the first case's outcome.
 */
let applicantSeq = 0;
async function makeApplicant(status: "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED") {
  applicantSeq += 1;
  const owner = await db.user.create({
    data: { email: `${stamp}-applicant${applicantSeq}@test.invalid`, firstName: "Applicant", lastName: `${applicantSeq}`, role: "SELLER_OWNER", status: "ACTIVE" },
  });
  created.users.push(owner.id);
  const seller = await db.sellerProfile.create({
    data: { userId: owner.id, businessNameEn: `Applicant ${applicantSeq} ${stamp}`, crNumber: `CR-${stamp}-a${applicantSeq}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status },
  });
  created.sellers.push(seller.id);
  return seller;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const [admin, owner] = await Promise.all([
    db.user.create({ data: { email: `${stamp}-admin@test.invalid`, firstName: "Review", lastName: "Admin", role: "ADMIN", status: "ACTIVE" } }),
    db.user.create({ data: { email: `${stamp}-owner@test.invalid`, firstName: "Review", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  created.users.push(admin.id, owner.id);
  adminId = admin.id;

  const seller = await db.sellerProfile.create({
    data: { userId: owner.id, businessNameEn: `Review ${stamp}`, crNumber: `CR-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" },
  });
  created.sellers.push(seller.id);
  sellerId = seller.id;

  const category = await db.category.create({ data: { nameEn: `Root ${stamp}`, nameAr: `Root ${stamp}`, slug: `root-${stamp}` } });
  created.categories.push(category.id);
  categoryId = category.id;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await db.auditLog.deleteMany({
    where: { OR: [{ actorId: { in: created.users } }, { sellerId: { in: created.sellers } }, { entityId: { in: [...created.products, ...created.documents] } }] },
  });
  // ProductIssue cascades from Product; nothing else hangs off these fixtures.
  await db.product.deleteMany({ where: { id: { in: created.products } } });
  await db.sellerDocument.deleteMany({ where: { id: { in: created.documents } } });
  await db.category.deleteMany({ where: { id: { in: created.categories } } });
  await db.sellerProfile.deleteMany({ where: { id: { in: created.sellers } } });
  await db.user.deleteMany({ where: { id: { in: created.users } } });
});

run("admin product decisions compare-and-set on PENDING_REVIEW", () => {
  it("approves a listing that is awaiting review and stamps publishedAt", async () => {
    const product = await makeProduct("PENDING_REVIEW");
    const approved = await approveProduct(product.id, adminId);
    expect(approved.status).toBe("ACTIVE");
    expect(approved.publishedAt).toBeInstanceOf(Date);
    const audit = await db.auditLog.findMany({ where: { entityType: "Product", entityId: product.id, action: "APPROVE" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.before).toMatchObject({ status: "PENDING_REVIEW" });
  });

  it("refuses to approve a DRAFT the seller withdrew and leaves it DRAFT with no audit row", async () => {
    const product = await makeProduct("DRAFT");
    const attempt = approveProduct(product.id, adminId);
    await expect(attempt).rejects.toBeInstanceOf(ProductNotPendingError);
    await expect(attempt).rejects.toMatchObject({ productId: product.id, currentStatus: "DRAFT" });
    await expect(db.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ status: "DRAFT", publishedAt: null });
    expect(await db.auditLog.count({ where: { entityType: "Product", entityId: product.id } })).toBe(0);
  });

  it("refuses a second decision on a listing another admin already approved", async () => {
    const product = await makeProduct("PENDING_REVIEW");
    await approveProduct(product.id, adminId);
    await expect(rejectProduct(product.id, adminId, "Second reviewer disagreed")).rejects.toMatchObject({ name: "ProductNotPendingError", currentStatus: "ACTIVE" });
    await expect(db.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ status: "ACTIVE" });
    expect(await db.productIssue.count({ where: { productId: product.id, issueType: "REJECTED_BY_ADMIN" } })).toBe(0);
    expect(await db.auditLog.count({ where: { entityType: "Product", entityId: product.id, action: "REJECT" } })).toBe(0);
  });

  it("refuses to flip a platform-suppressed listing to ACTIVE or REJECTED", async () => {
    const product = await makeProduct("SUPPRESSED", new Date());
    await expect(approveProduct(product.id, adminId)).rejects.toMatchObject({ name: "ProductNotPendingError", currentStatus: "SUPPRESSED" });
    await expect(rejectProduct(product.id, adminId, "Stale queue")).rejects.toMatchObject({ name: "ProductNotPendingError", currentStatus: "SUPPRESSED" });
    await expect(db.product.findUniqueOrThrow({ where: { id: product.id } })).resolves.toMatchObject({ status: "SUPPRESSED" });
  });

  it("rejects a listing that is awaiting review, records the reason and opens the seller-facing issue", async () => {
    const product = await makeProduct("PENDING_REVIEW");
    const rejected = await rejectProduct(product.id, adminId, "Images do not show the product");
    expect(rejected.status).toBe("REJECTED");
    const issue = await db.productIssue.findFirst({ where: { productId: product.id, issueType: "REJECTED_BY_ADMIN", resolvedAt: null } });
    expect(issue?.message).toBe("Images do not show the product");
    const audit = await db.auditLog.findFirst({ where: { entityType: "Product", entityId: product.id, action: "REJECT" } });
    expect(audit?.after).toMatchObject({ status: "REJECTED", reason: "Images do not show the product" });
  });
});

run("admin document decisions compare-and-set on PENDING_REVIEW", () => {
  it("refuses to decide a document that was already rejected and leaves it untouched", async () => {
    const document = await makeDocument("VAT_CERTIFICATE", "REJECTED", { reviewedBy: adminId, rejectionReason: "Unreadable scan" });
    const attempt = reviewDocument(document.id, "APPROVED", adminId);
    await expect(attempt).rejects.toBeInstanceOf(DocumentNotPendingError);
    await expect(attempt).rejects.toMatchObject({ documentId: document.id, currentStatus: "REJECTED" });
    await expect(db.sellerDocument.findUniqueOrThrow({ where: { id: document.id } })).resolves.toMatchObject({ status: "REJECTED", rejectionReason: "Unreadable scan" });
    expect(await db.auditLog.count({ where: { entityType: "SellerDocument", entityId: document.id } })).toBe(0);
  });

  it("refuses to re-approve a row the seller already replaced", async () => {
    const superseded = await makeDocument("VAT_CERTIFICATE", "REJECTED", { rejectionReason: SUPERSEDED_REJECTION_REASON });
    await expect(reviewDocument(superseded.id, "APPROVED", adminId)).rejects.toMatchObject({ name: "DocumentNotPendingError", currentStatus: "REJECTED" });
    await expect(db.sellerDocument.findUniqueOrThrow({ where: { id: superseded.id } })).resolves.toMatchObject({ status: "REJECTED", rejectionReason: SUPERSEDED_REJECTION_REASON });
  });

  it("only records APPROVED or REJECTED as a decision", async () => {
    const document = await makeDocument("VAT_CERTIFICATE", "PENDING_REVIEW");
    await expect(reviewDocument(document.id, "PENDING_REVIEW", adminId)).rejects.toThrow(/APPROVED or REJECTED/);
    await expect(reviewDocument(document.id, "EXPIRED", adminId)).rejects.toThrow(/APPROVED or REJECTED/);
    await expect(db.sellerDocument.findUniqueOrThrow({ where: { id: document.id } })).resolves.toMatchObject({ status: "PENDING_REVIEW", reviewedAt: null });
  });

  it("refuses a rejection with no reason, so a refusal can never look like a supersession", async () => {
    const document = await makeDocument("VAT_CERTIFICATE", "PENDING_REVIEW");
    await expect(reviewDocument(document.id, "REJECTED", adminId)).rejects.toThrow(/needs a reason/);
    await expect(reviewDocument(document.id, "REJECTED", adminId, "   ")).rejects.toThrow(/needs a reason/);
    await expect(db.sellerDocument.findUniqueOrThrow({ where: { id: document.id } })).resolves.toMatchObject({ status: "PENDING_REVIEW", reviewedAt: null });
    expect(await db.auditLog.count({ where: { entityType: "SellerDocument", entityId: document.id } })).toBe(0);
  });

  it("approving a renewal retires the older approved document of the same type and audits both", async () => {
    const older = await makeDocument("TRADE_LICENSE", "APPROVED", { reviewedBy: adminId });
    const otherType = await makeDocument("VAT_CERTIFICATE", "APPROVED", { reviewedBy: adminId });
    const renewal = await makeDocument("TRADE_LICENSE", "PENDING_REVIEW");

    const decided = await reviewDocument(renewal.id, "APPROVED", adminId);
    expect(decided).toMatchObject({ id: renewal.id, status: "APPROVED", reviewedBy: adminId, rejectionReason: null });
    expect(decided.reviewedAt).toBeInstanceOf(Date);

    // Exactly one approved TRADE_LICENSE stands; the retired one reads as
    // superseded, not as a refusal, and keeps its original review stamp.
    const retired = await db.sellerDocument.findUniqueOrThrow({ where: { id: older.id } });
    expect(retired).toMatchObject({ status: "REJECTED", rejectionReason: SUPERSEDED_REJECTION_REASON, reviewedBy: adminId });
    expect(retired.reviewedAt?.getTime()).toBe(older.reviewedAt?.getTime());
    expect(await db.sellerDocument.count({ where: { sellerId, type: "TRADE_LICENSE", status: "APPROVED" } })).toBe(1);

    // A different type is not touched.
    await expect(db.sellerDocument.findUniqueOrThrow({ where: { id: otherType.id } })).resolves.toMatchObject({ status: "APPROVED" });

    const decisionAudit = await db.auditLog.findMany({ where: { entityType: "SellerDocument", entityId: renewal.id } });
    expect(decisionAudit).toHaveLength(1);
    expect(decisionAudit[0]!.after).toMatchObject({ status: "APPROVED" });
    const supersessionAudit = await db.auditLog.findMany({ where: { entityType: "SellerDocument", entityId: older.id } });
    expect(supersessionAudit).toHaveLength(1);
    expect(supersessionAudit[0]!.before).toMatchObject({ status: "APPROVED" });
    expect(supersessionAudit[0]!.after).toMatchObject({ status: "REJECTED", reason: SUPERSEDED_REJECTION_REASON, supersededBy: renewal.id });

    // The renewal, now decided, cannot be decided again.
    await expect(reviewDocument(renewal.id, "REJECTED", adminId, "Changed my mind")).rejects.toMatchObject({ name: "DocumentNotPendingError", currentStatus: "APPROVED" });
  });

  it("rejecting a renewal leaves the standing approved document in place", async () => {
    const standing = await makeDocument("VAT_CERTIFICATE", "APPROVED", { reviewedBy: adminId });
    const renewal = await makeDocument("VAT_CERTIFICATE", "PENDING_REVIEW");
    const decided = await reviewDocument(renewal.id, "REJECTED", adminId, "Expired before it reached us");
    expect(decided).toMatchObject({ status: "REJECTED", rejectionReason: "Expired before it reached us", reviewedBy: adminId });
    await expect(db.sellerDocument.findUniqueOrThrow({ where: { id: standing.id } })).resolves.toMatchObject({ status: "APPROVED", rejectionReason: null });
  });
});

run("admin seller decisions compare-and-set on PENDING_REVIEW", () => {
  it("approves an application that is awaiting review", async () => {
    const applicant = await makeApplicant("PENDING_REVIEW");
    const approved = await approveSeller(applicant.id, adminId);
    expect(approved.status).toBe("ACTIVE");
    const audit = await db.auditLog.findMany({ where: { entityType: "SellerProfile", entityId: applicant.id, action: "APPROVE" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.before).toMatchObject({ status: "PENDING_REVIEW" });
  });

  it("rejects an application that is awaiting review and records the reason", async () => {
    const applicant = await makeApplicant("PENDING_REVIEW");
    const rejected = await rejectSeller(applicant.id, adminId, "CR number does not match the register");
    expect(rejected.status).toBe("REJECTED");
    const audit = await db.auditLog.findMany({ where: { entityType: "SellerProfile", entityId: applicant.id, action: "REJECT" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.after).toMatchObject({ status: "REJECTED", reason: "CR number does not match the register" });
  });

  it("refuses to approve a seller another admin already rejected, leaving the rejection standing", async () => {
    // This is the defect the predicate closes: the pending queue is a cached
    // page, and the approve button on a stale one used to silently reverse a
    // recorded rejection with a second audit row claiming it came from review.
    const applicant = await makeApplicant("REJECTED");
    const attempt = approveSeller(applicant.id, adminId);
    await expect(attempt).rejects.toBeInstanceOf(SellerNotPendingError);
    await expect(attempt).rejects.toMatchObject({ sellerId: applicant.id, currentStatus: "REJECTED" });
    await expect(db.sellerProfile.findUniqueOrThrow({ where: { id: applicant.id } })).resolves.toMatchObject({ status: "REJECTED" });
    expect(await db.auditLog.count({ where: { entityType: "SellerProfile", entityId: applicant.id } })).toBe(0);
  });

  it("still revokes a live seller — rejection is the platform's revocation lever, not only a queue decision", async () => {
    // The fulfilment and quote fences read SellerProfile.status, so narrowing
    // this to PENDING_REVIEW would have taken away the only way to pull a
    // trading seller off the marketplace.
    const live = await makeApplicant("ACTIVE");
    const revoked = await rejectSeller(live.id, adminId, "Licence withdrawn by the registrar");
    expect(revoked.status).toBe("REJECTED");
    const audit = await db.auditLog.findMany({ where: { entityType: "SellerProfile", entityId: live.id, action: "REJECT" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.before).toMatchObject({ status: "ACTIVE" });
  });

  it("refuses a second rejection of an already-rejected seller and writes no second audit row", async () => {
    const rejected = await makeApplicant("REJECTED");
    await expect(rejectSeller(rejected.id, adminId, "Clicked twice")).rejects.toMatchObject({ name: "SellerNotPendingError", currentStatus: "REJECTED" });
    expect(await db.auditLog.count({ where: { entityType: "SellerProfile", entityId: rejected.id } })).toBe(0);
  });

  it("refuses to reinstate a suspended seller through the approval path", async () => {
    // Suspension is a platform decision with no approve-to-undo: the reviewer
    // must not be able to lift it from the applications queue.
    const applicant = await makeApplicant("SUSPENDED");
    await expect(approveSeller(applicant.id, adminId)).rejects.toMatchObject({ name: "SellerNotPendingError", currentStatus: "SUSPENDED" });
    await expect(db.sellerProfile.findUniqueOrThrow({ where: { id: applicant.id } })).resolves.toMatchObject({ status: "SUSPENDED" });
  });

  it("refuses to re-approve an application it just approved", async () => {
    const applicant = await makeApplicant("PENDING_REVIEW");
    await approveSeller(applicant.id, adminId);
    await expect(approveSeller(applicant.id, adminId)).rejects.toMatchObject({ name: "SellerNotPendingError", currentStatus: "ACTIVE" });
    expect(await db.auditLog.count({ where: { entityType: "SellerProfile", entityId: applicant.id, action: "APPROVE" } })).toBe(1);
  });

  it("reports a seller that does not exist as not found, not as a stale decision", async () => {
    await expect(approveSeller(`${stamp}-missing`, adminId)).rejects.toThrow("Seller not found");
  });
});
