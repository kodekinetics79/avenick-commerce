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
} satisfies Record<string, RateLimitRule>;
