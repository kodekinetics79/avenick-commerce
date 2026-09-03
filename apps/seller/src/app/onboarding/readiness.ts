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

/**
 * Fields the schema already guarantees (business name, CR number, country, city)
 * cannot be absent, so the only honest profile signal is the nullable columns a
 * storefront actually needs. The missing ones are named so the basis is visible
 * rather than reduced to a percentage.
 */
export function missingProfileFields(seller: ProfileFields): string[] {
  return [
    seller.businessNameAr?.trim() ? null : "Arabic business name",
    seller.description?.trim() ? null : "Business description",
    seller.logo ? null : "Store logo",
  ].filter((field): field is string => field !== null);
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
