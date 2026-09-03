import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac } from "node:crypto";
import { hashSellerPassword, isSellerRegistrationConflictError, registerSeller } from "@avenick/database";
import { RegisterSellerSchema } from "@avenick/types";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";

// node:crypto (the log pseudonym) and bcrypt have no edge build; pin the
// runtime so a future `runtime = "edge"` default cannot break this handler.
export const runtime = "nodejs";

const PATH = "/api/auth/register/seller";

/**
 * Human names for the fields this endpoint validates. The form renders
 * `error` verbatim, so a bare Zod message — "Required", "Invalid" — would name
 * no field and tell nobody what to fix (see the business registration route).
 */
const FIELD_LABELS: Record<string, string> = {
  businessNameEn: "Business name (English)",
  businessNameAr: "Business name (Arabic)",
  crNumber: "Commercial registration number",
  vatNumber: "VAT number",
  type: "Business type",
  country: "Country",
  city: "City",
  description: "Description",
  firstName: "First name",
  lastName: "Last name",
  email: "Email address",
  phone: "Phone number",
  password: "Password",
  language: "Preferred language",
  acceptTerms: "Terms of service",
};

function labelFor(field: string) {
  return FIELD_LABELS[field] ?? field;
}

/**
 * One sentence per failed field, keeping Zod's own text (which names the
 * accepted values) rather than inventing a summary.
 */
function describeValidationFailure(issues: readonly { path: (string | number)[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path.map(String).join(".") || "form";
    // First issue per field wins: later ones are usually consequences of it.
    if (!(field in fieldErrors)) fieldErrors[field] = issue.message;
  }

  const sentences = Object.entries(fieldErrors).map(([field, message]) =>
    message === "Required" ? `${labelFor(field)} is required.` : `${labelFor(field)}: ${message}`,
  );
  const remaining = sentences.length - 3;
  const error =
    remaining > 0
      ? `${sentences.slice(0, 3).join(" ")} (and ${remaining} more field${remaining === 1 ? "" : "s"} to correct)`
      : sentences.join(" ");

  return { error, fieldErrors };
}

/** Domain separation, so this pseudonym can never collide with another use. */
const REF_DOMAIN = "seller-register-notice";

/**
 * A stable pseudonym for an email address, for log lines only.
 *
 * There is no mail sender in this app, so an "already registered" notice
 * cannot be sent from here; the most this route can do is record that one was
 * owed. Logging the address itself would write personal data to stdout on
 * every collision, so the line carries the same `recipientRef` shape the
 * customer app's mailer uses: enough to answer "did this address collide?"
 * from a support ticket, without the address. Keyed with the auth secret when
 * one is set so the digest cannot be reversed from a list of candidates.
 */
function recipientRef(address: string): string {
  try {
    const payload = `${REF_DOMAIN}:${address.trim().toLowerCase()}`;
    const key = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
    const digest = key
      ? createHmac("sha256", key).update(payload, "utf8").digest("hex")
      : createHash("sha256").update(payload, "utf8").digest("hex");
    return digest.slice(0, 12);
  } catch {
    // A log label must never be the reason a registration fails.
    return "unavailable";
  }
}

/**
 * The one answer an applicant gets whether their address was new or not.
 *
 * An email address is a personal identifier. If this endpoint answered
 * differently for a known address it would be a membership oracle: anyone
 * could ask "does this person sell on Avenick?" one address at a time, and
 * the per-IP throttle only slows a list down. So a collision on the email
 * answers with this exact object — same status, same body — and the real
 * owner of the address is told nothing from here (see the cross-track note in
 * the S1 report: the seller app has no mailer). The status is the one the
 * service explicitly writes, not a schema default restated.
 */
const APPLICATION_RECEIVED = { success: true, status: "PENDING_REVIEW" } as const;

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(RATE_LIMITS.sellerRegister, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many registration attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "The request body must be JSON." }, { status: 400 });
    }

    const parsed = RegisterSellerSchema.safeParse(body);
    if (!parsed.success) {
      // `fieldErrors` lets the form mark the offending inputs; `error` is the
      // sentence it can show as-is.
      const { error, fieldErrors } = describeValidationFailure(parsed.error.issues);
      return NextResponse.json({ success: false, error, fieldErrors }, { status: 400 });
    }

    // Hash before anything that could short-circuit on an existing address.
    // bcrypt is by far the most expensive thing this handler does, so hashing
    // only on the create path would leave the response time as the oracle the
    // response body no longer is. The hash comes from @avenick/database: this
    // app does not depend on bcryptjs itself.
    const { password, ...application } = parsed.data;
    const passwordHash = await hashSellerPassword(password);

    try {
      const { sellerId } = await registerSeller({ ...application, passwordHash });
      log.info("register.seller: application received", { path: PATH, sellerId });
      return NextResponse.json(APPLICATION_RECEIVED);
    } catch (e) {
      if (!isSellerRegistrationConflictError(e)) throw e;

      switch (e.field) {
        case "email":
          log.info("register.seller: address already registered", {
            path: PATH,
            recipientRef: recipientRef(application.email),
          });
          return NextResponse.json(APPLICATION_RECEIVED);
        case "crNumber":
          // A commercial registration number is public registry data — anyone
          // can look up who holds it — so "this company already has an account"
          // discloses nothing personal, and it is exactly what a second owner or
          // an applicant who forgot an earlier application needs to hear. The
          // service decides this collision before it looks at the email, so the
          // answer never depends on whether the address is known.
          return NextResponse.json(
            {
              success: false,
              field: "crNumber",
              error:
                "This commercial registration number is already registered. Sign in, or contact support if you believe this is an error.",
            },
            { status: 409 },
          );
        case "phone":
          return NextResponse.json(
            { success: false, field: "phone", error: "This phone number is already registered." },
            { status: 409 },
          );
        default:
          throw e;
      }
    }
  } catch (e) {
    log.error("register.seller failed", e, { path: PATH });
    return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
  }
}
