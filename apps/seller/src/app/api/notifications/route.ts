import { auth } from "@/lib/auth-instance";
import { guarded, jsonOk } from "@avenick/auth";
import { db } from "@avenick/database";
import { z } from "zod";

export const GET = guarded({ auth }, async ({ userId }) => {
  const items = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, titleEn: true, bodyEn: true, isRead: true, createdAt: true },
  });
  const unread = items.filter((n) => !n.isRead).length;
  return jsonOk({ items, unread });
});

const MarkReadSchema = z.object({ id: z.string().optional() });

export const POST = guarded({ auth }, async ({ req, userId }) => {
  const body = MarkReadSchema.parse(await req.json().catch(() => ({})));
  const result = body.id
    ? await db.notification.updateMany({ where: { id: body.id, userId }, data: { isRead: true } })
    : await db.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  return jsonOk({ updated: result.count });
});
