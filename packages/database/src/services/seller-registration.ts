import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db, AuditAction, type Country, type Language, type SellerStatus, type SellerTier, type SellerType } from "../index";
import { requireCurrentAdminActor } from "./checkout-invariants";

/**
 * Seller self-registration.
 *
 * Until this service existed the only way a SellerProfile came into being was
 * the pilot-catalog upsert: a supplier who clicked "Become a seller" had
 * nowhere to go. This is the one write path that turns an applicant into an
 * owner login plus a seller organisation under review.
 *
 * `registerSeller` takes the password already hashed. Hashing is the caller's
 * job (the route pays the bcrypt cost before it knows whether the address is
 * taken, so the response time cannot betray membership) and is done through
 * `hashSellerPassword` below: bcryptjs is a dependency of this package and of
 * @avenick/auth — whose credentials provider is what will later compare the
 * hash — but not of the seller app, so the app cannot import it directly.
 * bcryptjs already ships in every portal's middleware bundle via that
 * provider; unlike the pilot-catalog importer this module pulls in no
 * node:crypto, which is what keeps it safe to re-export from the barrel.
 */

/**
 * The bcrypt cost the credentials provider expects (packages/auth/src/config.ts
 * compares against whatever cost is encoded in the hash, so this only has to
 * match what the other registration routes spend: cost 12).
 */
const PASSWORD_HASH_COST = 12;

/** Hash a plaintext password the way every other registration route does. */
export function hashSellerPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_HASH_COST);
}

/** Which unique column an application collided with. */
export type SellerRegistrationConflictField = "email" | "crNumber" | "phone";

/**
 * Thrown instead of leaking Prisma's P2002 upward. The caller decides what to
 * say for each field — an email collision must be answered neutrally, a CR
 * collision may be named — so the field, not a message, is the contract.
 */
export class SellerRegistrationConflictError extends Error {
  readonly field: SellerRegistrationConflictField;

  constructor(field: SellerRegistrationConflictField) {
    super(`Seller registration conflict: ${field}`);
    this.name = "SellerRegistrationConflictError";
    this.field = field;
  }
}

const CONFLICT_FIELDS: readonly SellerRegistrationConflictField[] = ["email", "crNumber", "phone"];

/**
 * Structural check for the route layer. `instanceof` is the usual answer, but
 * a bundler that reaches this package by two paths would hand the app a
 * second copy of the class; the name and field are stable whichever copy threw.
 */
export function isSellerRegistrationConflictError(error: unknown): error is SellerRegistrationConflictError {
  if (error instanceof SellerRegistrationConflictError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; field?: unknown };
  return (
    candidate.name === "SellerRegistrationConflictError" &&
    CONFLICT_FIELDS.includes(candidate.field as SellerRegistrationConflictField)
  );
}

/**
 * Structurally identical to `RegisterSellerInput` from @avenick/types plus the
 * hash. It is declared here rather than imported because @avenick/types
 * already depends on this package for its enum type-proofs; importing it back
 * would make the dependency circular.
 */
export interface SellerRegistrationInput {
  businessNameEn: string;
  businessNameAr?: string;
  crNumber: string;
  vatNumber?: string;
  type: SellerType;
  country: Country;
  city: string;
  description?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  language: Language;
  passwordHash: string;
}

export interface SellerRegistrationResult {
  userId: string;
  sellerId: string;
}

/** Turn an optional, possibly blank, string into a stored value or null. */
function nullableText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Map a Prisma unique-constraint violation onto the field that caused it.
 * `meta.target` is the list of columns in the violated index; the only unique
 * columns reachable from this transaction are User.email, User.phone and
 * SellerProfile.crNumber (SellerProfile.userId cannot collide with a user
 * created in the same transaction).
 */
function conflictFieldFrom(error: unknown): SellerRegistrationConflictField | null {
  if (!error || typeof error !== "object" || (error as { code?: string }).code !== "P2002") return null;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  const columns = Array.isArray(target) ? target.map(String) : typeof target === "string" ? [target] : [];
  if (columns.includes("email")) return "email";
  if (columns.includes("crNumber")) return "crNumber";
  if (columns.includes("phone")) return "phone";
  return null;
}

/**
 * Create the owner login, the seller organisation and the audit row in one
 * transaction, so a failure on the profile (a CR number already registered)
 * cannot leave an orphaned owner whose retry then fails on the email.
 *
 * The user is created ACTIVE on purpose: login only checks User.status, and a
 * seller under review must be able to sign in to see that they are under
 * review (/pending). What they cannot do is trade — that is gated by
 * SellerProfile.status, which starts at PENDING_REVIEW and only admin approval
 * (approveSeller) moves to ACTIVE.
 *
 * Order of checks matters for privacy. The CR and phone collisions are decided
 * BEFORE the row that carries the email is inserted, so whether the caller
 * answers "CR already registered" or "phone already registered" never depends
 * on whether the email is known. If the email were tested first, submitting a
 * known CR alongside a candidate address would reveal that address's
 * membership by which answer came back.
 */
export async function registerSeller(input: SellerRegistrationInput): Promise<SellerRegistrationResult> {
  const email = input.email.trim().toLowerCase();
  const crNumber = input.crNumber.trim();
  const phone = nullableText(input.phone);

  try {
    return await db.$transaction(async (tx) => {
      const existingCr = await tx.sellerProfile.findUnique({ where: { crNumber }, select: { id: true } });
      if (existingCr) throw new SellerRegistrationConflictError("crNumber");

      if (phone) {
        const existingPhone = await tx.user.findUnique({ where: { phone }, select: { id: true } });
        if (existingPhone) throw new SellerRegistrationConflictError("phone");
      }

      const user = await tx.user.create({
        data: {
          email,
          passwordHash: input.passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone,
          role: "SELLER_OWNER",
          status: "ACTIVE",
          language: input.language,
        },
        select: { id: true },
      });

      const seller = await tx.sellerProfile.create({
        data: {
          userId: user.id,
          businessNameEn: input.businessNameEn.trim(),
          businessNameAr: nullableText(input.businessNameAr),
          crNumber,
          vatNumber: nullableText(input.vatNumber),
          type: input.type,
          country: input.country,
          city: input.city.trim(),
          description: nullableText(input.description),
          status: "PENDING_REVIEW",
        },
        select: { id: true, status: true },
      });

      // The applicant is the actor: nobody else touched this row yet, and the
      // admin queue reads this entry as "when did the application arrive".
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          sellerId: seller.id,
          entityType: "SellerProfile",
          entityId: seller.id,
          action: AuditAction.CREATE,
          after: { status: seller.status },
        },
      });

      return { userId: user.id, sellerId: seller.id };
    });
  } catch (error) {
    if (isSellerRegistrationConflictError(error)) throw error;
    // Two applications for the same new email, CR or phone can both pass the
    // reads above; the loser surfaces here as P2002 and must be reported as
    // the same conflict the pre-check would have found.
    const field = conflictFieldFrom(error);
    if (field) throw new SellerRegistrationConflictError(field);
    throw error;
  }
}

// ─── ADMIN-CREATED SELLER ACCOUNTS ───────────────────────────────────────────
//
// Self-registration is not how most suppliers actually arrive. A trade platform
// signs a distributor in a meeting, and somebody on the platform side then has
// to put them into the system — which, until this existed, nobody could do:
// approveSeller and rejectSeller could only DECIDE an application that the
// supplier had already filed themselves, so the admin Sellers page could list
// and judge sellers but never create one.
//
// This is that path. It differs from registerSeller in three deliberate ways.
//
//   1. The actor is an administrator, re-resolved and locked inside the
//      transaction (requireCurrentAdminActor), exactly like every other admin
//      decision. A revoked admin cannot ride a stale form.
//   2. It may open the account ACTIVE, skipping the review queue — but only for
//      a SUPER_ADMIN. An ADMIN can create the organisation and put it in the
//      queue; only the higher role can wave a seller straight into trading.
//      Creating and approving are separate authorities, and one person holding
//      both should be a deliberate grant rather than a side effect of a new
//      form.
//   3. An email collision is NAMED. registerSeller must answer a collision
//      neutrally because it is public and would otherwise be a membership
//      oracle for any address on the internet. This caller is a signed-in
//      administrator who is entitled to know that the address is taken, and
//      hiding it from them would only produce a confusing failure.

/** What an administrator may set that a self-registering applicant may not. */
export interface AdminSellerCreationInput extends SellerRegistrationInput {
  /**
   * The status the organisation opens in. PENDING_REVIEW puts it in the same
   * queue a self-registration lands in; ACTIVE lets it trade at once and
   * requires SUPER_ADMIN.
   */
  status?: Extract<SellerStatus, "PENDING_REVIEW" | "ACTIVE">;
  /** Commercial terms. Omitted values keep the schema defaults. */
  tier?: SellerTier;
  /** Percent, 0–100. The column is Decimal(5,2). */
  commissionRate?: number;
}

export interface AdminSellerCreationResult extends SellerRegistrationResult {
  status: SellerStatus;
}

/**
 * Create a seller organisation and its owner login on an administrator's
 * authority, in one transaction with the audit entry that records who did it.
 */
export async function createSellerAccount(
  input: AdminSellerCreationInput,
  actorId: string,
): Promise<AdminSellerCreationResult> {
  const email = input.email.trim().toLowerCase();
  const crNumber = input.crNumber.trim();
  const phone = nullableText(input.phone);
  const status: SellerStatus = input.status ?? "PENDING_REVIEW";

  if (input.commissionRate !== undefined) {
    // Guarded here as well as at the form: this is the number every settlement
    // for this seller is computed from, and Decimal(5,2) would silently accept
    // a value the business never intends.
    if (!Number.isFinite(input.commissionRate) || input.commissionRate < 0 || input.commissionRate > 100) {
      throw new Error("Commission rate must be a percentage between 0 and 100");
    }
  }

  try {
    return await db.$transaction(async (tx) => {
      // Opening an account ACTIVE skips the review queue entirely, so it is
      // held to the higher role. Creating one for the queue is ordinary admin
      // work.
      await requireCurrentAdminActor(tx, actorId, status === "ACTIVE" ? "SUPER_ADMIN" : undefined);

      const existingCr = await tx.sellerProfile.findUnique({ where: { crNumber }, select: { id: true } });
      if (existingCr) throw new SellerRegistrationConflictError("crNumber");

      const existingEmail = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (existingEmail) throw new SellerRegistrationConflictError("email");

      if (phone) {
        const existingPhone = await tx.user.findUnique({ where: { phone }, select: { id: true } });
        if (existingPhone) throw new SellerRegistrationConflictError("phone");
      }

      const user = await tx.user.create({
        data: {
          email,
          passwordHash: input.passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone,
          role: "SELLER_OWNER",
          status: "ACTIVE",
          language: input.language,
        },
        select: { id: true },
      });

      const seller = await tx.sellerProfile.create({
        data: {
          userId: user.id,
          businessNameEn: input.businessNameEn.trim(),
          businessNameAr: nullableText(input.businessNameAr),
          crNumber,
          vatNumber: nullableText(input.vatNumber),
          type: input.type,
          country: input.country,
          city: input.city.trim(),
          description: nullableText(input.description),
          status,
          ...(input.tier ? { tier: input.tier } : {}),
          ...(input.commissionRate !== undefined ? { commissionRate: new Prisma.Decimal(input.commissionRate) } : {}),
        },
        select: { id: true, status: true, tier: true, commissionRate: true },
      });

      // The administrator is the actor, not the seller — this row is what makes
      // an admin-created account distinguishable from a self-registration in
      // the audit trail, which matters when asking later why a seller was
      // trading without ever appearing in the queue.
      await tx.auditLog.create({
        data: {
          actorId,
          sellerId: seller.id,
          entityType: "SellerProfile",
          entityId: seller.id,
          action: AuditAction.CREATE,
          after: {
            status: seller.status,
            tier: seller.tier,
            commissionRate: seller.commissionRate.toString(),
            ownerUserId: user.id,
            createdBy: "admin",
            openedWithoutReview: seller.status === "ACTIVE",
          },
        },
      });

      return { userId: user.id, sellerId: seller.id, status: seller.status };
    });
  } catch (error) {
    if (isSellerRegistrationConflictError(error)) throw error;
    const field = conflictFieldFrom(error);
    if (field) throw new SellerRegistrationConflictError(field);
    throw error;
  }
}
