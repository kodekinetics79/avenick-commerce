import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { CompanyStatus, db } from "@avenick/database";
import { RegisterJoinSchema } from "@avenick/types";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";
import { domainMatchesCompany, emailDomainOf } from "@avenick/utils";
import { selfOrigin } from "@avenick/utils/portal-config";
import { mailDeliveryConfigured, sendAlreadyRegisteredNotice, sendJoinVerificationEmail } from "@/lib/email";
import { mintEmailVerificationToken } from "@/lib/email-verification";
import { resolveTokenSecret } from "@/lib/signed-token";

// node:crypto (token signing) and bcrypt have no edge build; pin the runtime
// so a future default change cannot silently move this handler.
export const runtime = "nodejs";

const PATH = "/api/auth/register/join";

/** The page that consumes the confirmation link this route sends. */
const VERIFY_PAGE_PATH = "/auth/confirm-email";

/**
 * The one answer for every successful application, and for every branch that
 * must be indistinguishable from one.
 *
 * It promises exactly two things, both of which are true in every branch that
 * returns it: a mail may have been sent, and no access has been granted. It
 * does NOT say "we have created your account", because in the
 * already-registered branch nothing was created.
 */
const NEUTRAL_OUTCOME = {
  success: true,
  message:
    "If that company can accept an application from this address, a confirmation email is on its way. Confirm it, and an administrator at the company decides the rest.",
} as const;

/**
 * Something for the branches that send no mail to spend, so the response time
 * is not the oracle the response body refuses to be. Mirrors the password-reset
 * request route: bcrypt at cost 12 is roughly what the outbound provider call
 * costs the branch that does send.
 */
async function spendAsIfSending(): Promise<void> {
  await bcrypt.hash("company-join-timing-equaliser", 12);
}

/** The one answer for every address-independent precondition that failed. */
function unavailable() {
  return NextResponse.json(
    { success: false, error: "Applications to join a company are not available from this environment." },
    { status: 500 },
  );
}

export async function POST(req: NextRequest) {
  try {
    // Misconfiguration is checked BEFORE anything depends on the input, so a
    // 500 here is the same for every caller and says nothing about companies or
    // addresses. All three are loud on purpose: an application whose
    // confirmation mail can never be sent, or whose token can never be signed,
    // is an account stuck at PENDING_EMAIL_VERIFICATION forever with a cheerful
    // "check your email" on screen.
    if (!resolveTokenSecret()) {
      log.error("register.join refused: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, { path: PATH });
      return unavailable();
    }
    const origin = selfOrigin("customer");
    if (!origin) {
      log.error("register.join refused: customer portal origin is not configured", undefined, { path: PATH });
      return unavailable();
    }
    const mail = mailDeliveryConfigured();
    if (!mail.ok) {
      log.error("register.join refused: this deployment cannot send mail", undefined, { path: PATH, reason: mail.reason });
      return unavailable();
    }

    // Tighter than plain registration on purpose: this route takes a commercial
    // registration number and reveals whether a company is registered under it,
    // so an unthrottled version is a way to walk the public CR registry against
    // this platform's customer list.
    const rl = await checkRateLimit(RATE_LIMITS.companyJoinRequest, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const parsed = RegisterJoinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { crNumber, firstName, lastName, email, phone, password, requestedRole, department, language } = parsed.data;

    const normalisedEmail = email.trim().toLowerCase();
    const crn = crNumber.trim();
    const domain = emailDomainOf(normalisedEmail);

    const company = await db.company.findUnique({
      where: { crNumber: crn },
      select: { id: true, nameEn: true, status: true, emailDomains: true },
    });

    // Answered truthfully, exactly as the business registration route answers
    // the mirror-image question. A CR number is a public registry identifier and
    // the applicant is holding it; "no company here" is what they need to hear,
    // and inventing a neutral success would send them away believing an email
    // was coming that never will.
    if (!company) {
      return NextResponse.json(
        {
          success: false,
          code: "cr-not-registered",
          error:
            "No company is registered with that commercial registration number. Check the number, or register the company instead.",
        },
        { status: 404 },
      );
    }

    if (company.status === CompanyStatus.SUSPENDED) {
      return NextResponse.json(
        { success: false, code: "company-suspended", error: "That company account is suspended and cannot take on new members." },
        { status: 403 },
      );
    }

    // The two ways the domain gate says no are NOT the same sentence, because
    // the two situations have different remedies. "Your address is at the wrong
    // domain" is fixed by using your work address. "This company has no
    // recognised domain" cannot be fixed by the applicant at all, and telling
    // them to check their address would send them round a loop forever — the
    // only thing that works is an invitation from inside.
    if (company.emailDomains.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: "company-has-no-domain",
          error:
            "That company has not registered an email domain, so it can only add members by invitation. Ask an administrator there to invite you.",
        },
        { status: 403 },
      );
    }
    if (!domain || !domainMatchesCompany(normalisedEmail, company.emailDomains)) {
      return NextResponse.json(
        {
          success: false,
          code: "domain-mismatch",
          error: `That email address is not at a domain registered to this company. Apply with your work address (${company.emailDomains.map((d) => `@${d}`).join(", ")}).`,
          fieldErrors: { email: "Use your work email address at this company." },
        },
        { status: 403 },
      );
    }

    // Hash before the existence check, not after, so the two branches below
    // cost the same (see the consumer route).
    const passwordHash = await bcrypt.hash(password, 12);

    // An address that already has an account is NOT confirmed here. The 409
    // this route could return would be a free membership oracle for anyone who
    // knows a company's CR and can guess at its staff directory — which is
    // exactly the population this endpoint is reachable by. The address's real
    // owner is told out of band instead, which also tells them somebody tried.
    const existingUser = await db.user.findUnique({ where: { email: normalisedEmail }, select: { id: true } });
    if (existingUser) {
      log.info("register.join: address already registered", { path: PATH });
      await sendAlreadyRegisteredNotice({ to: normalisedEmail, source: "business" });
      return NextResponse.json(NEUTRAL_OUTCOME);
    }

    // The user and the application are created together and neither is a
    // membership. The account is PENDING and holds no CompanyMember row, so
    // getB2BContext returns null for it and sign-in refuses it outright: until
    // an administrator approves, this person can see nothing of the company
    // whose CR they typed.
    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalisedEmail,
          passwordHash,
          firstName,
          lastName,
          phone: phone ?? null,
          role: requestedRole,
          status: "PENDING",
          language,
        },
        select: { id: true },
      });

      await tx.companyJoinRequest.create({
        data: {
          companyId: company.id,
          userId: user.id,
          status: "PENDING_EMAIL_VERIFICATION",
          requestedRole,
          department: department ?? null,
          emailDomain: domain,
        },
      });

      return user;
    });

    const token = mintEmailVerificationToken(created.id);
    const verifyUrl = `${origin}${VERIFY_PAGE_PATH}?token=${encodeURIComponent(token)}`;
    const outcome = await sendJoinVerificationEmail({
      to: normalisedEmail,
      companyName: company.nameEn,
      verifyUrl,
      firstName,
    });
    // Configuration was proven at the top, so a miss here is the provider
    // refusing, and the mail layer has already logged which. The row exists
    // either way and the applicant can re-apply once the request is cleaned up;
    // what must not happen is a different SHAPE of answer, which would reopen
    // the oracle the neutral branch above exists to close.
    if (!outcome.sent) {
      log.error("register.join: application created but confirmation mail was not sent", undefined, {
        path: PATH,
        userId: created.id,
        reason: outcome.reason,
      });
    }

    return NextResponse.json(NEUTRAL_OUTCOME);
  } catch (e) {
    // Two applications for the same new address racing past the existence check
    // must answer exactly like the pre-check branch, or the race is the oracle.
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      await spendAsIfSending();
      return NextResponse.json(NEUTRAL_OUTCOME);
    }
    log.error("register.join failed", e, { path: PATH });
    return NextResponse.json({ success: false, error: "Could not submit the application" }, { status: 500 });
  }
}
