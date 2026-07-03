import { auth } from "@/lib/auth-instance";
import { guarded, jsonOk, parsePagination, paginationMeta, ADMIN_ROLES } from "@avenick/auth";
import { getAuditLogs, AuditAction } from "@avenick/database";
import { z } from "zod";

const QuerySchema = z.object({
  entityType: z.string().trim().max(100).optional(),
  action: z.nativeEnum(AuditAction).optional(),
  search: z.string().trim().max(200).optional(),
});

export const GET = guarded({ auth, roles: ADMIN_ROLES }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const query = QuerySchema.parse({
    entityType: sp.get("entityType") || undefined,
    action: sp.get("action") || undefined,
    search: sp.get("search") || undefined,
  });
  const pagination = parsePagination(sp, { defaultLimit: 50 });

  const { logs, total } = await getAuditLogs({ ...pagination, ...query });
  return jsonOk(logs, { meta: paginationMeta(pagination, total) });
});
