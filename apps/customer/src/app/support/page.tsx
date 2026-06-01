import { MessageSquare, Plus, Clock, CheckCircle2, Activity, Lock } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { createTicket } from "./actions";

export const metadata = { title: "Support" };

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  IN_PROGRESS: { label: "In progress", cls: "bg-primary/15 text-primary", icon: Activity },
  RESOLVED: { label: "Resolved", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  CLOSED: { label: "Closed", cls: "bg-secondary text-muted-foreground", icon: CheckCircle2 },
};

const CATEGORIES = ["ORDER", "DELIVERY", "PAYMENT", "PRODUCT", "ACCOUNT", "OTHER"];

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function SupportPage() {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">Sign in to contact support</p>
        </div>
      </MainLayout>
    );
  }

  const tickets = await db.supportTicket.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Support</h1>
        </div>

        {/* New ticket */}
        <ValidatedForm action={createTicket} className="rounded-2xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-4"><Plus className="h-4 w-4 text-primary" /> Open a ticket</div>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input name="subject" required placeholder="Subject" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <select name="category" aria-label="Category" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <input name="orderRef" placeholder="Order reference (optional)" className="w-full h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <textarea name="description" required rows={4} placeholder="Describe your issue…" className="w-full px-3 py-2.5 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            <button type="submit" className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">Submit ticket</button>
          </div>
        </ValidatedForm>

        {/* My tickets */}
        <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide mb-3">My tickets</h2>
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card text-center py-12 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p>No tickets yet. Open one above if you need help.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const st = STATUS[t.status] ?? STATUS.OPEN!;
              return (
                <div key={t.id} className="rounded-2xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-primary">{t.ticketNumber}</span>
                        <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">{t.category}</span>
                        {t.orderRef && <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-mono">{t.orderRef}</span>}
                      </div>
                      <p className="font-medium text-sm truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Opened {fmt(t.createdAt)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${st.cls}`}>
                      <st.icon className="h-3 w-3" /> {st.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
