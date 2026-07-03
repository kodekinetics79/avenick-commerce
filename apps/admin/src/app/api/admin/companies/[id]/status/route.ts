import { auth } from "@/lib/auth-instance";
import { guarded, jsonOk, ApiError, ADMIN_ROLES } from "@avenick/auth";
import { setCompanyStatus, CompanyStatus } from "@avenick/database";
import { z } from "zod";

const BodySchema = z.object({
  status: z.nativeEnum(CompanyStatus),
  reason: z.string().trim().max(500).optional(),
});

export const PATCH = guarded({ auth, roles: ADMIN_ROLES }, async ({ req, params, userId }) => {
  const body = BodySchema.parse(await req.json());

  try {
    const company = await setCompanyStatus({
      companyId: params.id,
      status: body.status,
      actorId: userId,
      reason: body.reason,
    });
    return jsonOk({ id: company.id, status: company.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update company status";
    if (/not found/i.test(message)) throw new ApiError(message, 404);
    throw e;
  }
});
