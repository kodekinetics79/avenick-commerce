import type { ErrorCode, PageMeta } from "@avenick/contracts/envelope";

import type { FieldErrors } from "./errors";

/**
 * The two envelope bodies, built in one place.
 *
 * Nothing on /api/v1 constructs a response body itself. The existing surface
 * answers in three different shapes because every route was free to invent
 * one; here a route returns a payload and the wrapper wraps it, so the shape
 * cannot drift route by route.
 */

export interface SuccessEnvelope<T> {
  data: T;
  meta?: PageMeta;
}

export function successBody<T>(data: T, meta?: PageMeta): SuccessEnvelope<T> {
  // `meta` is omitted rather than set to undefined: the contract's wrapper is
  // .strict(), and JSON.stringify drops undefined, but an explicit key keeps
  // the two representations honest with each other.
  return meta === undefined ? { data } : { data, meta };
}

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    fieldErrors?: FieldErrors;
  };
}

export function errorBody(
  code: ErrorCode,
  message: string,
  requestId: string,
  fieldErrors?: FieldErrors,
): ErrorEnvelope {
  const error: ErrorEnvelope["error"] = { code, message, requestId };
  // An empty map would be a claim that something is wrong with no field named,
  // which the contract deliberately does not model. Omit it entirely instead.
  if (fieldErrors && Object.keys(fieldErrors).length > 0) error.fieldErrors = fieldErrors;
  return { error };
}

/**
 * A request id that always satisfies the contract (1..128 printable chars).
 *
 * An upstream `x-request-id` is reused where there is one, so the id is stable
 * across the Vercel→Render hop the same way `guarded()` keeps it stable. But
 * the header is client-supplied: an empty, oversized or control-character
 * value would put a string in the envelope that the Dart client refuses to
 * parse, turning a 404 into an unparseable response. Anything that does not
 * fit is replaced rather than trimmed, because a truncated id correlates to
 * nothing.
 */
export function normalizeRequestId(upstream: string | null | undefined): string {
  const candidate = upstream?.trim();
  if (candidate && candidate.length <= 128 && /^[\x20-\x7E]+$/.test(candidate)) return candidate;
  return globalThis.crypto.randomUUID();
}
