import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { log } from "@avenick/observability";
// Narrow subpath on purpose: the package barrel pulls in next-auth, which is
// unnecessary here and breaks tests that never touch authentication.
import { checkRateLimit, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { z } from "zod";

// The same category list the support page renders; anything else is stored
// as OTHER rather than as whatever string the client chose to send.
const TicketCategorySchema = z.enum(["ORDER", "DELIVERY", "PAYMENT", "PRODUCT", "ACCOUNT", "OTHER"]);

const CreateTicketSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject.").max(200, "Keep the subject under 200 characters."),
  description: z.string().trim().min(1, "Describe your issue.").max(5000, "Keep the description under 5000 characters."),
  category: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : "OTHER"),
    TicketCategorySchema.catch("OTHER"),
  ),
  orderRef: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(64).nullable()),
});

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

    // Keyed by user, not IP: the route is authenticated, and every ticket is a
    // row an agent has to read. Checked before the body is parsed so a
    // rejected request costs nothing beyond the counter.
    const rl = await checkRateLimit(RATE_LIMITS.supportTicket, userId);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many tickets — try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) },
        },
      );
    }

    // The session is a claim about who is asking; the account's current
    // standing comes from the database (same check as the review routes). A
    // suspended or deleted account must not be able to keep filing tickets
    // for agents to read on the strength of a cookie issued before the
    // suspension.
    const user = await db.user.findUnique({ where: { id: userId }, select: { status: true, deletedAt: true } });
    if (!user || user.status !== "ACTIVE" || user.deletedAt) {
      return NextResponse.json({ success: false, error: "An active account is required to open a ticket." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateTicketSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Invalid ticket.";
      return NextResponse.json({ success: false, error: first }, { status: 400 });
    }
    const { subject, description, category, orderRef } = parsed.data;

    const ticket = await db.supportTicket.create({
      data: { ticketNumber: ticketNumber(), userId, subject, description, category, orderRef },
    });

    // No response-time promise in the message: nothing measures or enforces one.
    return NextResponse.json({ success: true, data: ticket, message: "Ticket submitted. Track its status on the support page." });
  } catch (error) {
    log.error("support ticket failed", error, { path: "/api/support" });
    return NextResponse.json({ success: false, error: "Failed to submit ticket" }, { status: 500 });
  }
}
