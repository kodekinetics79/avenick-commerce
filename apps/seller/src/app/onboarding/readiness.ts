/**
 * Store-readiness tests shared by /onboarding and the dashboard's checklist.
 *
 * The two surfaces used to disagree. The checklist hardcoded the business
 * profile as complete (`done: true`) and treated any non-null `bankDetails` as
 * payout-ready, while /onboarding derived both from the actual columns — so a
 * seller with an empty profile was told on one page that it was finished and on
 * the next that it was not. A completion claim the rows do not support is a
 * fabrication like any other, so both pages now read the same functions.
 */

/** The nullable profile columns a storefront actually needs, in display order. */
export interface ProfileFields {
  businessNameAr: string | null;
  description: string | null;
  logo: string | null;
}

/** The nullable columns, in display order. Code identifiers, never translated. */
export const PROFILE_FIELD_KEYS = ["businessNameAr", "description", "logo"] as const;
export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number];

/**
 * Fields the schema already guarantees (business name, CR number, country, city)
 * cannot be absent, so the only honest profile signal is the nullable columns a
 * storefront actually needs. The missing ones are named so the basis is visible
 * rather than reduced to a percentage.
 *
 * This returns KEYS rather than prose so each caller can render them in the
 * reader's language; /onboarding looks each key up under
 * sellerRelations.onboarding.profileFields.*.
 */
export function missingProfileFieldKeys(seller: ProfileFields): ProfileFieldKey[] {
  return [
    seller.businessNameAr?.trim() ? null : ("businessNameAr" as const),
    seller.description?.trim() ? null : ("description" as const),
    seller.logo ? null : ("logo" as const),
  ].filter((field): field is ProfileFieldKey => field !== null);
}

/**
 * The same test, rendered as English prose.
 *
 * Kept because the dashboard's checklist (src/components/onboarding-checklist.tsx)
 * still reads it; it is a thin wrapper over missingProfileFieldKeys so the two
 * surfaces cannot diverge about which fields are missing, which is the whole
 * reason this module exists. New callers should use the key form above.
 */
const PROFILE_FIELD_EN: Record<ProfileFieldKey, string> = {
  businessNameAr: "Arabic business name",
  description: "Business description",
  logo: "Store logo",
};

export function missingProfileFields(seller: ProfileFields): string[] {
  return missingProfileFieldKeys(seller).map((key) => PROFILE_FIELD_EN[key]);
}

/**
 * Prisma surfaces both SQL NULL and JSON null as `null`, and an empty object is
 * not usable settlement information either — so require at least one key before
 * claiming payout details exist.
 */
export function hasPayoutDetails(bankDetails: unknown): boolean {
  return (
    bankDetails !== null &&
    typeof bankDetails === "object" &&
    !Array.isArray(bankDetails) &&
    Object.keys(bankDetails as Record<string, unknown>).length > 0
  );
}
