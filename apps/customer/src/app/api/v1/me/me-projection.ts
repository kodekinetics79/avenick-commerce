import type { Me } from "@avenick/contracts";
import type { CompanyStatus, Country, Language, UserRole, UserStatus } from "@avenick/database";

import { toImage, toTimestamp } from "../_lib/dto";

/**
 * The signed-in identity, in one request.
 *
 * The company membership travels with it deliberately: a B2B buyer's app is a
 * different app — prices, approval flows and purchase orders all hang off it —
 * so whether the caller has one is answered here rather than by a second call
 * that renders the first screen twice.
 */

/**
 * The contract's phone format, which is also the one every registration form in
 * `@avenick/types/schemas` enforces.
 *
 * A row that predates that rule (a local-format number, a number with spaces)
 * is reported as ABSENT rather than passed through. Passing it through fails
 * response validation and takes /v1/me down for that account entirely, which
 * takes the whole app down — there is no screen that does not need the
 * identity. Reported as absent, the profile screen offers to add one, and
 * saving it through `UpdateMeRequestSchema` repairs the row in the format
 * everything else already expects.
 *
 * Returns the number, or null AND the reason it was dropped, so the route can
 * say so in the log rather than losing it silently.
 */
const CONTRACT_PHONE = /^\+[1-9]\d{7,14}$/;

export function contractPhone(value: string | null): { phone: string | null; dropped: boolean } {
  const candidate = value?.trim();
  if (!candidate) return { phone: null, dropped: false };
  if (CONTRACT_PHONE.test(candidate)) return { phone: candidate, dropped: false };
  return { phone: null, dropped: true };
}

export interface MeRow {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  avatar: string | null;
  role: UserRole;
  status: UserStatus;
  language: Language;
  emailVerified: Date | null;
  phoneVerified: Date | null;
  createdAt: Date;
  companyMember: {
    companyId: string;
    role: UserRole;
    isActive: boolean;
    company: {
      nameEn: string;
      nameAr: string | null;
      country: Country;
      // The Prisma type, not a hand-written subset: this was three literals
      // and went stale the moment REJECTED and INFO_REQUESTED were added.
      status: CompanyStatus;
      deletedAt: Date | null;
    };
  } | null;
}

export function toMe(user: MeRow, origin: string): Me {
  const member = user.companyMember;
  /*
    The membership is reported when the row is live — the member has not been
    deactivated and the company has not been soft-deleted — and its `status` is
    carried through UNCHANGED, including PENDING_VERIFICATION and SUSPENDED.
    That is the point of the field: the app has to draw "your company is still
    being verified" differently from "you have no company", and collapsing both
    to null would make those the same screen.

    Note this is deliberately WIDER than `resolvePrincipal`'s notion of a
    company, which requires the company to be ACTIVE before it will let B2B
    pricing be quoted. Being told about a pending company is not the same as
    being priced as one.
  */
  const company = member && member.isActive && !member.company.deletedAt
    ? {
        companyId: member.companyId,
        nameEn: member.company.nameEn,
        nameAr: member.company.nameAr,
        country: member.company.country,
        status: member.company.status,
        role: member.role,
      }
    : null;

  return {
    id: user.id,
    email: user.email,
    phone: contractPhone(user.phone).phone,
    firstName: user.firstName,
    lastName: user.lastName,
    firstNameAr: user.firstNameAr,
    lastNameAr: user.lastNameAr,
    avatar: toImage({ url: user.avatar, alt: null }, origin),
    role: user.role,
    status: user.status,
    language: user.language,
    // Booleans, not the DateTime? columns behind them: the app branches on "is
    // this verified", and shipping the instant invites a client to compute
    // freshness rules the server owns.
    emailVerified: user.emailVerified !== null,
    phoneVerified: user.phoneVerified !== null,
    company,
    createdAt: toTimestamp(user.createdAt),
  };
}
