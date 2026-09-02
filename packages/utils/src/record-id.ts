/**
 * Record ids in this schema are cuids (`@default(cuid())` throughout
 * schema.prisma). Kept deliberately loose (a cuid is 25 chars) so a future id
 * scheme does not fail closed on a legitimate record, while still excluding
 * path separators and traversal sequences.
 *
 * Pinning the shape matters wherever an id is interpolated into a backend
 * path, because `fetchSellerBackend` / `fetchB2BJson` forward the caller's
 * session cookie with the request. An id carrying `../` re-aims that
 * credentialed request at a different backend route — harmless while every
 * route is caller-scoped, but a standing primitive the day an internal-only or
 * header-trusting route is added.
 *
 * zod's own `.cuid()` is not enough: its regex is /^c[^\s-]{8,}$/i, which
 * rejects only whitespace and hyphens and would happily pass
 * `c/../../account/export`. Match the real character class instead.
 *
 * Use this for every dynamic-route and search-param id guard rather than a
 * local copy, so the accepted shape can only ever change in one place.
 */
export const RECORD_ID = /^c[a-z0-9]{7,}$/;

/** Narrowing guard for ids arriving as `unknown` (search params, JSON bodies). */
export function isRecordId(value: unknown): value is string {
  return typeof value === "string" && RECORD_ID.test(value);
}
