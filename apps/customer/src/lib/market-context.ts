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
