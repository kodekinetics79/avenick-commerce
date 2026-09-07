/**
 * Client-safe validation schemas.
 *
 * Import this file via `@avenick/types/schemas` from "use client" components.
 * The package barrel (`@avenick/types`) re-exports runtime enums from
 * `@avenick/database`, which drags Prisma, observability and `@vercel/otel`
 * into the bundle — that fails the client build with "Can't resolve 'module'".
 * This module only imports zod and *types* from the database package, which
 * are erased at build time, so it is safe on both sides of the boundary.
 */
import { z } from "zod";

import type { CompanySize, Country, Currency, Industry, Language, SellerTier } from "@avenick/database";

// ─── Enum values (Prisma is the authority) ─────────────────────────────

/**
 * The enums in packages/database/prisma/schema.prisma are the single authority
 * for the lists below. They are the storage constraint, so any value Zod accepts
 * that Prisma does not is a 500 at write time — which is precisely what broke
 * B2B registration: a hand-written Industry list that shared only five of its
 * nine values with the database, so four choices validated and then failed the
 * INSERT while six real industries were unreachable.
 *
 * The Prisma enums are imported as TYPES only, on purpose. Their runtime value
 * export lives behind the @avenick/database barrel, which also drags the Prisma
 * client and node-only services into whatever bundle imports it (see the
 * pilot-catalog note in packages/database/src/index.ts); this package has to
 * stay safe to import from a browser bundle. `import type` is erased at compile
 * time, so the lists below remain plain string tuples at runtime while
 * `AssertTrue<Exact<...>>` turns any future drift — a value added, renamed or
 * removed in schema.prisma — into a typecheck error rather than a runtime fault.
 */
type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

/** Prisma `Country` — the GCC markets Avenick operates in. */
export const COUNTRY_VALUES = ["AE", "SA", "QA", "KW", "OM", "BH"] as const;

/** Prisma `Currency`. */
export const CURRENCY_VALUES = ["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"] as const;

/** Prisma `Industry` — how a company classifies itself at registration. */
export const INDUSTRY_VALUES = [
  "INDUSTRIAL_SUPPLIES",
  "ELECTRONICS",
  "OFFICE_SUPPLIES",
  "SAFETY_PPE",
  "FOOD_HOSPITALITY",
  "BUILDING_MATERIALS",
  "HEALTHCARE",
  "RETAIL",
  "MANUFACTURING",
  "TECHNOLOGY",
  "OTHER",
] as const;

/** Prisma `CompanySize`. */
export const COMPANY_SIZE_VALUES = ["MICRO", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"] as const;

/** Prisma `Language`. */
export const LANGUAGE_VALUES = ["AR", "EN"] as const;
export const SELLER_TIER_VALUES = ["STANDARD", "VERIFIED", "GOLD", "PLATINUM"] as const;

/**
 * Compile-time proof that every list above is exactly its Prisma enum — not a
 * superset (accepts values the column rejects) and not a subset (hides values
 * the business supports). A mismatch fails the build on the offending line.
 */
export type EnumListsMatchPrisma = [
  AssertTrue<Exact<(typeof COUNTRY_VALUES)[number], Country>>,
  AssertTrue<Exact<(typeof CURRENCY_VALUES)[number], Currency>>,
  AssertTrue<Exact<(typeof INDUSTRY_VALUES)[number], Industry>>,
  AssertTrue<Exact<(typeof COMPANY_SIZE_VALUES)[number], CompanySize>>,
  AssertTrue<Exact<(typeof LANGUAGE_VALUES)[number], Language>>,
  AssertTrue<Exact<(typeof SELLER_TIER_VALUES)[number], SellerTier>>,
];

/**
 * An HTML form submits an untouched optional input as "", and `.optional()`
 * does not treat "" as absent: the empty string reaches the inner rules and
 * fails them (the phone regex, `nameAr`'s min length), or — worse — is written
 * into a nullable UNIQUE column such as Company.vatNumber, where the second
 * blank submission collides with the first. Blank means "not provided", so
 * normalise it to undefined before validating.
 */
function optionalText<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());
}

// ─── Auth ────────────────────────────────────────────────────────────────────

// Every password field is capped at 128 characters: bcrypt hashes only the
// first 72 bytes, so anything longer silently stops mattering, and hashing
// cost scales with input length, so an unbounded field is a CPU vector.
export const LoginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(128, { message: "Password must be at most 128 characters" }),
});

export const RegisterConsumerSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: optionalText(z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter the phone in international format, e.g. +9715xxxxxxx")),
  password: z
    .string()
    .min(8)
    .max(128, { message: "Password must be at most 128 characters" })
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  language: z.enum(LANGUAGE_VALUES).default("AR"),
});

/**
 * Joining a company that is ALREADY registered.
 *
 * The counterpart to RegisterBusinessSchema, and the answer to what used to be
 * a dead end: a second person at a customer typed their employer's commercial
 * registration number, was told the CR was taken, and had nowhere to go.
 *
 * The company is identified by CR rather than by name or by a company id. A CR
 * number is a public registry identifier the applicant can read off their own
 * payslip or their colleague's business card; a company id is an internal
 * string nobody outside this system has ever seen, and a name is ambiguous
 * across the six markets this platform sells in.
 *
 * Deliberately NO company fields. Everything about the company already exists
 * and belongs to the people already inside it; an applicant who could send a
 * new trade name or a new industry along with their application would be
 * editing a record they have not yet been admitted to.
 *
 * The password rules are RegisterConsumerSchema's own rather than a copy, for
 * the reason every other flow reuses them: a door with a weaker rule is the way
 * around the rule.
 */
export const RegisterJoinSchema = z.object({
  crNumber: z.string().min(5).max(30),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: optionalText(z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter the phone in international format, e.g. +9715xxxxxxx")),
  password: RegisterConsumerSchema.shape.password,
  /**
   * What the applicant says they do. ADVISORY: the approving admin sets the
   * role that is actually written to CompanyMember. COMPANY_ADMIN is absent on
   * purpose and must stay absent — nobody applies their way into administering
   * a company they are not yet a member of.
   */
  requestedRole: z.enum(["COMPANY_BUYER", "COMPANY_APPROVER"]).default("COMPANY_BUYER"),
  department: optionalText(z.string().max(60)),
  language: z.enum(LANGUAGE_VALUES).default("AR"),
});

export const RegisterBusinessSchema = z.object({
  // Company info
  companyNameEn: z.string().min(2).max(100),
  companyNameAr: optionalText(z.string().min(2).max(100)),
  crNumber: z.string().min(5).max(30),
  vatNumber: optionalText(z.string().max(30)),
  // Company.industry / .size / .country are Prisma enum columns: these lists are
  // the enums themselves, not a parallel copy of them.
  industry: z.enum(INDUSTRY_VALUES),
  companySize: z.enum(COMPANY_SIZE_VALUES),
  country: z.enum(COUNTRY_VALUES),
  city: z.string().min(2).max(50),
  // Admin user info
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: optionalText(z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter the phone in international format, e.g. +9715xxxxxxx")),
  // Messages are spelled out because the registration form shows them verbatim;
  // Zod's default for a bare .regex() is "Invalid", which tells nobody anything.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, { message: "Password must be at most 128 characters" })
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  language: z.enum(LANGUAGE_VALUES).default("AR"),
});

/**
 * Seller self-registration: one owner user plus one SellerProfile, created in
 * PENDING_REVIEW. Field names match SellerProfile / User columns 1:1 so the
 * route can spread them; the enum lists are the Prisma enums themselves.
 */
export const RegisterSellerSchema = z.object({
  // Business
  businessNameEn: z.string().min(2).max(100),
  businessNameAr: optionalText(z.string().min(2).max(100)),
  crNumber: z.string().min(5).max(30),
  vatNumber: optionalText(z.string().max(30)),
  type: z.enum(["MANUFACTURER", "DISTRIBUTOR", "IMPORTER", "RETAILER"]),
  country: z.enum(COUNTRY_VALUES),
  city: z.string().min(2).max(50),
  description: optionalText(z.string().max(1000)),
  // Owner user
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: optionalText(z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter the phone in international format, e.g. +9715xxxxxxx")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, { message: "Password must be at most 128 characters" })
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  language: z.enum(LANGUAGE_VALUES).default("AR"),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the seller agreement" }) }),
});

export type RegisterSellerInput = z.infer<typeof RegisterSellerSchema>;

/**
 * An administrator opening a seller account on the platform's own initiative.
 *
 * Deliberately NOT `RegisterSellerSchema.omit({ acceptTerms: true })`: the two
 * forms are filled by different people for different reasons. There is no
 * seller agreement to tick here — the administrator is not the seller and
 * cannot accept terms on their behalf — and there are three commercial fields a
 * self-registering applicant must never be able to set for themselves.
 *
 * `status` is the review decision baked into the creation: PENDING_REVIEW puts
 * the new organisation in the same queue a self-registration lands in, ACTIVE
 * opens it for trading immediately. The service refuses ACTIVE for anyone below
 * SUPER_ADMIN — this schema only says the value is well formed.
 */
export const CreateSellerByAdminSchema = z.object({
  businessNameEn: z.string().min(2).max(100),
  businessNameAr: optionalText(z.string().min(2).max(100)),
  crNumber: z.string().min(5).max(30),
  vatNumber: optionalText(z.string().max(30)),
  type: z.enum(["MANUFACTURER", "DISTRIBUTOR", "IMPORTER", "RETAILER"]),
  country: z.enum(COUNTRY_VALUES),
  city: z.string().min(2).max(50),
  description: optionalText(z.string().max(1000)),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  phone: optionalText(z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter the phone in international format, e.g. +9715xxxxxxx")),
  // The same rule registration enforces. An account an administrator opens must
  // not be reachable with a weaker password than one a seller opens themselves.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, { message: "Password must be at most 128 characters" })
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  language: z.enum(LANGUAGE_VALUES).default("EN"),
  status: z.enum(["PENDING_REVIEW", "ACTIVE"]).default("PENDING_REVIEW"),
  tier: z.enum(SELLER_TIER_VALUES).default("STANDARD"),
  // Percent of order value. Decimal(5,2) in the schema, so two places and a
  // ceiling of 100 — a rate above that would bill a seller more than the sale.
  commissionRate: z.coerce
    .number()
    .min(0, "Commission cannot be negative")
    .max(100, "Commission cannot exceed 100%")
    .multipleOf(0.01, "Commission is recorded to two decimal places")
    .default(5),
});

export type CreateSellerByAdminInput = z.infer<typeof CreateSellerByAdminSchema>;

// ─── Product ─────────────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  sku: z.string().min(3).max(50),
  nameEn: z.string().min(2).max(200),
  nameAr: z.string().min(2).max(200),
  descriptionEn: z.string().max(5000).optional(),
  descriptionAr: z.string().max(5000).optional(),
  categoryId: z.string().cuid(),
  brand: z.string().max(100).optional(),
  origin: z.string().length(2).optional(),
  weight: z.number().positive().optional(),
  isB2CEnabled: z.boolean().default(false),
  isB2BEnabled: z.boolean().default(true),
  tags: z.array(z.string()).max(20).default([]),
  pricingTiers: z.array(
    z.object({
      minQty: z.number().int().positive(),
      maxQty: z.number().int().positive().optional(),
      priceAED: z.number().positive(),
      priceSAR: z.number().positive().optional(),
      type: z.enum(["B2B", "B2C"]),
    }),
  ).min(1),
  inventoryQty: z.number().int().nonnegative().default(0),
  reorderPoint: z.number().int().nonnegative().default(10),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

// ─── Order ────────────────────────────────────���──────────────────────────────

/*
 * There is deliberately no shared CreateOrderSchema or CreatePOSchema here.
 *
 * Both once lived in this file and neither was ever imported: the order route
 * (apps/customer/src/app/api/orders/route.ts) and the purchase-order route
 * (apps/customer/src/app/api/b2b/purchase-orders/route.ts) each parse with
 * their own schema, and those are the ones a request actually meets. The
 * copies here had drifted into a different and more dangerous contract — a
 * client-supplied `companyId` on the PO, and `currency` defaulting to "AED" so
 * an omitted field silently priced an order in a currency the buyer never
 * chose. A shared name that looks canonical and is not is worse than no shared
 * name, so the checkout contract stays where it is enforced. If these ever do
 * need sharing, move the route schemas here whole rather than re-deriving them.
 */

// ─── Seller Onboarding ────────────────────��──────────────────────────────────

export const SellerOnboardingSchema = z.object({
  businessNameEn: z.string().min(2).max(100),
  businessNameAr: z.string().min(2).max(100).optional(),
  crNumber: z.string().min(5).max(30),
  vatNumber: z.string().max(30).optional(),
  type: z.enum(["MANUFACTURER", "DISTRIBUTOR", "IMPORTER", "RETAILER"]),
  country: z.enum(COUNTRY_VALUES),
  city: z.string().min(2).max(50),
  description: z.string().max(1000).optional(),
  descriptionAr: z.string().max(1000).optional(),
  bankIban: z.string().min(15).max(34).optional(),
  bankName: z.string().max(100).optional(),
  bankAccountName: z.string().max(100).optional(),
});

// ─── Address ─────────────────────────────────────────────────────────────────

export const AddressSchema = z.object({
  label: z.string().min(1).max(50),
  line1: z.string().min(5).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  country: z.enum(COUNTRY_VALUES),
  postalCode: z.string().max(20).optional(),
  isDefault: z.boolean().default(false),
});


export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterConsumerInput = z.infer<typeof RegisterConsumerSchema>;
export type RegisterBusinessInput = z.infer<typeof RegisterBusinessSchema>;
export type RegisterJoinInput = z.infer<typeof RegisterJoinSchema>;
export type SellerOnboardingInput = z.infer<typeof SellerOnboardingSchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
