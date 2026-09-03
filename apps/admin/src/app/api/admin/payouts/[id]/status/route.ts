import { auth } from "@/lib/auth-instance";
import { guarded, jsonOk, ApiError, ADMIN_ROLES } from "@avenick/auth";
import { setPayoutStatus, PayoutStatus } from "@avenick/database";
import { z } from "zod";

const BodySchema = z.object({
  status: z.nativeEnum(PayoutStatus),
  reference: z.string().trim().max(120).optional(),
});

export const PATCH = guarded({ auth, roles: ADMIN_ROLES }, async ({ req, params, userId }) => {
  const body = BodySchema.parse(await req.json());

  try {
    const payout = await setPayoutStatus({
      payoutId: params.id,
      status: body.status,
      actorId: userId,
      reference: body.reference,
    });
    return jsonOk({ id: payout.id, status: payout.status, processedAt: payout.processedAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update payout";
    if (/not found/i.test(message)) throw new ApiError(message, 404);
    if (/cannot move|settlement reference|requires an actor|already settled/i.test(message)) throw new ApiError(message, 409);
    throw e;
  }
});
