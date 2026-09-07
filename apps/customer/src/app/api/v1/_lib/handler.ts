import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";

import type { PageMeta } from "@avenick/contracts/envelope";
import type { UserRole } from "@avenick/database";
import { instrumentRequest, type Logger } from "@avenick/observability";
// Narrow subpath on purpose. The @avenick/auth barrel re-exports the NextAuth
// instance factory, which drags Prisma and next-auth into whatever bundle
// imports it; /api/products already reaches for this subpath for the same
// reason. Importing the barrel here is a trap this repository has been bitten
// by before.
import { checkRateLimit, clientIpFrom, type RateLimitRule } from "@avenick/auth/rate-limit";

import { errorBody, normalizeRequestId, successBody } from "./envelope";
import { V1Error, fromZodError, isZodError } from "./errors";
import { resolvePrincipal, type Principal } from "./principal";

/**
 * THE v1 ROUTE WRAPPER.
 *
 * Every route on /api/v1 goes through this function, and that is the whole
 * point of it. The existing surface answers in three different shapes —
 * `{ success, error }`, `{ success, data }`, `{ success, ...result, products }`
 * — because each route was free to build its own body. A generated Dart client
 * cannot branch on that. Here a handler returns a payload and never a
 * Response, so there is exactly one place that can serialise a success and
 * exactly one that can serialise a failure, and an envelope cannot drift route
 * by route.
 *
 * What it owns:
 *
 *   · a requestId, reused from an upstream `x-request-id` where there is one,
 *     echoed in the response header AND inside every error body;
 *   · authentication, through a live Postgres read of the user (see
 *     principal.ts) — the revocation mechanism, not a cached claim;
 *   · request validation against a contracts schema, reported as
 *     `validation_failed` with per-field paths the app can put next to inputs;
 *   · rate limiting, answering 429 with `Retry-After`;
 *   · error mapping onto the contract's closed code set, with a catch-all that
 *     logs the fault and tells the client nothing but the requestId;
 *   · RESPONSE validation against the contracts schema. That is not belt and
 *     braces: `CheckoutQuoteSchema` enforces `vatAmount === goodsVatAmount +
 *     shippingVatAmount` at parse time, so a route that ever collapsed the two
 *     VAT components fails here instead of quietly under-declaring tax on a
 *     phone, which is the exact defect PR #21 fixed in the order path.
 */

const SERVICE = process.env.OTEL_SERVICE_NAME ?? "avenick-customer";

/** What a handler returns: the payload, plus page metadata when it is a page. */
export interface V1Result<TData> {
  data: TData;
  meta?: PageMeta;
}

type InferOrUndefined<S> = S extends ZodTypeAny ? z.infer<S> : undefined;

export interface V1Context<TBody = undefined, TQuery = undefined, TParams = undefined> {
  req: NextRequest;
  requestId: string;
  /** Null only when `auth` is "optional" or "none" and nobody is signed in. */
  principal: Principal | null;
  body: TBody;
  query: TQuery;
  params: TParams;
  /** Request-scoped logger, already carrying this request's requestId. */
  log: Logger;
  /** Resolved through the trusted-proxy rules in @avenick/auth/rate-limit. */
  clientIp: string;
}

export interface V1RouteSpec<
  TResponse extends ZodTypeAny,
  TBody extends ZodTypeAny | undefined = undefined,
  TQuery extends ZodTypeAny | undefined = undefined,
  TParams extends ZodTypeAny | undefined = undefined,
> {
  /** Low-cardinality route template for metrics, e.g. "/api/v1/orders/[id]". */
  route: string;
  /**
   * "required" (default) refuses a guest with 401. "optional" serves a guest
   * with `principal: null` — but still refuses a session whose account has
   * been revoked, because degrading a suspended account to a guest would
   * un-revoke it everywhere a guest is welcome.
   */
  auth?: "required" | "optional" | "none";
  /** Allowed roles for a signed-in caller. Omit to allow any active account. */
  roles?: readonly UserRole[];
  body?: TBody;
  query?: TQuery;
  params?: TParams;
  /** The contracts schema for the payload INSIDE `data`. */
  response: TResponse;
  rateLimit?: {
    rule: RateLimitRule;
    /** Defaults to the caller's user id, falling back to the client IP. */
    identify?: (ctx: {
      principal: Principal | null;
      clientIp: string;
      req: NextRequest;
    }) => string;
  };
  handle: (
    ctx: V1Context<InferOrUndefined<TBody>, InferOrUndefined<TQuery>, InferOrUndefined<TParams>>,
  ) => Promise<V1Result<z.infer<TResponse>>>;
}

type NextRouteArgs = { params?: Promise<Record<string, string>> | Record<string, string> };

/**
 * Query strings carry repeats (`?tag=a&tag=b`). Collapsing them to the last
 * value silently drops a filter the caller asked for, so a repeated key
 * becomes an array and the schema decides whether that is allowed.
 */
function searchParamsToObject(params: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    out[key] = values.length > 1 ? values : values[0]!;
  }
  return out;
}

async function readJsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new V1Error("validation_failed", "The request body is not valid JSON.", {
      fieldErrors: { body: ["Send a JSON object with Content-Type: application/json."] },
    });
  }
}

function parseWith<S extends ZodTypeAny>(schema: S, value: unknown, what: string): z.infer<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw fromZodError(result.error, `The request ${what} is not valid.`);
}

export type V1RouteHandler = (req: NextRequest, routeArgs?: NextRouteArgs) => Promise<NextResponse>;

export function route<
  TResponse extends ZodTypeAny,
  TBody extends ZodTypeAny | undefined = undefined,
  TQuery extends ZodTypeAny | undefined = undefined,
  TParams extends ZodTypeAny | undefined = undefined,
>(spec: V1RouteSpec<TResponse, TBody, TQuery, TParams>): V1RouteHandler {
  return async (req: NextRequest, routeArgs?: NextRouteArgs): Promise<NextResponse> => {
    const requestId = normalizeRequestId(req.headers.get("x-request-id"));
    const { ctx: obs, finish } = instrumentRequest({
      service: SERVICE,
      requestId,
      method: req.method,
      route: spec.route,
      path: req.nextUrl?.pathname ?? spec.route,
    });

    let status = 500;
    try {
      const rawParams = routeArgs?.params;
      const resolvedParams =
        rawParams && typeof (rawParams as Promise<unknown>).then === "function"
          ? await (rawParams as Promise<Record<string, string>>)
          : ((rawParams as Record<string, string> | undefined) ?? {});

      const mode = spec.auth ?? "required";
      const principal = mode === "none" ? null : await resolvePrincipal();
      if (mode === "required" && !principal) {
        throw new V1Error("unauthenticated", "Sign in to continue.");
      }
      if (principal && spec.roles && !spec.roles.includes(principal.role)) {
        throw new V1Error("forbidden", "This account is not permitted to do that.");
      }

      const clientIp = clientIpFrom(req.headers);
      if (spec.rateLimit) {
        const identifier =
          spec.rateLimit.identify?.({ principal, clientIp, req })
          ?? principal?.userId
          ?? `ip:${clientIp}`;
        const verdict = await checkRateLimit(spec.rateLimit.rule, identifier);
        if (!verdict.ok) {
          throw new V1Error("rate_limited", "Too many requests. Try again shortly.", {
            // Never below one second: a Retry-After of 0 invites the client to
            // retry immediately, which is the loop the limit exists to break.
            retryAfterSeconds: Math.max(1, Math.ceil((verdict.resetAt - Date.now()) / 1000)),
          });
        }
      }

      const body = spec.body ? parseWith(spec.body, await readJsonBody(req), "body") : undefined;
      const query = spec.query
        ? parseWith(spec.query, searchParamsToObject(req.nextUrl.searchParams), "query")
        : undefined;
      const params = spec.params ? parseWith(spec.params, resolvedParams, "path") : undefined;

      const result = await spec.handle({
        req,
        requestId,
        principal,
        body: body as InferOrUndefined<TBody>,
        query: query as InferOrUndefined<TQuery>,
        params: params as InferOrUndefined<TParams>,
        log: obs.log,
        clientIp,
      });

      const checked = spec.response.safeParse(result.data);
      if (!checked.success) {
        // The route produced a body the published contract does not describe.
        // The client would fail to parse it, so answering 200 with it is worse
        // than failing here: the failure is logged with the offending paths and
        // the caller gets an internal error carrying only the requestId.
        obs.log.error("v1 response violates its contract", checked.error, {
          route: spec.route,
          issues: checked.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
        throw new V1Error("internal", "Something went wrong. Quote the request id.");
      }

      status = 200;
      const response = NextResponse.json(successBody(checked.data, result.meta), { status });
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      const mapped = toV1Error(error);
      status = mapped.status;
      if (status >= 500) {
        // Only the unexpected is logged with its cause. A 4xx is the endpoint
        // working: a stale cart, a missing product, a throttled client.
        obs.log.error("v1 route error", error, {
          route: spec.route,
          method: req.method,
          code: mapped.code,
        });
      }
      const response = NextResponse.json(
        errorBody(mapped.code, mapped.message, requestId, mapped.fieldErrors),
        { status },
      );
      response.headers.set("x-request-id", requestId);
      if (mapped.retryAfterSeconds !== undefined) {
        response.headers.set("Retry-After", String(mapped.retryAfterSeconds));
      }
      return response;
    } finally {
      finish(status);
    }
  };
}

/**
 * Everything that can escape a handler, reduced to the contract's closed set.
 *
 * The catch-all is deliberately total and deliberately mute: an unexpected
 * fault's message is assembled from whatever threw, and that is how a SQL
 * fragment, a file path or a connection string ends up on a phone screen.
 */
function toV1Error(error: unknown): V1Error {
  if (error instanceof V1Error) return error;
  if (isZodError(error) || error instanceof ZodError) return fromZodError(error as ZodError);
  return new V1Error("internal", "Something went wrong. Quote the request id.");
}
