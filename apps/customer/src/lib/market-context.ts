// Imported by "use client" forms and stores as well as server code: keep this
// module free of node-only imports. The currency list comes from the client-safe
// schemas subpath, which asserts it against the Prisma enum at compile time.
import { CURRENCY_VALUES } from "@avenick/types/schemas";

export const SUPPORTED_COUNTRIES = [
  ["AE", "United Arab Emirates"],
  ["SA", "Saudi Arabia"],
  ["QA", "Qatar"],
  ["KW", "Kuwait"],
  ["BH", "Bahrain"],
  ["OM", "Oman"],
] as const;

export function emptyMarketAddress(label = "") {
  return { label, line1: "", city: "", country: "" };
}

/** A currency the storefront can price and format in — the Prisma `Currency` enum. */
export type Currency = (typeof CURRENCY_VALUES)[number];

export function isStorefrontCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCY_VALUES as readonly string[]).includes(value);
}

/**
 * The currency a visitor is priced in before they (or a company account)
 * choose one. Every storefront default reads from here — the product page,
 * the cart store, the list card and the selection resolver — so changing the
 * launch market is one env var, not a hunt for scattered literals.
 *
 * NEXT_PUBLIC_DEFAULT_CURRENCY is inlined into the client bundle at build
 * time, so it must be read by its full name. A value that is not a storefront
 * currency is treated as unset rather than passed on to formatters that would
 * throw on it.
 */
export function defaultStorefrontCurrency(): Currency {
  const configured = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY?.trim().toUpperCase();
  if (isStorefrontCurrency(configured)) return configured;
  // AED is the platform's launch market. This is the one place that literal
  // is allowed to stand in for a configured value.
  return "AED";
}
