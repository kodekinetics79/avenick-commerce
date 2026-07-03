import { auth } from "@/lib/auth-instance";
import { guarded, jsonOk, parsePagination, paginationMeta, ADMIN_ROLES } from "@avenick/auth";
import { getAdminCompanies, CompanyStatus } from "@avenick/database";
import { z } from "zod";

const QuerySchema = z.object({
  status: z.nativeEnum(CompanyStatus).optional(),
  search: z.string().trim().max(200).optional(),
});

export const GET = guarded({ auth, roles: ADMIN_ROLES }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const query = QuerySchema.parse({
    status: sp.get("status") || undefined,
    search: sp.get("search") || undefined,
  });
  const pagination = parsePagination(sp);

  const { companies, total, statusCounts } = await getAdminCompanies({ ...pagination, ...query });
  return jsonOk({ companies, statusCounts }, { meta: paginationMeta(pagination, total) });
});
