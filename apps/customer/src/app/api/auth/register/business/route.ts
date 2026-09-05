import { NextRequest, NextResponse } from "next/server";
import { db } from "@avenick/database";
import bcrypt from "bcryptjs";
import { RegisterBusinessSchema } from "@avenick/types";
// Subpath, not the barrel: the table is 550 lines and this route is the only
// thing that needs it.
import { checkIdentifier, describeIdentifier } from "@avenick/utils/gcc-identifiers";
// Narrow subpath on purpose, the same reason /api/products gives: the package
// barrel pulls in next-auth, which this route never touches, and which drags
// the whole credentials provider — and therefore Prisma — into any test or
// bundle that imports it.
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";
import { sendAlreadyRegisteredNotice } from "@/lib/email";

/**
 * Human names for the fields this endpoint validates.
 *
 * The registration form renders `error` verbatim, so a bare Zod message —
 * "Required", "Invalid" — named no field and told nobody what to fix. That is
 * how a form which never submitted `companySize` at all looked like a generic
 * "Registration failed" instead of a missing input.
 */
const FIELD_LABELS: Record<string, string> = {
  companyNameEn: "Company name (English)",
  companyNameAr: "Company name (Arabic)",
  crNumber: "Commercial registration number",
  vatNumber: "VAT number",
  industry: "Industry",
  companySize: "Company size",
  country: "Country",
  city: "City",
  firstName: "First name",
  lastName: "Last name",
  email: "Email address",
  phone: "Phone number",
  password: "Password",
  language: "Preferred language",
};

function labelFor(field: string) {
  return FIELD_LABELS[field] ?? field;
}

/**
 * Turn Zod issues into one sentence per failed field, keeping Zod's own text
 * (which names the accepted enum values) rather than inventing a summary.
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

export async function POST(req: NextRequest) {
  // Captured before the transaction so the P2002 race branch can notify the
  // owner; empty until the body has been validated.
  let raceEmail = "";
  try {
    const rl = await checkRateLimit(RATE_LIMITS.register, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many registration attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body = await req.json();
    const parsed = RegisterBusinessSchema.safeParse(body);
    if (!parsed.success) {
      // `fieldErrors` lets a caller mark the offending inputs; `error` is the
      // sentence a form can show as-is.
      const { error, fieldErrors } = describeValidationFailure(parsed.error.issues);
      return NextResponse.json({ success: false, error, fieldErrors }, { status: 400 });
    }

    const { email, password, firstName, lastName, phone, language, companyNameEn, companyNameAr, crNumber, vatNumber, industry, companySize, country, city } = parsed.data;

    /*
      The registry identifiers, checked against the country that issued them.

      RegisterBusinessSchema can only say "5 to 30 characters", because it does
      not know the country until the same payload is parsed. That is generic
      enough to accept a plainly wrong number and, worse, to refuse nothing —
      an applicant who transposes a digit learns it from a rejected order weeks
      later. The table in @avenick/utils holds the per-country rule and the
      sentence that explains it, in one entry, so what is enforced and what is
      shown cannot drift apart. The reference implementation this was modelled
      on drifted exactly there: its helper said "14 digits" while its validator
      refused fourteen.

      Only REFUSE blocks. The table's warn level covers conventions that are
      usually true and occasionally not — a Saudi VAT ending "03", a CR that
      looks like a unified number — and refusing a legitimate business over a
      convention is the worse failure by far. Warnings are for the form to show,
      never for this route to act on.
    */
    for (const [field, kind] of [["crNumber", "commercialRegistration"], ["vatNumber", "vatNumber"]] as const) {
      const value = field === "crNumber" ? crNumber : vatNumber;
      if (!value) continue;
      const outcome = checkIdentifier(country, kind, value);
      if (outcome.level !== "refuse") continue;
      const described = describeIdentifier(country, kind);
      return NextResponse.json(
        {
          success: false,
          error: outcome.message ?? `${labelFor(field)} is not valid for the selected country.`,
          fieldErrors: { [field]: outcome.message ?? described?.helper ?? `${labelFor(field)} is not valid for the selected country.` },
        },
        { status: 400 },
      );
    }

    const normalisedEmail = email.toLowerCase();
    raceEmail = normalisedEmail;

    // The CR number is checked FIRST and answers truthfully: a commercial
    // registration number is a public registry identifier, and "this company
    // already has an Avenick account" is what the applicant needs to hear.
    const existingCompany = await db.company.findUnique({ where: { crNumber } });
    if (existingCompany) {
      return NextResponse.json(
        { success: false, error: "A company is already registered with that commercial registration number." },
        { status: 409 },
      );
    }

    // Hash before the email existence check, not after, so the response time
    // is not the oracle the status code no longer is (see the consumer route).
    const passwordHash = await bcrypt.hash(password, 12);

    // An email address is personal data, and this endpoint used to confirm
    // membership with a 409. It now answers exactly as a successful application
    // would, and the address's real owner is told out of band. The shape
    // matches the success branch below: companyStatus is the default a new
    // company row gets, which is what the applicant would have been told.
    const existingUser = await db.user.findUnique({ where: { email: normalisedEmail }, select: { id: true } });
    if (existingUser) {
      log.info("register.business: address already registered", { path: "/api/auth/register/business" });
      await sendAlreadyRegisteredNotice({ to: normalisedEmail, source: "business" });
      return NextResponse.json({
        success: true,
        message: "Business account created",
        data: { companyStatus: "PENDING_VERIFICATION" },
      });
    }

    // User + company + membership must be created atomically — otherwise a
    // failure on company creation (e.g. duplicate VAT number) would leave an
    // orphaned user and make retries fail with "Email already registered".
    const company = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalisedEmail,
          passwordHash,
          firstName,
          lastName,
          phone: phone ?? null,
          role: "COMPANY_ADMIN",
          status: "ACTIVE",
          language,
        },
      });

      // No casts: RegisterBusinessSchema's enums are the Prisma enums (see
      // EnumListsMatchPrisma in packages/types/src/schemas.ts). The `as Industry`
      // casts that used to sit here are what let a Zod list sharing only five of
      // its nine values with the database compile cleanly and fail at INSERT.
      return tx.company.create({
        data: {
          nameEn: companyNameEn,
          nameAr: companyNameAr ?? null,
          crNumber,
          vatNumber: vatNumber ?? null,
          industry,
          size: companySize,
          country,
          city,
          status: "PENDING_VERIFICATION",
          members: { create: { userId: user.id, role: "COMPANY_ADMIN" } },
        },
        select: { status: true },
      });
    });

    // Report the status the row actually has rather than restating the literal
    // above: the caller uses it to tell the applicant what happens next, and a
    // default changed in schema.prisma must not turn that into a false promise.
    return NextResponse.json({
      success: true,
      message: "Business account created",
      data: { companyStatus: company.status },
    });
  } catch (e) {
    // Unique-constraint violations: CR / VAT → 409 naming the field; an email
    // collision (two requests for the same new address racing past the check
    // above) must answer exactly like the pre-check branch, or the race itself
    // becomes the oracle.
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      const target = (e as { meta?: { target?: string[] } }).meta?.target ?? [];
      if (target.includes("email")) {
        await sendAlreadyRegisteredNotice({ to: raceEmail, source: "business" });
        return NextResponse.json({
          success: true,
          message: "Business account created",
          data: { companyStatus: "PENDING_VERIFICATION" },
        });
      }
      const fields = target.length ? target.map(labelFor).join(", ") : "one of the details you entered";
      return NextResponse.json({ success: false, error: `Already registered: ${fields}.` }, { status: 409 });
    }
    log.error("register.business failed", e, { path: "/api/auth/register/business" });
    return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
  }
}
