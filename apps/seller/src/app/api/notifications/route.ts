import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ items: [], unread: 0 });

  const items = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, titleEn: true, bodyEn: true, isRead: true, createdAt: true },
  });
  const unread = items.filter((n) => !n.isRead).length;
  return NextResponse.json({ items, unread });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.id) {
    await db.notification.updateMany({ where: { id: body.id, userId }, data: { isRead: true } });
  } else {
    await db.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }
  return NextResponse.json({ ok: true });
}
