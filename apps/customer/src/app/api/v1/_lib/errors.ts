import { ZodError, type ZodIssue } from "zod";

import { ERROR_CODE_VALUES, type ErrorCode } from "@avenick/contracts/envelope";

/**
 * The one place a contract error code becomes an HTTP status.
 *
 * `packages/contracts/src/openapi/document.ts` publishes this same pairing to
 * the Flutter client. Two tables that must agree is one table too many, so the
 * mapping is asserted against `ERROR_CODE_VALUES` here (every code has a
 * status) and against the generated document by the tests.
 */
export const ERROR_STATUS = {
  validation_failed: 400,
  unauthenticated: 401,
  payment_required: 402,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
  upstream_unavailable: 503,
} as const satisfies Record<ErrorCode, number>;

/** Every code the envelope declares, for the exhaustiveness test. */
export const ALL_ERROR_CODES: readonly ErrorCode[] = ERROR_CODE_VALUES;

export type FieldErrors = Record<string, string[]>;

/**
 * The only error a v1 route should throw deliberately.
 *
 * Anything else that escapes a handler is, by definition, unexpected: the
 * wrapper logs it with its stack and answers `internal` with nothing but the
 * requestId, because a message assembled from an unexpected fault is how an
 * SQL fragment or a connection string reaches a phone.
 */
export class V1Error extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: FieldErrors;
  /** Seconds to put in `Retry-After`; only meaningful with `rate_limited`. */
  readonly retryAfterSeconds?: number;
  /** Detail for the log line, never for the response body. */
  readonly detail?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { fieldErrors?: FieldErrors; retryAfterSeconds?: number; detail?: unknown },
  ) {
    super(message);
    this.name = "V1Error";
    this.code = code;
    this.status = ERROR_STATUS[code];
    if (options?.fieldErrors) this.fieldErrors = options.fieldErrors;
    if (options?.retryAfterSeconds !== undefined) this.retryAfterSeconds = options.retryAfterSeconds;
    if (options?.detail !== undefined) this.detail = options.detail;
  }
}

export const unauthenticated = (message = "Sign in to continue.") =>
  new V1Error("unauthenticated", message);

export const forbidden = (message = "This account is not permitted to do that.") =>
  new V1Error("forbidden", message);

export const notFound = (message = "Not found.") => new V1Error("not_found", message);

export const conflict = (message: string) => new V1Error("conflict", message);

export const validationFailed = (message: string, fieldErrors?: FieldErrors) =>
  new V1Error("validation_failed", message, { fieldErrors });

export const rateLimited = (retryAfterSeconds: number, message = "Too many requests. Try again shortly.") =>
  new V1Error("rate_limited", message, { retryAfterSeconds });

export const paymentRequired = (message: string) => new V1Error("payment_required", message);

export const upstreamUnavailable = (message: string, detail?: unknown) =>
  new V1Error("upstream_unavailable", message, { detail });

/**
 * Group Zod issues by their dotted path.
 *
 * The path is the request path the client sent, so an issue on the third
 * line's quantity reads `items.2.quantity` — which is what lets the app put
 * the message next to the field instead of in a banner. An issue at the root
 * (a body that is not an object at all) has an empty path; it is keyed as
 * `body` rather than `""` so the map is always addressable.
 */
export function fieldErrorsFromZod(error: ZodError): FieldErrors {
  const grouped: FieldErrors = {};
  for (const issue of error.issues as ZodIssue[]) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "body";
    (grouped[key] ??= []).push(issue.message);
  }
  return grouped;
}

/** A Zod failure, as the single error envelope states it. */
export function fromZodError(error: ZodError, message = "The request is not valid."): V1Error {
  return validationFailed(message, fieldErrorsFromZod(error));
}

export function isZodError(value: unknown): value is ZodError {
  return value instanceof ZodError;
}
