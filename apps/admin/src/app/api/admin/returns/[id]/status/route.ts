import { auth } from "@/lib/auth-instance";
import { guarded, jsonOk, ApiError, ADMIN_ROLES } from "@avenick/auth";
import { setReturnStatus, ReturnStatus } from "@avenick/database";
import { z } from "zod";

const BodySchema = z.object({
  status: z.nativeEnum(ReturnStatus),
  resolution: z.string().trim().max(500).optional(),
  refundAmount: z.number().positive().optional(),
  refundReference: z.string().trim().min(3).max(160).optional(),
});

export const PATCH = guarded({ auth, roles: ADMIN_ROLES }, async ({ req, params, userId }) => {
  const body = BodySchema.parse(await req.json());

  try {
    const ret = await setReturnStatus({
      returnId: params.id,
      status: body.status,
      actorId: userId,
      resolution: body.resolution,
      refundAmount: body.refundAmount,
      refundReference: body.refundReference,
    });
    return jsonOk({ id: ret.id, status: ret.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update return";
    if (/not found/i.test(message)) throw new ApiError(message, 404);
    if (/cannot move|refund amount|refund reference/i.test(message)) throw new ApiError(message, 409);
    throw e;
  }
});
