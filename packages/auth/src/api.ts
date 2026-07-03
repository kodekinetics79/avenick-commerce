import { NextResponse, type NextRequest } from "next/server";
import { type Session } from "next-auth";
import { UserRole } from "@avenick/database";
import { ZodError } from "zod";

/**
 * Standard API layer shared by all three portals.
 *
 * Every route handler is wrapped with `guarded()`, which enforces the
 * platform-wide contract:
 *   - success:  { success: true, data, meta? }
 *   - failure:  { success: false, error, requestId? }
 * plus authentication, role checks, Zod validation mapping, business-error
 * mapping (ApiError), and structured error logging with a request id.
 */

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
    // Web Crypto: available in both the Node and Edge runtimes.
    const requestId = req.headers.get("x-request-id") ?? globalThis.crypto.randomUUID();
    try {
      const session = await options.auth();
      if (!session?.user?.id) {
        return jsonErr("Authentication required", 401, requestId);
      }
      const role = (session.user as { role?: UserRole }).role;
      if (!role || (options.roles && !options.roles.includes(role))) {
        return jsonErr("Insufficient permissions", 403, requestId);
      }

      const rawParams = routeArgs?.params;
      const params =
        rawParams && typeof (rawParams as Promise<unknown>).then === "function"
          ? await (rawParams as Promise<Record<string, string>>)
          : ((rawParams as Record<string, string>) ?? {});

      const res = await handler({
        req,
        session,
        userId: session.user.id,
        role,
        requestId,
        params,
      });
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (e) {
      if (e instanceof ApiError) {
        return jsonErr(e.message, e.status, requestId);
      }
      if (e instanceof ZodError) {
        const first = e.issues[0];
        const path = first?.path.join(".");
        return jsonErr(
          `Validation failed${path ? ` (${path})` : ""}: ${first?.message ?? "invalid input"}`,
          400,
          requestId,
        );
      }
      // Never leak internals to the client; log them with the request id.
      console.error(
        JSON.stringify({
          level: "error",
          requestId,
          method: req.method,
          path: req.nextUrl.pathname,
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
          at: new Date().toISOString(),
        }),
      );
      return jsonErr("Internal server error", 500, requestId);
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
