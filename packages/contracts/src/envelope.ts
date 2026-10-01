import { z } from "zod";

/**
 * ONE error envelope for the whole /api/v1 surface.
 *
 * The existing routes answer in three different shapes — `{ success, error }`,
 * `{ success, data }` and `{ success, ...result, products }` — and the string
 * in `error` is sometimes a message for a human, sometimes a business rule
 * name, and sometimes the raw text of a thrown Error. A generated Dart client
 * cannot branch on any of that: it needs a closed set of machine-readable
 * codes, and every failure on this surface answers with exactly one.
 */
export const ERROR_CODE_VALUES = [
  /** No credential, or one that has expired. The app should refresh or sign in. */
  "unauthenticated",
  /** A valid credential that is not allowed to do this. Refreshing will not help. */
  "forbidden",
  "not_found",
  /** The request failed schema or business validation; see `fieldErrors`. */
  "validation_failed",
  /** Throttled. The response carries `Retry-After`. */
  "rate_limited",
  /** The request contradicts current state: stock moved, a price changed, an idempotent replay disagreed. */
  "conflict",
  /** The action needs a settled payment that has not settled. */
  "payment_required",
  /** A dependency this platform does not control failed: the payment provider, ERP, the search cluster. */
  "upstream_unavailable",
  /** An unexpected fault. `requestId` is the only useful thing the client can report. */
  "internal",
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODE_VALUES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * Per-field validation detail, keyed by the dotted path into the request body
 * (`items.0.quantity`, `shippingAddress.country`). A list of messages per path
 * rather than one, because Zod reports several issues on one field routinely.
 *
 * Present only with `code: "validation_failed"`; omitted entirely otherwise,
 * so an empty map is never sent as a claim that nothing is wrong.
 */
export const FieldErrorsSchema = z.record(z.string(), z.array(z.string()).min(1));

export const ApiErrorSchema = z
  .object({
    code: ErrorCodeSchema,
    /**
     * Human-readable and safe to show. It is NOT a stable identifier — the app
     * branches on `code`, never on this text.
     */
    message: z.string().min(1).max(2000),
    /**
     * The server-assigned id for this exact request. Required, not optional:
     * a support conversation that starts with "it failed" and cannot name the
     * request is a conversation with no evidence in it.
     */
    requestId: z.string().min(1).max(128),
    fieldErrors: FieldErrorsSchema.optional(),
  })
  .strict();

export const ErrorEnvelopeSchema = z.object({ error: ApiErrorSchema }).strict();

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

/**
 * Cursor pagination metadata.
 *
 * `cursor` is the opaque position to send back as `?cursor=` for the NEXT
 * page, and is null on the last page. There is deliberately no `total`: the
 * existing `/api/products` runs an unbounded `count()` beside every page query
 * against the same pool checkout transactions queue on, which is the cheapest
 * external way to load this database. A mobile list needs "is there more",
 * not "how many are there", and `hasMore` answers that for free.
 */
export const PageMetaSchema = z
  .object({
    cursor: z.string().min(1).max(512).nullable(),
    hasMore: z.boolean(),
  })
  .strict();

export type PageMeta = z.infer<typeof PageMetaSchema>;

/**
 * ONE success envelope: `{ data, meta? }`.
 *
 * `.strict()` on the wrapper is what keeps a route from quietly appending a
 * sibling key the contract does not describe — which is exactly how
 * `/api/products` grew `{ success, products, page, limit, total, totalPages }`
 * around its payload.
 */
export function successEnvelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({ data, meta: PageMetaSchema.optional() }).strict();
}

/** A cursor-paginated collection: the meta block is REQUIRED, never optional. */
export function pageEnvelope<T extends z.ZodTypeAny>(item: T) {
  return z.object({ data: z.array(item), meta: PageMetaSchema }).strict();
}

/**
 * The query every cursor-paginated endpoint accepts.
 *
 * `limit` is capped at 100, the same ceiling `/api/products` enforces today.
 * The values arrive as query strings, so `limit` is coerced; `cursor` is
 * opaque and must be echoed back byte for byte.
 */
export const CursorQuerySchema = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(24),
  })
  .strict();

export type CursorQuery = z.infer<typeof CursorQuerySchema>;

/** A bare acknowledgement, for endpoints whose only answer is "it happened". */
export const AcknowledgementSchema = z.object({ ok: z.literal(true) }).strict();
