/**
 * Enum → word, for every status vocabulary this console renders.
 *
 * The enum VALUE is the identifier and never changes: it is what the platform
 * stores, what a query filters on and what a URL carries. What changes is the
 * word a reviewer reads, and `PENDING REVIEW` in Latin capitals is not a word an
 * Arabic-reading operator reads — it is the enum leaking through the surface.
 *
 * So the value stays the key and the label comes from the adminReview message
 * tree. A value the tree does not carry falls back to the humanised enum rather
 * than rendering a missing-key path: a status the console cannot name must still
 * be shown truthfully, because it is exactly the case where a decision is being
 * refused against a state nobody anticipated.
 */

/** next-intl's translator, loosely typed: this module never knows the namespace. */
export type Translator = (key: string, values?: Record<string, string | number>) => string;

/** Every value of ProductStatus, SellerStatus and DocumentStatus, unioned. */
const STATUS_VALUES = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "INACTIVE",
  "SUPPRESSED",
  "SUSPENDED",
  "REJECTED",
  "APPROVED",
  "EXPIRED",
]);

const DOCUMENT_TYPES = new Set([
  "COMMERCIAL_REGISTRATION",
  "TRADE_LICENSE",
  "VAT_CERTIFICATE",
  "SASO_CERTIFICATE",
  "SFDA_APPROVAL",
  "HALAL_CERTIFICATE",
  "ESMA_CERTIFICATE",
  "ISO_CERTIFICATE",
  "OTHER",
]);

const SELLER_TYPES = new Set(["MANUFACTURER", "DISTRIBUTOR", "IMPORTER", "RETAILER"]);

const TIERS = new Set(["STANDARD", "VERIFIED", "GOLD", "PLATINUM"]);

/** The humanised enum, used only where the message tree has no word for it. */
function humanise(value: string): string {
  return value.replace(/_/g, " ");
}

/**
 * `group` is "status" for a pill or a column and "statusInline" for a status set
 * inside a sentence — English wants the lower-case form there and Arabic wants
 * the same word either way, which is precisely why it is two message keys and
 * not a .toLowerCase() call.
 */
export function statusLabel(t: Translator, status: string, group: "status" | "statusInline" = "status"): string {
  return STATUS_VALUES.has(status) ? t(`${group}.${status}`) : humanise(status);
}

export function documentTypeLabel(t: Translator, type: string): string {
  return DOCUMENT_TYPES.has(type) ? t(`docType.${type}`) : humanise(type);
}

export function sellerTypeLabel(t: Translator, type: string): string {
  return SELLER_TYPES.has(type) ? t(`sellerType.${type}`) : humanise(type);
}

export function tierLabel(t: Translator, tier: string): string {
  return TIERS.has(tier) ? t(`tier.${tier}`) : humanise(tier);
}
