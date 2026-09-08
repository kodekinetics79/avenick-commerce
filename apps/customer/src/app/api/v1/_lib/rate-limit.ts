import type { RateLimitRule } from "@avenick/auth/rate-limit";

/**
 * Throttles for the /api/v1 surface.
 *
 * These are declared here rather than added to `RATE_LIMITS` in
 * `@avenick/auth/rate-limit` because they are a property of THIS surface: the
 * mobile client's call pattern is not the web portal's, and a shared table
 * edited by every consumer is how one app's traffic shape silently retunes
 * another's. `checkRateLimit` takes a rule object, so no shared registry is
 * needed to use one.
 */
export const V1_RATE_LIMITS = {
  /**
   * Checkout quotes, per signed-in account or per client IP for a guest.
   *
   * A quote is re-requested on every basket edit and every address change, so
   * a real checkout session can legitimately produce a dozen in a minute. It
   * is not free, though: each one reads the products with their price lists
   * and variants, the active shipping zones and the live promotions — against
   * the same connection pool the checkout transactions queue on. Sixty a
   * minute leaves an indecisive buyer alone and stops the endpoint being used
   * as a priced-catalogue scraper.
   */
  checkoutQuote: { name: "v1-checkout-quote", limit: 60, windowMs: 60_000 },

  /**
   * Catalogue reads — products, product detail, categories, brands — per
   * client IP for a guest and per account for a signed-in caller.
   *
   * These are public and unauthenticated, which makes them the cheapest
   * external way to load this database; checkout transactions queue behind the
   * same connection pool. The v1 listing carries no `count()`, so a page is
   * cheaper here than on `/api/products` — but a product page still reads
   * images, every active price band, the variants and a grouped review
   * aggregate. Matched to `RATE_LIMITS.catalogRead` rather than set higher:
   * a phone scrolling a grid at 120 requests a minute is already fetching four
   * pages a second, and the app pages by cursor rather than re-requesting.
   */
  catalogueRead: { name: "v1-catalogue-read", limit: 120, windowMs: 60_000 },

  /**
   * A signed-in account reading its own records: orders, profile, addresses.
   *
   * Every one of these is owner-scoped and indexed, so the cap is about a
   * runaway client — a retry loop on a failing screen — rather than about
   * abuse. Generous enough that a pull-to-refresh is never throttled.
   */
  accountRead: { name: "v1-account-read", limit: 120, windowMs: 60_000 },

  /**
   * Address writes, per account.
   *
   * Lower than the reads because each one can take a transaction: setting an
   * address default clears the flag on every other address the account holds,
   * and a client looping on that is a write storm against a row every checkout
   * reads. Nobody edits their address book thirty times a minute.
   */
  addressWrite: { name: "v1-address-write", limit: 30, windowMs: 60_000 },

  /**
   * Raising a request for quote, and deciding one, per account.
   *
   * An RFQ is a message to a human supplier, so the cost of abuse is somebody's
   * inbox rather than the database: a loop here fills a seller's queue with
   * requests nobody will answer, and the seller dashboard counts them. Ten a
   * minute is far beyond any real buyer — the app raises one per product page —
   * and low enough that a runaway client is stopped before a supplier notices.
   *
   * Order PLACEMENT deliberately does not appear here: it uses the shared
   * `RATE_LIMITS.orderCreate`, because it is the same transaction taking the
   * same stock locks as the web checkout and two budgets for one write is how a
   * throttled client discovers it can keep going on the other surface.
   */
  rfqWrite: { name: "v1-rfq-write", limit: 10, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;
