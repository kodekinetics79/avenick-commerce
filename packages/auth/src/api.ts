import { NextResponse, type NextRequest } from "next/server";
import { type Session } from "next-auth";
import { UserRole } from "@avenick/database";
import { ZodError } from "zod";
import { instrumentRequest, type Logger } from "@avenick/observability";

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
      const session = await options.auth();
      if (!session?.user?.id) {
        status = 401;
        return jsonErr("Authentication required", 401, requestId);
      }
      const role = (session.user as { role?: UserRole }).role;
      if (!role || (options.roles && !options.roles.includes(role))) {
        status = 403;
        return jsonErr("Insufficient permissions", 403, requestId);
      }

      const res = await handler({
        req,
        session,
        userId: session.user.id,
        role,
        requestId,
        params,
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
