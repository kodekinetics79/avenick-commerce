import { NextResponse, type NextRequest } from "next/server";
import { type Session } from "next-auth";
import { db, UserRole } from "@avenick/database";
import { ZodError } from "zod";
import { instrumentRequest, type Logger } from "@avenick/observability";
import { bearerTokenFrom, sessionFromAccessToken, verifyAccessToken } from "./access-token";
import { isSessionRevoked, sessionIssuedAtSeconds } from "./session-revocation";

/**
 * Standard API layer shared by all three portals.
 *
 * Every route handler is wrapped with `guarded()`, which enforces the
 * platform-wide contract:
 *   - success:  { success: true, data, meta? }
 *   - failure:  { success: false, error, requestId? }
 * plus authentication, role checks, Zod validation mapping, business-error
 * mapping (ApiError), and full-request observability: one structured access log
 * and RED metrics (labelled by the low-cardinality route template) per request,
 * all correlated by the same requestId and the active OpenTelemetry trace_id.
 */

/** Service name for telemetry; each app sets OTEL_SERVICE_NAME at deploy. */
const SERVICE = process.env.OTEL_SERVICE_NAME ?? "avenick";

/**
 * Collapse a concrete path into a low-cardinality route template by replacing
 * each dynamic-segment value with its `[param]` placeholder, e.g.
 *   /api/orders/ord_123  →  /api/orders/[id]
 * so metrics don't explode into one time-series per id.
 */
function routeTemplate(pathname: string, params: Record<string, string>): string {
  let template = pathname;
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    template = template.split(`/${value}`).join(`/[${key}]`);
  }
  return template;
}

/** Throw inside a handler to return a controlled non-500 error response. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonOk<T>(data: T, init?: { status?: number; meta?: unknown }): NextResponse {
  return NextResponse.json(
    { success: true, data, ...(init?.meta !== undefined ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200 },
  );
}

export function jsonErr(error: string, status: number, requestId?: string): NextResponse {
  return NextResponse.json(
    { success: false, error, ...(requestId ? { requestId } : {}) },
    { status },
  );
}

export interface GuardedContext {
  req: NextRequest;
  session: Session;
  userId: string;
  role: UserRole;
  requestId: string;
  /** Route params from dynamic segments, already awaited. */
  params: Record<string, string>;
  /**
   * Which credential named the caller. "bearer" only ever appears on a route
   * that opted in with `allowBearer`; `session.user.email` is null on that
   * path (see `sessionFromAccessToken`).
   */
  credential: "cookie" | "bearer";
  /**
   * Request-scoped structured logger. Already carries this request's requestId
   * and (at emit time) the active trace_id, so anything logged through it is
   * correlated to the trace and the client-facing error envelope for free.
   */
  log: Logger;
}

type RouteHandler = (ctx: GuardedContext) => Promise<NextResponse>;

interface GuardOptions {
  /** Session provider from the app's auth instance. */
  auth: () => Promise<Session | null>;
  /** Allowed roles. Omit to allow any authenticated user. */
  roles?: UserRole[];
  /**
   * Accept an `Authorization: Bearer` access token as well as the portal
   * cookie. OFF unless a route says otherwise, and deliberately NOT inferred
   * from the header being present.
   *
   * The difference matters. If the mere presence of a bearer header switched
   * this on, every existing cookie-only route in all three portals would start
   * accepting a mobile access token the day the first one was minted — an
   * account-management route, a seller payout route, an admin action — none of
   * which was written with a phone-held credential in mind. Widening an
   * authentication surface is a decision each route makes explicitly.
   */
  allowBearer?: boolean;
}

type NextRouteArgs = { params?: Promise<Record<string, string>> | Record<string, string> };

/**
 * Wrap a route handler with authentication, role enforcement, and
 * standardized error handling. Usage:
 *
 *   export const GET = guarded({ auth, roles: ADMIN_ROLES }, async ({ req }) => {
 *     return jsonOk(await listThings());
 *   });
 */
export function guarded(options: GuardOptions, handler: RouteHandler) {
  return async (req: NextRequest, routeArgs?: NextRouteArgs): Promise<NextResponse> => {
    // Web Crypto: available in both the Node and Edge runtimes. Reuse an
    // upstream x-request-id (e.g. from the Vercel→Render hop) so the id is
    // stable across the whole request, not minted twice.
    const requestId = req.headers.get("x-request-id") ?? globalThis.crypto.randomUUID();

    // Resolve dynamic-segment params up front so the metrics route template is
    // available for the entire request's telemetry, including early auth exits.
    const rawParams = routeArgs?.params;
    const params =
      rawParams && typeof (rawParams as Promise<unknown>).then === "function"
        ? await (rawParams as Promise<Record<string, string>>)
        : ((rawParams as Record<string, string>) ?? {});

    const pathname = req.nextUrl.pathname;
    const { ctx: obs, finish } = instrumentRequest({
      service: SERVICE,
      requestId,
      method: req.method,
      route: routeTemplate(pathname, params),
      path: pathname,
    });

    let status = 500;
    try {
      /**
       * ONE AUTH SEAM, TWO CREDENTIALS.
       *
       * A bearer token is resolved into the SAME `Session` shape the cookie
       * produces and then dropped into the same variable, so everything after
       * this block — the live Postgres read of role/status/deletedAt, the role
       * check, the revocation comparison — runs once and cannot drift between
       * the web and the mobile path. A second auth branch further down would be
       * a second place for one of those checks to be forgotten.
       *
       * The cookie is tried first: a browser that also sent an Authorization
       * header (an extension, a misconfigured proxy) keeps the credential its
       * user actually established.
       */
      let credential: "cookie" | "bearer" = "cookie";
      let session = await options.auth();
      if (!session?.user?.id && options.allowBearer) {
        const presented = bearerTokenFrom(req.headers);
        if (presented) {
          const verified = verifyAccessToken(presented);
          if (verified.ok) {
            session = sessionFromAccessToken(verified.claims);
            credential = "bearer";
          } else if (verified.reason === "no-secret") {
            // Nothing could have been minted without a key, so this is a
            // deployment that lost its secret — loud, not "please sign in".
            obs.log.error("bearer auth refused: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, {
              path: pathname,
            });
          }
        }
      }
      if (!session?.user?.id) {
        status = 401;
        return jsonErr("Authentication required", 401, requestId);
      }
      const currentUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, status: true, deletedAt: true, sessionsValidAfter: true },
      });
      const role = currentUser?.role;
      if (!currentUser || currentUser.status !== "ACTIVE" || currentUser.deletedAt || !role || (options.roles && !options.roles.includes(role))) {
        status = 403;
        return jsonErr("Insufficient permissions", 403, requestId);
      }

      /**
       * THE SESSION-LEVEL REVOCATION CHECK.
       *
       * The read above already revokes an ACCOUNT — suspended, deleted,
       * demoted. It could not revoke a SESSION: web sessions are NextAuth JWTs
       * with a thirty-day maxAge and no server-side row, so a cookie stolen
       * before a password reset kept working for the rest of that month. That
       * is what `User.sessionsValidAfter` fixes, and this is the comparison —
       * one extra column on a query that was already being made, not a second
       * round trip.
       *
       * 401 rather than 403 on purpose. The account is fine; this particular
       * credential is not, and the client's correct response is to sign in
       * again. 403 would tell an app to stop trying.
       */
      if (isSessionRevoked(sessionIssuedAtSeconds(session), currentUser.sessionsValidAfter)) {
        status = 401;
        obs.log.info("session refused: issued before the account's revocation cutoff", {
          userId: session.user.id,
          // Named `via`, not `credential`: the observability layer redacts any
          // field whose name looks like a secret, and "cookie"/"bearer" is the
          // one detail this line exists to record.
          via: credential,
          path: pathname,
        });
        return jsonErr("Your session has ended. Please sign in again.", 401, requestId);
      }

      const res = await handler({
        req,
        session,
        userId: session.user.id,
        role,
        requestId,
        params,
        credential,
        log: obs.log,
      });
      res.headers.set("x-request-id", requestId);
      status = res.status;
      return res;
    } catch (e) {
      if (e instanceof ApiError) {
        status = e.status;
        return jsonErr(e.message, e.status, requestId);
      }
      if (e instanceof ZodError) {
        const first = e.issues[0];
        const path = first?.path.join(".");
        status = 400;
        return jsonErr(
          `Validation failed${path ? ` (${path})` : ""}: ${first?.message ?? "invalid input"}`,
          400,
          requestId,
        );
      }
      // Unexpected error: log with full detail (correlated by requestId +
      // trace_id) and never leak internals to the client. The access log line
      // and 5xx metric are emitted by finish() below.
      status = 500;
      obs.log.error("unhandled route error", e, { method: req.method, path: pathname });
      return jsonErr("Internal server error", 500, requestId);
    } finally {
      // One access log + RED metric per request, whatever the exit path.
      finish(status);
    }
  };
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

/** Parse and clamp pagination params from a URL. */
export function parsePagination(
  searchParams: URLSearchParams,
  opts?: { defaultLimit?: number; maxLimit?: number },
): Pagination {
  const defaultLimit = opts?.defaultLimit ?? 20;
  const maxLimit = opts?.maxLimit ?? 100;
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? String(defaultLimit), 10) || defaultLimit),
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(pagination: Pagination, total: number) {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
  };
}
