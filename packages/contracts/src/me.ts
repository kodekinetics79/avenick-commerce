import { z } from "zod";

import { CountrySchema, LanguageSchema, UserRoleSchema, UserStatusSchema } from "./enums";
import { EmailSchema, IdSchema, ImageSchema, PhoneSchema, TimestampSchema } from "./primitives";
import { successEnvelope } from "./envelope";

/**
 * The company membership half of an identity. A B2B buyer's app is a different
 * app — prices, approval flows and purchase orders all hang off this — so
 * whether the signed-in user has one is answered in the same request as who
 * they are, not by a second call that renders the first screen twice.
 */
export const CompanyMembershipSchema = z
  .object({
    companyId: IdSchema,
    nameEn: z.string().min(1).max(200),
    nameAr: z.string().max(200).nullable(),
    country: CountrySchema,
    status: z.enum(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED"]),
    /** The member's role within the company, which gates approval actions. */
    role: UserRoleSchema,
  })
  .strict();

export const MeSchema = z
  .object({
    id: IdSchema,
    email: EmailSchema,
    phone: PhoneSchema.nullable(),
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    firstNameAr: z.string().max(50).nullable(),
    lastNameAr: z.string().max(50).nullable(),
    avatar: ImageSchema.nullable(),
    role: UserRoleSchema,
    status: UserStatusSchema,
    language: LanguageSchema,
    /**
     * Booleans, not the `DateTime?` columns behind them. The app branches on
     * "is this verified"; the instant it happened is not something any screen
     * shows, and shipping it invites a client to compute freshness rules the
     * server owns.
     */
    emailVerified: z.boolean(),
    phoneVerified: z.boolean(),
    company: CompanyMembershipSchema.nullable(),
    createdAt: TimestampSchema,
  })
  .strict();

export type Me = z.infer<typeof MeSchema>;

export const MeResponseSchema = successEnvelope(MeSchema);

/**
 * PATCH /v1/me.
 *
 * Email and role are absent by design: changing an email is a verification
 * flow, not a field edit, and a self-settable role is a privilege escalation.
 * Changing `phone` re-enters OTP verification server-side, so the response's
 * `phoneVerified` may come back false — that is the correct answer, not a bug.
 *
 * The refinement rejects `{}`. An empty patch is almost always a client bug
 * (a form that submitted nothing), and accepting it returns a 200 that looks
 * like a successful save of whatever the user typed.
 */
export const UpdateMeRequestSchema = z
  .object({
    firstName: z.string().trim().min(2).max(50).optional(),
    lastName: z.string().trim().min(2).max(50).optional(),
    firstNameAr: z.string().trim().min(2).max(50).nullable().optional(),
    lastNameAr: z.string().trim().min(2).max(50).nullable().optional(),
    phone: PhoneSchema.nullable().optional(),
    language: LanguageSchema.optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one field to change",
  });

export const UpdateMeResponseSchema = successEnvelope(MeSchema);

/**
 * DELETE /v1/account.
 *
 * Typed confirmation, not a bare DELETE: the destructive account action a
 * mis-routed retry can reach must require something only the account holder
 * can supply. `User.deletedAt` exists, so this is a soft delete with a
 * grace window, and the response says exactly when it becomes irreversible
 * rather than leaving the app to invent a number for the confirmation screen.
 */
export const DeleteAccountRequestSchema = z
  .object({
    /** Must equal the signed-in account's email, compared case-insensitively. */
    confirmEmail: EmailSchema,
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

export const AccountDeletionSchema = z
  .object({
    status: z.enum(["scheduled"]),
    requestedAt: TimestampSchema,
    /** When the data is erased. Until then the deletion can be cancelled by signing in. */
    erasesAt: TimestampSchema,
  })
  .strict();

export const DeleteAccountResponseSchema = successEnvelope(AccountDeletionSchema);
