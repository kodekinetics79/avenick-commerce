import { z } from "zod";

import { CurrencySchema, RfqStatusSchema } from "./enums";
import { IdSchema, MoneySchema, TimestampSchema } from "./primitives";
import { successEnvelope } from "./envelope";

/**
 * REQUEST FOR QUOTE — the other half of a quote-only catalogue.
 *
 * Almost nothing in this catalogue is consumer-sellable, so for most products
 * the app's primary action is "Request a quote" rather than "Add to cart". That
 * makes this the buying journey for the majority of the surface, not a B2B
 * side-door.
 *
 * ONE RFQ IS ONE SUPPLIER. THIS IS A SCHEMA CONSTRAINT, NOT A PREFERENCE.
 *
 * `RFQRequest.sellerId` is a single nullable foreign key, and `submitQuote` is
 * its only writer: the first seller to quote CLAIMS the request (under an
 * advisory lock) and moves it to QUOTED in the same update. So an RFQ's life is
 *
 *     SUBMITTED, unclaimed  →  one seller quotes it  →  QUOTED  →  ACCEPTED/REJECTED
 *
 * and at no point does it hold more than one supplier's price. There is
 * therefore no "compare three quotes" screen this data can fill, and this
 * contract does not describe one: no `quotes` array, no `sellers` list, no
 * per-supplier totals. A buyer who wants three prices raises three RFQs today.
 *
 * Modelling a comparison here would be the worst kind of contract defect — the
 * generated Dart client would carry a `List<Quote>` that is always length one,
 * every screen built on it would look correct in review, and the feature would
 * be discovered missing only after the app shipped. Building it for real means
 * a join table (an `RFQQuote` per seller, with the claim moved onto it) and a
 * broadcast/fan-out step; that is a schema change, and it is flagged in the
 * report rather than faked here.
 */

/**
 * The supplier who quoted, as much of them as the buyer services expose.
 *
 * `getRFQsForBuyer` and `getRFQForBuyer` select exactly `businessNameEn` and
 * `tier` — no id — so the app can NAME the supplier but cannot deep-link to
 * them. That is a gap in the service's `select`, not in this contract; it is
 * flagged rather than filled with a value from somewhere else.
 *
 * Null until a seller claims the request, which is the normal state of a
 * freshly submitted RFQ and must render as "waiting for a supplier" rather than
 * as a missing name.
 */
export const RfqSellerSchema = z
  .object({
    businessNameEn: z.string().min(1).max(200),
    tier: z.enum(["STANDARD", "VERIFIED", "GOLD", "PLATINUM"]),
  })
  .strict();

/**
 * One requested line.
 *
 * `productId` is nullable because an RFQ line does not have to be a catalogue
 * item — `RFQItem.productId` is optional and the seed's own RFQs carry
 * free-text lines ("Safety Boots (various sizes)"). That is the point of an
 * RFQ: it is how a buyer asks for something the catalogue does not list.
 *
 * `unitQuoted` is null until the supplier has priced THIS line. A partially
 * quoted RFQ is not a state `submitQuote` can produce — it refuses a quote that
 * does not price every item exactly once — but a line quoted in an earlier
 * version and a line never quoted are both null here, so the app reads the
 * RFQ's `status`, never the presence of a price, to decide whether a quote
 * exists.
 *
 * THERE IS DELIBERATELY NO `lineTotal`. `submitQuote` computes the aggregate as
 * `Σ unitQuoted × quantity` and stores it, rounded once, in `totalQuoted`.
 * Emitting a per-line total would mean rounding each line separately, and the
 * sum of those roundings can differ from the stored figure by cents — two
 * numbers on one screen that do not add up. The aggregate is authoritative;
 * the line carries its unit price and its quantity, which is what the supplier
 * actually quoted.
 */
export const RfqItemSchema = z
  .object({
    id: IdSchema,
    productId: IdSchema.nullable(),
    nameEn: z.string().min(1).max(300),
    quantity: z.number().int().positive(),
    unitQuoted: MoneySchema.nullable(),
    notes: z.string().max(500).nullable(),
  })
  .strict();

/**
 * THE LEAN RFQ CARD. A list row draws a number, a state, a supplier and a
 * price; the lines are a request away.
 */
export const RfqCardSchema = z
  .object({
    id: IdSchema,
    rfqNumber: z.string().min(1).max(64),
    status: RfqStatusSchema,
    currency: CurrencySchema,
    itemCount: z.number().int().positive(),
    /** The supplier's quoted total. Null until somebody has quoted. */
    totalQuoted: MoneySchema.nullable(),
    /**
     * Bumped by every `submitQuote`. It is not decoration: `decideRFQ` takes it
     * back as `expectedQuoteVersion` and refuses a decision made against a
     * quote the supplier has since revised — so a buyer cannot accept a price
     * that changed while the screen was open.
     */
    quoteVersion: z.number().int().min(0),
    seller: RfqSellerSchema.nullable(),
    requiredBy: TimestampSchema.nullable(),
    createdAt: TimestampSchema,
    /**
     * How many messages hang off this RFQ. The thread itself is NOT on this
     * surface — `Message` carries sender types, attachments and read state and
     * deserves its own cursor-paginated endpoint rather than being inlined
     * behind a count. Until it exists the app can say "3 messages" and send the
     * buyer to the portal, which is honest; it cannot show the conversation.
     */
    messageCount: z.number().int().min(0),
  })
  .strict();

export type RfqCard = z.infer<typeof RfqCardSchema>;

/** THE FAT RFQ. Everything the request screen draws, in one call. */
export const RfqDetailSchema = z
  .object({
    id: IdSchema,
    rfqNumber: z.string().min(1).max(64),
    status: RfqStatusSchema,
    currency: CurrencySchema,
    itemCount: z.number().int().positive(),
    totalQuoted: MoneySchema.nullable(),
    quoteVersion: z.number().int().min(0),
    seller: RfqSellerSchema.nullable(),
    requiredBy: TimestampSchema.nullable(),
    createdAt: TimestampSchema,
    messageCount: z.number().int().min(0),
    items: z.array(RfqItemSchema).min(1).max(50),
    notes: z.string().max(2000).nullable(),
    /**
     * `RFQRequest.expiresAt` is a real column that NOTHING WRITES — no service
     * sets it and the seed does not either. It is carried because it exists and
     * null is its truthful value, not because a quote is known to expire.
     * An app must not present "expires in N days" from it.
     */
    expiresAt: TimestampSchema.nullable(),
    updatedAt: TimestampSchema,
  })
  .strict();

export type RfqDetail = z.infer<typeof RfqDetailSchema>;

/**
 * One line of a new request.
 *
 * `nameEn` is OPTIONAL here and required on the stored row, which is the
 * deliberate part: when the line names a catalogue product the server resolves
 * the name from the catalogue and ignores anything the client sent. A
 * client-supplied name on a `productId`-backed line is text the supplier reads
 * as the buyer's specification, so letting the two disagree lets a request say
 * "500 of [product X]" while naming something else entirely. A line with no
 * `productId` is genuinely free text and must carry its own name.
 */
export const RfqLineInputSchema = z
  .object({
    productId: IdSchema.optional(),
    nameEn: z.string().trim().min(2).max(300).optional(),
    quantity: z.number().int().positive().max(1_000_000),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

/** The plain object, for the OpenAPI body; the rule below is enforced at parse time. */
export const CreateRfqRequestFieldsSchema = z
  .object({
    items: z.array(RfqLineInputSchema).min(1).max(50),
    /**
     * Required, never defaulted. `createRFQ` falls back to AED when it is
     * omitted, and a currency the buyer never chose is the wrong figure to
     * quote against — the same rule `CheckoutQuoteRequest` states.
     */
    currency: CurrencySchema,
    notes: z.string().trim().max(2000).optional(),
    requiredBy: TimestampSchema.optional(),
  })
  .strict();

export const CreateRfqRequestSchema = CreateRfqRequestFieldsSchema.superRefine((body, ctx) => {
  body.items.forEach((line, index) => {
    if (line.productId === undefined && line.nameEn === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "nameEn"],
        message: "A line that does not name a catalogue product must describe what is wanted",
      });
    }
  });
});

export const RfqPathParamsSchema = z.object({ id: IdSchema }).strict();

/**
 * The buyer's decision on a quote.
 *
 * `expectedQuoteVersion` is required and is the whole point: `decideRFQ`
 * compares it against the stored version inside a transaction holding the RFQ's
 * advisory lock, so accepting a price the supplier revised while the screen was
 * open fails rather than binding the buyer to a number they never saw.
 */
export const RfqDecisionRequestSchema = z
  .object({
    decision: z.enum(["ACCEPTED", "REJECTED"]),
    expectedQuoteVersion: z.number().int().min(0),
  })
  .strict();

/**
 * Returned whole, uncursored, and capped.
 *
 * `getRFQsForBuyer` reads `take: 50` with no cursor support, so this states the
 * same bound rather than promising a page the service cannot produce. A buyer
 * with more than fifty requests cannot reach the rest — flagged in the report;
 * the fix is a cursor in the service.
 */
export const RFQ_LIST_MAX = 50;

export const RfqListResponseSchema = successEnvelope(z.array(RfqCardSchema).max(RFQ_LIST_MAX));

export const RfqResponseSchema = successEnvelope(RfqDetailSchema);
