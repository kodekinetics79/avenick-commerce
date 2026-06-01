import Link from "next/link";
import { db } from "@avenick/database";
import { CheckCircle2, Circle, Rocket, ArrowRight } from "lucide-react";

/**
 * Server component — computes real store-setup completion and renders a
 * guided checklist. Returns null once everything is done.
 */
export async function OnboardingChecklist({ seller }: { seller: { id: string; bankDetails: unknown } }) {
  const [productCount, docCount, orderCount] = await Promise.all([
    db.product.count({ where: { sellerId: seller.id } }),
    db.sellerDocument.count({ where: { sellerId: seller.id } }),
    db.orderItem.count({ where: { sellerId: seller.id } }),
  ]);

  const steps = [
    { label: "Complete business profile", done: true, href: "/settings" },
    { label: "Add your first product", done: productCount > 0, href: "/products" },
    { label: "Upload compliance documents", done: docCount > 0, href: "/documents" },
    { label: "Set up payout details", done: !!seller.bankDetails, href: "/settings" },
    { label: "Make your first sale", done: orderCount > 0, href: "/orders" },
  ];

  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  if (done === steps.length) return null;

  const next = steps.find((s) => !s.done);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-5">
      <div className="absolute -top-10 end-8 h-36 w-36 rounded-full bg-primary/15 blur-[80px]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Rocket className="h-4.5 w-4.5" /></span>
            <div>
              <p className="font-semibold text-sm">Get your store live</p>
              <p className="text-xs text-muted-foreground">{done} of {steps.length} steps complete</p>
            </div>
          </div>
          {next && (
            <Link href={next.href} className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-[0.98]">
              {next.label.replace("your ", "").replace("Make your first sale", "Promote products")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden mb-4">
          <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {steps.map((s) => (
            <Link key={s.label} href={s.href} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors ${s.done ? "border-border bg-card/60 text-muted-foreground" : "border-primary/30 bg-card hover:border-primary/50"}`}>
              {s.done ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> : <Circle className="h-4 w-4 text-primary shrink-0" />}
              <span className={`font-medium ${s.done ? "line-through" : ""}`}>{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
