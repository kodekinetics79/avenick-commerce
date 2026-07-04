import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { log } from "@avenick/observability";

function ticketNumber() {
  const y = new Date().getFullYear();
  const t = Date.now().toString(36).slice(-4).toUpperCase();
  const r = Math.floor(100 + Math.random() * 900);
  return `TKT-${y}-${t}${r}`;
}

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id as string | undefined;
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const tickets = await db.supportTicket.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: tickets });
  } catch (error) {
    log.error("support ticket failed", error, { path: "/api/support" });
    return NextResponse.json({ success: false, error: "Failed to load tickets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id as string | undefined;
    if (!userId) return NextResponse.json({ success: false, error: "Please sign in to open a ticket." }, { status: 401 });

    const body = await req.json();
    const subject = String(body.subject ?? "").trim();
    const description = String(body.description ?? "").trim();
    const category = String(body.category ?? "OTHER").trim() || "OTHER";
    const orderRef = String(body.orderRef ?? "").trim() || null;

    if (!subject) return NextResponse.json({ success: false, error: "Add a subject." }, { status: 400 });
    if (!description) return NextResponse.json({ success: false, error: "Describe your issue." }, { status: 400 });

    const ticket = await db.supportTicket.create({
      data: { ticketNumber: ticketNumber(), userId, subject, description, category, orderRef },
    });

    return NextResponse.json({ success: true, data: ticket, message: "Ticket submitted — we'll respond within 24 hours." });
  } catch (error) {
    log.error("support ticket failed", error, { path: "/api/support" });
    return NextResponse.json({ success: false, error: "Failed to submit ticket" }, { status: 500 });
  }
}
