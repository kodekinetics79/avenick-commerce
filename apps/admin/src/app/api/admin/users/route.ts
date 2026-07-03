import { auth } from "@/lib/auth-instance";
import { guarded, jsonOk, parsePagination, paginationMeta, ADMIN_ROLES } from "@avenick/auth";
import { getAdminUsers, UserRole, UserStatus } from "@avenick/database";
import { z } from "zod";

const QuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().trim().max(200).optional(),
});

export const GET = guarded({ auth, roles: ADMIN_ROLES }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const query = QuerySchema.parse({
    role: sp.get("role") ?? undefined,
    status: sp.get("status") ?? undefined,
    search: sp.get("search") || undefined,
  });
  const pagination = parsePagination(sp);

  const { users, total, roleCounts } = await getAdminUsers({ ...pagination, ...query });
  return jsonOk({ users, roleCounts }, { meta: paginationMeta(pagination, total) });
});
