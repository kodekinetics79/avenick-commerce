import { Prisma, type Message, type RFQStatus } from "@prisma/client";
import { db, AuditAction } from "../index";
import { requireCurrentSellerActor } from "./checkout-invariants";

/**
 * Thread messaging between a buyer and a seller organisation.
 *
 * There is no `messages.*` key in the seller permission vocabulary (the nav in
 * apps/seller/src/components/layout/seller-layout.tsx gates the inbox on
 * `rfqs.view`, and staff grants were issued against that list). Replies and
 * read receipts therefore ride on the same capability that lets a member see
 * the inbox: inventing a new key would silently strand every existing staff
 * grant behind a permission nobody has been given.
 */
export const SELLER_MESSAGING_PERMISSION = "rfqs.view";

/** Longest reply body accepted. Mirrors the zod bound in the seller action. */
export const MESSAGE_BODY_MAX_LENGTH = 4000;

/**
 * Inbox page size. The list is newest-activity-first and the page says when
 * it has been cut at this many rows, so an older thread is never silently
 * absent from a seller's inbox.
 */
export const THREAD_INBOX_LIMIT = 100;

/**
 * A refusal the seller is meant to read ("closed", "not found", "empty"), as
 * opposed to a failure the seller must not read: a Prisma connection error
 * carries the database host in its message, and a foreign-key violation names
 * tables. The action surfaces this class verbatim and hides everything else
 * behind a generic line plus a server-side log.
 */
export class MessagingRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagingRefusal";
  }
}

/**
 * Buyer-side messages that the seller has not yet read. The dashboard badge
 * (services/products.ts getSellerDashboard) and the inbox both count with this
 * same predicate so the two numbers can never disagree.
 */
export const UNREAD_BUYER_MESSAGE_WHERE = {
  senderType: "BUYER",
  isRead: false,
} satisfies Prisma.MessageWhereInput;

/**
 * What a seller is shown of the buyer's identity: first name and last initial.
 * The buyer never chose to hand the seller their full name — the thread was
 * opened around an RFQ or an order, not a contact exchange — so the seller UI
 * gets the same abbreviated form everywhere. Kept here rather than in a page
 * so there is exactly one definition of that exposure.
 */
export function buyerDisplayName(buyer: { firstName: string; lastName: string }): string {
  const first = buyer.firstName.trim();
  const initial = buyer.lastName.trim().charAt(0);
  return initial ? `${first} ${initial}.` : first;
}

/**
 * Inbox rows for one seller, newest activity first. Unread is counted per
 * thread with the shared predicate rather than inferred from the last message
 * so a buyer who wrote three times before the seller looked is reported as
 * three unread, the same number the dashboard badge shows.
 */
export async function listSellerThreads(sellerId: string) {
  return db.messageThread.findMany({
    where: { sellerId },
    orderBy: { updatedAt: "desc" },
    take: THREAD_INBOX_LIMIT,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderType: true, createdAt: true } },
      _count: { select: { messages: { where: UNREAD_BUYER_MESSAGE_WHERE } } },
    },
  });
}

/**
 * Unread buyer messages across every thread of a seller — the inbox header
 * count and the layout badge. Same predicate as the dashboard projection.
 */
export async function countSellerUnreadMessages(sellerId: string) {
  return db.message.count({ where: { thread: { sellerId }, ...UNREAD_BUYER_MESSAGE_WHERE } });
}

/**
 * One thread with its conversation, scoped to the seller that owns it.
 * `MessageThread` carries only the buyer's id (no relation), and the RFQ and
 * order it hangs off are optional foreign keys without relations either, so
 * the labels the page needs are resolved here in one place. Returns null for
 * a thread that exists but belongs to another seller — the page treats that
 * exactly like a missing id.
 */
export async function getSellerThread(threadId: string, sellerId: string) {
  const thread = await db.messageThread.findFirst({
    where: { id: threadId, sellerId },
    include: {
      messages: {
        // Replies stamp createdAt explicitly, so two written in the same
        // millisecond need the id as a tiebreak to render in a stable order.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { sender: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!thread) return null;

  const [buyer, rfq, order] = await Promise.all([
    db.user.findUnique({
      where: { id: thread.buyerId },
      select: { firstName: true, lastName: true, companyMember: { select: { company: { select: { nameEn: true } } } } },
    }),
    thread.rfqId
      ? db.rFQRequest.findUnique({ where: { id: thread.rfqId }, select: { id: true, rfqNumber: true, status: true, sellerId: true } })
      : null,
    thread.orderId
      // Only an order that carries this seller's lines is linkable from the
      // seller portal (apps/seller/src/app/orders/[id] scopes on the same
      // predicate); anything else is shown by number without a link.
      ? db.order.findUnique({
          where: { id: thread.orderId },
          select: { id: true, orderNumber: true, items: { where: { sellerId }, take: 1, select: { id: true } } },
        })
      : null,
  ]);

  return {
    ...thread,
    unreadCount: thread.messages.filter((m) => m.senderType === "BUYER" && !m.isRead).length,
    buyer: buyer
      ? { displayName: buyerDisplayName(buyer), companyName: buyer.companyMember?.company.nameEn ?? null }
      : null,
    rfq,
    order: order ? { id: order.id, orderNumber: order.orderNumber, sellerHasLines: order.items.length > 0 } : null,
  };
}

/**
 * What a seller may do with an RFQ from its inbox.
 *
 * - "quoted": this seller's own quote is on file (QUOTED / NEGOTIATING /
 *   ACCEPTED with the RFQ claimed by this seller) — the quote can be viewed.
 * - "open": still quotable by this seller — unclaimed and SUBMITTED /
 *   UNDER_REVIEW, or claimed by this seller but not yet quoted. Mirrors the
 *   visibility predicate in rfq.ts getRFQsForSeller and the claim rule in
 *   submitQuote, so the inbox never offers a control the service would refuse.
 * - "closed": nothing for this seller to do (declined, expired, cancelled,
 *   draft, or quoted by another seller). The row shows its status and no
 *   control, rather than a button that leads nowhere.
 */
export function sellerRfqPosture(
  rfq: { status: RFQStatus; sellerId: string | null },
  sellerId: string,
): "quoted" | "open" | "closed" {
  const mine = rfq.sellerId === sellerId;
  if (mine && (rfq.status === "QUOTED" || rfq.status === "NEGOTIATING" || rfq.status === "ACCEPTED")) return "quoted";
  if ((rfq.sellerId === null || mine) && (rfq.status === "SUBMITTED" || rfq.status === "UNDER_REVIEW")) return "open";
  return "closed";
}

export interface ReplyToThreadInput {
  threadId: string;
  sellerId: string;
  actorId: string;
  body: string;
  /** Test seam: runs after the actor is fenced, before the thread is read. */
  afterActorLock?: () => Promise<void>;
}

export interface ReplyToThreadResult {
  message: Message;
  /**
   * True when the reply was also stamped with the thread's RFQ id. The customer
   * portal has no inbox; its only message surface is the RFQ detail page, which
   * renders Messages by `rfqId`. A reply on a thread without an RFQ is stored
   * but not yet visible to the buyer anywhere — the seller UI says so.
   */
  buyerVisible: boolean;
  /** Buyer messages flipped to read as a consequence of this reply. */
  markedRead: number;
  /** True when this reply was the seller's first response on the thread. */
  firstResponse: boolean;
}

/**
 * Append a seller reply to an open thread.
 *
 * Runs under the same actor fence as quoting so a suspended member or a
 * rejected seller cannot slip a message past the revocation. The thread is
 * looked up by id AND sellerId inside the transaction; a thread belonging to
 * another seller is indistinguishable from a missing one. Replying implies the
 * seller has read what the buyer wrote, so the buyer's unread messages in the
 * thread are marked read in the same commit — otherwise the inbox badge would
 * keep counting a conversation the seller has already answered.
 */
export async function replyToThread(input: ReplyToThreadInput): Promise<ReplyToThreadResult> {
  const body = input.body.trim();
  if (!body) throw new MessagingRefusal("Reply cannot be empty");
  if (body.length > MESSAGE_BODY_MAX_LENGTH) {
    throw new MessagingRefusal(`Reply is limited to ${MESSAGE_BODY_MAX_LENGTH} characters`);
  }

  return db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, input.actorId, input.sellerId, SELLER_MESSAGING_PERMISSION);
    await input.afterActorLock?.();
    // Two members of the same seller answering at once must not both claim the
    // first response, and a close racing a reply must be ordered one way or the
    // other. One fence per thread settles both.
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`message-thread:${input.threadId}`}))`,
    );

    const thread = await tx.messageThread.findFirst({
      where: { id: input.threadId, sellerId: input.sellerId },
      select: { id: true, rfqId: true, isOpen: true, firstResponseAt: true },
    });
    if (!thread) throw new MessagingRefusal("Thread not found");
    if (!thread.isOpen) throw new MessagingRefusal("This thread is closed; replies are no longer accepted");

    const now = new Date();
    const message = await tx.message.create({
      data: {
        threadId: thread.id,
        // The buyer reads replies on their RFQ page, which selects by rfqId.
        // Stamping both ids is what makes a seller reply reach the buyer at all.
        rfqId: thread.rfqId,
        senderId: input.actorId,
        senderType: "SELLER",
        body,
        createdAt: now,
      },
    });
    const read = await tx.message.updateMany({
      where: { threadId: thread.id, ...UNREAD_BUYER_MESSAGE_WHERE },
      data: { isRead: true, readAt: now },
    });
    const firstResponse = thread.firstResponseAt === null;
    await tx.messageThread.update({
      where: { id: thread.id },
      // updatedAt drives inbox ordering; set explicitly so it equals the
      // message timestamp rather than whatever @updatedAt resolves to later
      // in the transaction.
      data: { updatedAt: now, ...(firstResponse ? { firstResponseAt: now } : {}) },
    });
    // Same shape as quote submission: who answered which buyer conversation and
    // when. The body is deliberately not copied into the audit row — the
    // Message row is the record; the audit entry is the provenance.
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: input.sellerId,
        entityType: "Message",
        entityId: message.id,
        action: AuditAction.CREATE,
        before: { firstResponseAt: thread.firstResponseAt?.toISOString() ?? null },
        after: {
          threadId: thread.id,
          rfqId: thread.rfqId,
          firstResponseAt: (firstResponse ? now : thread.firstResponseAt!).toISOString(),
          buyerMessagesMarkedRead: read.count,
        },
      },
    });

    return { message, buyerVisible: thread.rfqId !== null, markedRead: read.count, firstResponse };
  });
}

/**
 * Mark the buyer's unread messages in a thread as read on behalf of a seller
 * member. Opening the thread is what triggers this, so the caller should check
 * there is something to mark before paying for the actor fence. Returns the
 * number of messages flipped; a thread that is not this seller's is reported
 * as not found rather than silently returning zero.
 */
export async function markThreadRead(threadId: string, sellerId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, actorId, sellerId, SELLER_MESSAGING_PERMISSION);
    const thread = await tx.messageThread.findFirst({
      where: { id: threadId, sellerId },
      select: { id: true },
    });
    if (!thread) throw new MessagingRefusal("Thread not found");
    const read = await tx.message.updateMany({
      where: { threadId: thread.id, ...UNREAD_BUYER_MESSAGE_WHERE },
      data: { isRead: true, readAt: new Date() },
    });
    return read.count;
  });
}
