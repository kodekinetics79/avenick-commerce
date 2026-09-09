/**
 * Package entry for @avenick/email-templates — the file package.json's
 * "exports" has pointed at since the package was created, so until now the
 * package resolved to nothing. Each template stays in its own file; this only
 * gathers them.
 *
 * The prop types are derived from the component signatures rather than
 * re-declared here, so a change to a template's props cannot leave a stale
 * copy behind in the barrel.
 *
 * Nothing sends these yet. Wiring the seller welcome mail (and the other two)
 * into a sender is a follow-up.
 *
 * `platformName` is now a REQUIRED prop on all three rather than an optional one
 * with a brand literal behind it. The note that used to sit here asked the
 * future sender to remember to pass it; a request in a docstring is not a
 * guarantee, and the fallback it was guarding against ("منزل", the previous
 * brand) would have gone out silently the first time somebody forgot. The type
 * enforces it now, so that mistake fails at compile time instead of in an
 * Arabic recipient's inbox.
 */
export { DocumentStatusEmail } from "./document-status";
export { OrderConfirmationEmail } from "./order-confirmation";
export { SellerWelcomeEmail } from "./seller-welcome";

import type { DocumentStatusEmail } from "./document-status";
import type { OrderConfirmationEmail } from "./order-confirmation";
import type { SellerWelcomeEmail } from "./seller-welcome";

export type DocumentStatusEmailProps = Parameters<typeof DocumentStatusEmail>[0];
export type OrderConfirmationEmailProps = Parameters<typeof OrderConfirmationEmail>[0];
/** One line of an order confirmation; the array element type of `items`. */
export type OrderConfirmationEmailItem = OrderConfirmationEmailProps["items"][number];
export type SellerWelcomeEmailProps = Parameters<typeof SellerWelcomeEmail>[0];
