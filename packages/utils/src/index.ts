/*
 * The barrel is deliberately LIGHT. s3, crypto, browser-upload-policy and
 * portal-config each have their own subpath export so that a "use client"
 * component importing `cn` does not drag a server-only module into the browser
 * bundle — and gcc-identifiers (a 550-line country table) and hijri (an Intl
 * wrapper) are on that list for the same reason. Import them as
 * "@avenick/utils/gcc-identifiers" and "@avenick/utils/hijri".
 */
export * from "./currency";
export * from "./date";
export * from "./arabic";
export * from "./cn";
export * from "./record-id";

/** Generate a unique reference code for bank transfers */
export function generateReference(prefix = "MNZ"): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${now}-${rand}`;
}

/** Truncate a string and add ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/** Convert a string to a URL slug */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
