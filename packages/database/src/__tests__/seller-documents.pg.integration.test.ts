import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  SUPERSEDED_REJECTION_REASON,
  isSellerDocumentKey,
  recordSellerDocument,
  sellerDocumentKeyPrefix,
} from "../services/seller-documents";

/**
 * Seller compliance document recording against a real Postgres.
 *
 * What is under test is the one-way trap this service exists to open: a
 * seller still PENDING_REVIEW must be able to file the documents that review
 * needs, while the ownership and permission gates still hold inside the
 * transaction. Skipped without DATABASE_URL, like the other pg suites.
 */
const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

let ownerId = "", staffId = "", viewerId = "", strangerOwnerId = "";
let sellerId = "", strangerSellerId = "";
const users: string[] = [];
const sellers: string[] = [];

/** A key shaped the way the presigner mints them for this seller's document namespace. */
function documentKey(forSellerId: string, ext = "pdf"): string {
  const hex = Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, "0");
  return `${sellerDocumentKeyPrefix(forSellerId)}doc${Date.now().toString(36)}-${hex}.${ext}`;
}

beforeAll(async () => {
  const [owner, staff, viewer, strangerOwner] = await Promise.all([
    db.user.create({ data: { email: `seller-docs-owner-${stamp}@test.invalid`, firstName: "Seller", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `seller-docs-staff-${stamp}@test.invalid`, firstName: "Seller", lastName: "Staff", role: "SELLER_STAFF", status: "ACTIVE" } }),
    db.user.create({ data: { email: `seller-docs-viewer-${stamp}@test.invalid`, firstName: "Seller", lastName: "Viewer", role: "SELLER_STAFF", status: "ACTIVE" } }),
    db.user.create({ data: { email: `seller-docs-stranger-${stamp}@test.invalid`, firstName: "Other", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  [ownerId, staffId, viewerId, strangerOwnerId] = [owner.id, staff.id, viewer.id, strangerOwner.id];
  users.push(ownerId, staffId, viewerId, strangerOwnerId);

  // The seller under test is still under review: the whole point is that this
  // status can file documents.
  const seller = await db.sellerProfile.create({
    data: { userId: owner.id, businessNameEn: `Seller docs ${stamp}`, crNumber: `SD-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "PENDING_REVIEW" },
  });
  const stranger = await db.sellerProfile.create({
    data: { userId: strangerOwner.id, businessNameEn: `Seller docs stranger ${stamp}`, crNumber: `SDX-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" },
  });
  sellerId = seller.id;
  strangerSellerId = stranger.id;
  sellers.push(sellerId, strangerSellerId);

  await db.sellerMembership.create({ data: { userId: staff.id, sellerId, isActive: true, permissions: ["documents.manage"] } });
  await db.sellerMembership.create({ data: { userId: viewer.id, sellerId, isActive: true, permissions: ["documents.view"] } });
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: users } }, { sellerId: { in: sellers } }] } });
  await db.sellerDocument.deleteMany({ where: { sellerId: { in: sellers } } });
  await db.sellerMembership.deleteMany({ where: { userId: { in: users } } });
  await db.sellerProfile.deleteMany({ where: { id: { in: sellers } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
});

run("seller compliance document recording", () => {
  it("lets the owner of a PENDING_REVIEW seller record a document and audits it", async () => {
    const key = documentKey(sellerId);
    const expiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const result = await recordSellerDocument({
      sellerId,
      actorId: ownerId,
      type: "TRADE_LICENSE",
      fileKey: key,
      fileName: "  trade-license.pdf  ",
      fileSize: 1234,
      mimeType: "application/pdf",
      expiryDate,
    });

    expect(result.status).toBe("PENDING_REVIEW");
    expect(result.supersededIds).toEqual([]);

    const row = await db.sellerDocument.findUniqueOrThrow({ where: { id: result.id } });
    // The KEY is stored, not a URL; the filename is trimmed for display.
    expect(row).toMatchObject({
      sellerId,
      type: "TRADE_LICENSE",
      fileUrl: key,
      fileName: "trade-license.pdf",
      fileSize: 1234,
      mimeType: "application/pdf",
      status: "PENDING_REVIEW",
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null,
    });
    expect(row.expiryDate?.getTime()).toBe(expiryDate.getTime());

    const audit = await db.auditLog.findMany({ where: { entityType: "SellerDocument", entityId: result.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: ownerId, sellerId, action: "CREATE" });
    expect(audit[0]!.after).toMatchObject({ source: "SELLER_DOCUMENT_CENTER", type: "TRADE_LICENSE", supersededIds: [] });
  });

  it("lets staff holding documents.manage record for the same seller", async () => {
    const result = await recordSellerDocument({
      sellerId,
      actorId: staffId,
      type: "OTHER",
      fileKey: documentKey(sellerId, "png"),
      fileName: "warehouse-photo.png",
      fileSize: 2048,
      mimeType: "image/png",
    });
    expect(result.status).toBe("PENDING_REVIEW");
    await expect(db.auditLog.count({ where: { entityType: "SellerDocument", entityId: result.id, actorId: staffId, action: "CREATE" } })).resolves.toBe(1);
  });

  it("supersedes the older open review of the same type but never touches an APPROVED row", async () => {
    // An approved CR already on file, as if an admin had reviewed an earlier upload.
    const approved = await db.sellerDocument.create({
      data: { sellerId, type: "COMMERCIAL_REGISTRATION", fileUrl: documentKey(sellerId), fileName: "cr-approved.pdf", status: "APPROVED", reviewedAt: new Date(), reviewedBy: strangerOwnerId },
    });
    // And a rejected one, which is history and must be left alone too.
    const rejected = await db.sellerDocument.create({
      data: { sellerId, type: "COMMERCIAL_REGISTRATION", fileUrl: documentKey(sellerId), fileName: "cr-rejected.pdf", status: "REJECTED", rejectionReason: "Illegible scan" },
    });

    const first = await recordSellerDocument({
      sellerId, actorId: ownerId, type: "COMMERCIAL_REGISTRATION", fileKey: documentKey(sellerId), fileName: "cr-v1.pdf", fileSize: 10, mimeType: "application/pdf",
    });
    expect(first.supersededIds).toEqual([]);

    const second = await recordSellerDocument({
      sellerId, actorId: ownerId, type: "COMMERCIAL_REGISTRATION", fileKey: documentKey(sellerId), fileName: "cr-v2.pdf", fileSize: 11, mimeType: "application/pdf",
    });
    expect(second.status).toBe("PENDING_REVIEW");
    expect(second.supersededIds).toEqual([first.id]);

    const [approvedNow, rejectedNow, firstNow, secondNow] = await Promise.all([
      db.sellerDocument.findUniqueOrThrow({ where: { id: approved.id } }),
      db.sellerDocument.findUniqueOrThrow({ where: { id: rejected.id } }),
      db.sellerDocument.findUniqueOrThrow({ where: { id: first.id } }),
      db.sellerDocument.findUniqueOrThrow({ where: { id: second.id } }),
    ]);
    // Renewal does not un-approve: the approved evidence stands until an admin decides.
    expect(approvedNow).toMatchObject({ status: "APPROVED", reviewedBy: strangerOwnerId });
    expect(rejectedNow).toMatchObject({ status: "REJECTED", rejectionReason: "Illegible scan" });
    // One open review per type: the older PENDING_REVIEW row is closed as superseded,
    // with no reviewer stamped on it because nobody reviewed it.
    expect(firstNow).toMatchObject({ status: "REJECTED", rejectionReason: SUPERSEDED_REJECTION_REASON, reviewedAt: null, reviewedBy: null });
    expect(secondNow).toMatchObject({ status: "PENDING_REVIEW", rejectionReason: null });

    const open = await db.sellerDocument.count({ where: { sellerId, type: "COMMERCIAL_REGISTRATION", status: "PENDING_REVIEW" } });
    expect(open).toBe(1);

    const supersessionAudit = await db.auditLog.findMany({ where: { entityType: "SellerDocument", entityId: first.id, action: "STATUS_CHANGE" } });
    expect(supersessionAudit).toHaveLength(1);
    expect(supersessionAudit[0]).toMatchObject({ actorId: ownerId, sellerId });
    expect(supersessionAudit[0]!.after).toMatchObject({ status: "REJECTED", reason: SUPERSEDED_REJECTION_REASON });
  });

  it("refuses a key outside this seller's document namespace", async () => {
    const foreign = documentKey(strangerSellerId);
    expect(isSellerDocumentKey(foreign, sellerId)).toBe(false);
    await expect(recordSellerDocument({
      sellerId, actorId: ownerId, type: "OTHER", fileKey: foreign, fileName: "not-mine.pdf",
    })).rejects.toThrow(/only files uploaded through the document center/i);

    // A key that escapes the namespace with a nested path is refused as well.
    await expect(recordSellerDocument({
      sellerId, actorId: ownerId, type: "OTHER", fileKey: `${sellerDocumentKeyPrefix(sellerId)}../../${strangerSellerId}/documents/x.pdf`, fileName: "escape.pdf",
    })).rejects.toThrow(/only files uploaded through the document center/i);

    // A legacy absolute URL is not a key either — no row is written from it.
    await expect(recordSellerDocument({
      sellerId, actorId: ownerId, type: "OTHER", fileKey: "https://example.invalid/some/file.pdf", fileName: "legacy.pdf",
    })).rejects.toThrow(/only files uploaded through the document center/i);

    await expect(db.sellerDocument.count({ where: { sellerId, fileName: { in: ["not-mine.pdf", "escape.pdf", "legacy.pdf"] } } })).resolves.toBe(0);
  });

  it("refuses staff without documents.manage and actors from another seller", async () => {
    await expect(recordSellerDocument({
      sellerId, actorId: viewerId, type: "OTHER", fileKey: documentKey(sellerId), fileName: "viewer.pdf",
    })).rejects.toThrow(/current seller permission required: documents\.manage/i);

    // Another seller's owner naming this sellerId is not this seller's actor.
    await expect(recordSellerDocument({
      sellerId, actorId: strangerOwnerId, type: "OTHER", fileKey: documentKey(sellerId), fileName: "stranger.pdf",
    })).rejects.toThrow(/current seller permission required/i);

    await expect(db.sellerDocument.count({ where: { sellerId, fileName: { in: ["viewer.pdf", "stranger.pdf"] } } })).resolves.toBe(0);
  });

  it("refuses once the seller is SUSPENDED or REJECTED, and a suspended login", async () => {
    for (const status of ["SUSPENDED", "REJECTED"] as const) {
      await db.sellerProfile.update({ where: { id: sellerId }, data: { status } });
      await expect(recordSellerDocument({
        sellerId, actorId: ownerId, type: "OTHER", fileKey: documentKey(sellerId), fileName: `${status}.pdf`,
      })).rejects.toThrow(/current seller permission required/i);
    }
    await db.sellerProfile.update({ where: { id: sellerId }, data: { status: "PENDING_REVIEW" } });

    await db.user.update({ where: { id: ownerId }, data: { status: "SUSPENDED" } });
    await expect(recordSellerDocument({
      sellerId, actorId: ownerId, type: "OTHER", fileKey: documentKey(sellerId), fileName: "suspended-login.pdf",
    })).rejects.toThrow(/current seller authority is required/i);
    await db.user.update({ where: { id: ownerId }, data: { status: "ACTIVE" } });

    await expect(db.sellerDocument.count({ where: { sellerId, fileName: { in: ["SUSPENDED.pdf", "REJECTED.pdf", "suspended-login.pdf"] } } })).resolves.toBe(0);
  });

  it("rejects malformed input before opening a transaction", async () => {
    await expect(recordSellerDocument({ sellerId, actorId: ownerId, type: "OTHER", fileKey: documentKey(sellerId), fileName: "   " }))
      .rejects.toThrow(/file name is required/i);
    await expect(recordSellerDocument({ sellerId, actorId: ownerId, type: "OTHER", fileKey: documentKey(sellerId), fileName: "x".repeat(256) }))
      .rejects.toThrow(/255 characters or fewer/i);
    await expect(recordSellerDocument({ sellerId, actorId: ownerId, type: "OTHER", fileKey: documentKey(sellerId), fileName: "neg.pdf", fileSize: -1 }))
      .rejects.toThrow(/positive number of bytes/i);
    await expect(recordSellerDocument({ sellerId, actorId: ownerId, type: "OTHER", fileKey: documentKey(sellerId), fileName: "nan.pdf", expiryDate: new Date("not a date") }))
      .rejects.toThrow(/not a valid date/i);
  });
});
