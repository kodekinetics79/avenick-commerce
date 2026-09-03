import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../index";
import { setUserStatus } from "../services/admin";
import { getRFQForBuyer } from "../services/rfq";
import {
  buyerDisplayName,
  getSellerThread,
  listSellerThreads,
  markThreadRead,
  MESSAGE_BODY_MAX_LENGTH,
  MessagingRefusal,
  replyToThread,
  sellerRfqPosture,
} from "../services/messaging";

const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

let ownerId = "", staffId = "", viewerId = "", adminId = "", buyerId = "", otherOwnerId = "";
let sellerId = "", otherSellerId = "", rfqId = "";
const threadIds: string[] = [];

async function openThread(opts: { sellerId: string; rfqId?: string; isOpen?: boolean; buyerMessages?: number; subject?: string }) {
  const thread = await db.messageThread.create({
    data: {
      sellerId: opts.sellerId,
      buyerId,
      rfqId: opts.rfqId ?? null,
      isOpen: opts.isOpen ?? true,
      subject: opts.subject ?? `Thread ${stamp}`,
      messages: {
        create: Array.from({ length: opts.buyerMessages ?? 2 }, (_, i) => ({
          rfqId: opts.rfqId ?? null,
          senderId: buyerId,
          senderType: "BUYER" as const,
          body: `Buyer question ${i + 1}`,
        })),
      },
    },
  });
  threadIds.push(thread.id);
  return thread;
}

beforeAll(async () => {
  const [owner, staff, viewer, admin, buyer, otherOwner] = await Promise.all([
    db.user.create({ data: { email: `msg-owner-${stamp}@test.invalid`, firstName: "Seller", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `msg-staff-${stamp}@test.invalid`, firstName: "Seller", lastName: "Staff", role: "SELLER_STAFF", status: "ACTIVE" } }),
    db.user.create({ data: { email: `msg-viewer-${stamp}@test.invalid`, firstName: "Order", lastName: "Viewer", role: "SELLER_STAFF", status: "ACTIVE" } }),
    db.user.create({ data: { email: `msg-admin-${stamp}@test.invalid`, firstName: "Platform", lastName: "Admin", role: "SUPER_ADMIN", status: "ACTIVE" } }),
    db.user.create({ data: { email: `msg-buyer-${stamp}@test.invalid`, firstName: "Buyer", lastName: "Testerson", role: "CONSUMER", status: "ACTIVE" } }),
    db.user.create({ data: { email: `msg-other-${stamp}@test.invalid`, firstName: "Other", lastName: "Owner", role: "SELLER_OWNER", status: "ACTIVE" } }),
  ]);
  [ownerId, staffId, viewerId, adminId, buyerId, otherOwnerId] = [owner.id, staff.id, viewer.id, admin.id, buyer.id, otherOwner.id];

  const [seller, otherSeller] = await Promise.all([
    db.sellerProfile.create({ data: { userId: owner.id, businessNameEn: `Messaging seller ${stamp}`, crNumber: `MS-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
    db.sellerProfile.create({ data: { userId: otherOwner.id, businessNameEn: `Other seller ${stamp}`, crNumber: `MO-${stamp}`, type: "DISTRIBUTOR", country: "AE", city: "Dubai", status: "ACTIVE" } }),
  ]);
  [sellerId, otherSellerId] = [seller.id, otherSeller.id];

  await Promise.all([
    // The inbox permission; no messages.* key exists in the vocabulary.
    db.sellerMembership.create({ data: { userId: staff.id, sellerId, isActive: true, permissions: ["rfqs.view"] } }),
    // A member with a real grant that is not the inbox one.
    db.sellerMembership.create({ data: { userId: viewer.id, sellerId, isActive: true, permissions: ["orders.view"] } }),
  ]);

  const rfq = await db.rFQRequest.create({
    data: { rfqNumber: `MSG-${stamp}`, buyerId, sellerId, status: "QUOTED", currency: "AED", items: { create: { nameEn: "Item", quantity: 1 } } },
  });
  rfqId = rfq.id;
});

afterAll(async () => {
  await db.message.deleteMany({ where: { OR: [{ threadId: { in: threadIds } }, { rfqId }] } });
  await db.messageThread.deleteMany({ where: { id: { in: threadIds } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: [ownerId, staffId, viewerId, adminId] } } });
  await db.rFQRequest.deleteMany({ where: { id: rfqId } });
  await db.sellerProfile.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  await db.user.deleteMany({ where: { id: { in: [ownerId, staffId, viewerId, adminId, buyerId, otherOwnerId] } } });
});

run("seller thread replies", () => {
  it("stamps the reply with both ids, marks the buyer read, records the first response and audits it", async () => {
    const thread = await openThread({ sellerId, rfqId, buyerMessages: 2 });

    const result = await replyToThread({ threadId: thread.id, sellerId, actorId: staffId, body: "  We can supply this.  " });

    expect(result.message).toMatchObject({ threadId: thread.id, rfqId, senderId: staffId, senderType: "SELLER", body: "We can supply this." });
    expect(result).toMatchObject({ buyerVisible: true, markedRead: 2, firstResponse: true });

    const after = await db.messageThread.findUniqueOrThrow({ where: { id: thread.id }, include: { messages: true } });
    expect(after.firstResponseAt?.getTime()).toBe(result.message.createdAt.getTime());
    expect(after.updatedAt.getTime()).toBe(result.message.createdAt.getTime());
    expect(after.messages.filter((m) => m.senderType === "BUYER").every((m) => m.isRead && m.readAt !== null)).toBe(true);

    // The buyer's only surface is the RFQ page; the reply must be reachable from there.
    const buyerView = await getRFQForBuyer({ rfqId, buyerId });
    expect(buyerView?.messages.some((m) => m.id === result.message.id && m.senderType === "SELLER")).toBe(true);

    const audit = await db.auditLog.findMany({ where: { entityType: "Message", entityId: result.message.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: staffId, sellerId, action: "CREATE" });
    expect(audit[0]!.after).toMatchObject({ threadId: thread.id, rfqId, buyerMessagesMarkedRead: 2 });
    // Provenance, not a copy of the conversation.
    expect(JSON.stringify(audit[0]!.after)).not.toContain("We can supply this.");
  });

  it("does not move firstResponseAt on a second reply", async () => {
    const thread = await openThread({ sellerId, rfqId, buyerMessages: 1 });
    const first = await replyToThread({ threadId: thread.id, sellerId, actorId: ownerId, body: "First" });
    const second = await replyToThread({ threadId: thread.id, sellerId, actorId: staffId, body: "Second" });
    expect(first.firstResponse).toBe(true);
    expect(second).toMatchObject({ firstResponse: false, markedRead: 0 });
    const after = await db.messageThread.findUniqueOrThrow({ where: { id: thread.id } });
    expect(after.firstResponseAt?.getTime()).toBe(first.message.createdAt.getTime());
    expect(after.updatedAt.getTime()).toBe(second.message.createdAt.getTime());
  });

  it("records a reply on a thread without an RFQ but reports that the buyer cannot see it", async () => {
    const thread = await openThread({ sellerId, buyerMessages: 1 });
    const result = await replyToThread({ threadId: thread.id, sellerId, actorId: staffId, body: "Noted" });
    expect(result.message.rfqId).toBeNull();
    expect(result.message.threadId).toBe(thread.id);
    expect(result.buyerVisible).toBe(false);
  });

  it("refuses a closed thread and writes nothing", async () => {
    const thread = await openThread({ sellerId, rfqId, isOpen: false, buyerMessages: 1 });
    const refusal = replyToThread({ threadId: thread.id, sellerId, actorId: ownerId, body: "Too late" });
    await expect(refusal).rejects.toThrow(/closed/i);
    // The seller action only shows MessagingRefusal messages verbatim; a plain
    // Error here would reach the member as a generic "try again" that is false.
    await expect(refusal).rejects.toBeInstanceOf(MessagingRefusal);
    expect(await db.message.count({ where: { threadId: thread.id, senderType: "SELLER" } })).toBe(0);
    expect(await db.message.count({ where: { threadId: thread.id, senderType: "BUYER", isRead: false } })).toBe(1);
  });

  it("treats another seller's thread as missing", async () => {
    const thread = await openThread({ sellerId: otherSellerId, buyerMessages: 1 });
    const refusal = replyToThread({ threadId: thread.id, sellerId, actorId: ownerId, body: "Hello?" });
    await expect(refusal).rejects.toThrow(/not found/i);
    await expect(refusal).rejects.toBeInstanceOf(MessagingRefusal);
    expect(await db.message.count({ where: { threadId: thread.id } })).toBe(1);
    await expect(markThreadRead(thread.id, sellerId, ownerId)).rejects.toThrow(/not found/i);
    expect(await getSellerThread(thread.id, sellerId)).toBeNull();
  });

  it("refuses a member who lacks the inbox permission", async () => {
    const thread = await openThread({ sellerId, rfqId, buyerMessages: 1 });
    await expect(replyToThread({ threadId: thread.id, sellerId, actorId: viewerId, body: "Hi" })).rejects.toThrow(/current seller permission required: rfqs\.view/i);
    await expect(markThreadRead(thread.id, sellerId, viewerId)).rejects.toThrow(/current seller permission/i);
  });

  it("rejects empty and oversized bodies before opening a transaction", async () => {
    const thread = await openThread({ sellerId, rfqId, buyerMessages: 1 });
    await expect(replyToThread({ threadId: thread.id, sellerId, actorId: ownerId, body: "   " })).rejects.toThrow(/empty/i);
    await expect(replyToThread({ threadId: thread.id, sellerId, actorId: ownerId, body: "x".repeat(MESSAGE_BODY_MAX_LENGTH + 1) })).rejects.toThrow(/limited/i);
    expect(await db.message.count({ where: { threadId: thread.id, senderType: "SELLER" } })).toBe(0);
  });

  it("marks buyer messages read on open and reports the count the inbox showed", async () => {
    const thread = await openThread({ sellerId, buyerMessages: 3 });
    const listed = await listSellerThreads(sellerId);
    expect(listed.find((t) => t.id === thread.id)?._count.messages).toBe(3);

    const detail = await getSellerThread(thread.id, sellerId);
    expect(detail?.unreadCount).toBe(3);
    expect(detail?.buyer?.displayName).toBe("Buyer T.");
    expect(detail?.messages.map((m) => m.body)).toEqual(["Buyer question 1", "Buyer question 2", "Buyer question 3"]);

    expect(await markThreadRead(thread.id, sellerId, staffId)).toBe(3);
    expect(await markThreadRead(thread.id, sellerId, staffId)).toBe(0);
    expect((await listSellerThreads(sellerId)).find((t) => t.id === thread.id)?._count.messages).toBe(0);
  });

  it("resolves the linked RFQ for the seller's thread view", async () => {
    const thread = await openThread({ sellerId, rfqId, buyerMessages: 0 });
    const detail = await getSellerThread(thread.id, sellerId);
    expect(detail?.rfq).toMatchObject({ id: rfqId, rfqNumber: `MSG-${stamp}`, status: "QUOTED", sellerId });
    expect(sellerRfqPosture(detail!.rfq!, sellerId)).toBe("quoted");
    expect(sellerRfqPosture(detail!.rfq!, otherSellerId)).toBe("closed");
  });

  it("gives exactly one of two concurrent replies the first response", async () => {
    const thread = await openThread({ sellerId, rfqId, buyerMessages: 1 });
    let release!: () => void; const held = new Promise<void>((r) => { release = r; });
    let locked!: () => void; const signal = new Promise<void>((r) => { locked = r; });
    const staffReply = replyToThread({ threadId: thread.id, sellerId, actorId: staffId, body: "From staff", afterActorLock: async () => { locked(); await held; } });
    await signal;
    const ownerReply = replyToThread({ threadId: thread.id, sellerId, actorId: ownerId, body: "From owner" });
    release();
    const [a, b] = await Promise.all([staffReply, ownerReply]);
    expect([a.firstResponse, b.firstResponse].filter(Boolean)).toHaveLength(1);
    expect(a.markedRead + b.markedRead).toBe(1);
    const after = await db.messageThread.findUniqueOrThrow({ where: { id: thread.id } });
    const first = a.firstResponse ? a : b;
    expect(after.firstResponseAt?.getTime()).toBe(first.message.createdAt.getTime());
  });

  it("rejects a reply after member suspension wins", async () => {
    const thread = await openThread({ sellerId, rfqId, buyerMessages: 1 });
    await setUserStatus({ userId: staffId, status: "SUSPENDED", actorId: adminId, actorRole: "SUPER_ADMIN" });
    await expect(replyToThread({ threadId: thread.id, sellerId, actorId: staffId, body: "Still here" })).rejects.toThrow(/current seller authority/i);
    await db.user.update({ where: { id: staffId }, data: { status: "ACTIVE" } });
  });

  it("lets an earlier reply commit before member suspension", async () => {
    const thread = await openThread({ sellerId, rfqId, buyerMessages: 1 });
    let release!: () => void; const held = new Promise<void>((r) => { release = r; });
    let locked!: () => void; const signal = new Promise<void>((r) => { locked = r; });
    const reply = replyToThread({ threadId: thread.id, sellerId, actorId: staffId, body: "Just in time", afterActorLock: async () => { locked(); await held; } });
    await signal;
    const suspension = setUserStatus({ userId: staffId, status: "SUSPENDED", actorId: adminId, actorRole: "SUPER_ADMIN" });
    release();
    await expect(reply).resolves.toMatchObject({ firstResponse: true });
    await expect(suspension).resolves.toMatchObject({ status: "SUSPENDED" });
    await db.user.update({ where: { id: staffId }, data: { status: "ACTIVE" } });
  });
});

describe("buyerDisplayName", () => {
  it("shows the first name and last initial only", () => {
    expect(buyerDisplayName({ firstName: "Buyer", lastName: "Testerson" })).toBe("Buyer T.");
    expect(buyerDisplayName({ firstName: " Amira ", lastName: "" })).toBe("Amira");
  });
});
