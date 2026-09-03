/**
 * Maps an Auth.js sign-in error code to something a person can act on.
 *
 * The distinction that matters is throttling versus wrong credentials. Telling
 * a rate-limited user their password is wrong makes them retry — spending more
 * of the budget that is already exhausted — and can send them to a password
 * reset they never needed.
 *
 * Anything unrecognised falls back to the generic credential message: we never
 * reveal whether an account exists.
 */

const RATE_LIMITED = "rate_limited";

export function messageForSignInError(code: string | null | undefined): string {
  if (!code) return "";
  if (code === RATE_LIMITED) {
    return "Too many sign-in attempts. Please wait a few minutes and try again.";
  }
  return "Invalid email or password.";
}

/** Bilingual variant for the customer storefront. */
export function messageForSignInErrorBilingual(code: string | null | undefined): string {
  if (!code) return "";
  if (code === RATE_LIMITED) {
    return "Too many sign-in attempts. Please wait a few minutes and try again. / محاولات تسجيل دخول كثيرة. يرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.";
  }
  return "Invalid email or password. / بيانات الدخول غير صحيحة.";
}
