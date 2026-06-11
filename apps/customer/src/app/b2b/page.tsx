import Link from "next/link";
import { Building2, CreditCard, FileText, ArrowRight, Plus, RotateCcw, ClipboardList, CheckSquare, Clock, AlertTriangle, Users, ChevronRight, Star } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { MOCK_B2B_COMPANY, MOCK_RFQS, MOCK_PRODUCTS } from "@avenick/database";
import { Button } from "@avenick/ui";

export const metadata = { title: "B2B Dashboard — Avenick Commerce" };
const RFQ_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:         { label: "Draft",          color: "bg-muted text-muted-foreground" },
  SUBMITTED:     { label: "Submitted",      color: "bg-primary/15 text-primary" },
  UNDER_REVIEW:  { label: "Under Review",   color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  QUOTED:        { label: "Quoted",         color: "bg-purple-500/15 text-purple-500 dark:text-purple-400" },
  NEGOTIATING:   { label: "Negotiating",    color: "bg-primary/20 text-primary" },
  ACCEPTED:      { label: "Accepted",       color: "bg-primary/20 text-primary" },
  REJECTED:      { label: "Rejected",       color: "bg-danger/15 text-danger" },
  EXPIRED:       { label: "Expired",        color: "bg-muted text-muted-foreground" },
};

const MOCK_APPROVALS = [
  { id: "a1", orderRef: "ORD-2024-0831", description: "Safety Helmets × 200 units", amount: 8400, requester: "Khalid Al-Rashid", submittedAgo: "2 hours ago", urgency: "high" },
  { id: "a2", orderRef: "ORD-2024-0829", description: "Nitrile Gloves × 500 boxes", amount: 19500, requester: "Fatima Hassan", submittedAgo: "1 day ago", urgency: "normal" },
];

export default function B2BDashboardPage() {
  const company = MOCK_B2B_COMPANY;
  const rfqs = MOCK_RFQS;
  const reorderProducts = MOCK_PRODUCTS.slice(0, 4);
  const creditUsed = 117600;
  const creditPct = Math.round((creditUsed / company.creditLimit) * 100);

  return (
    <B2BShell>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-full">B2B Account</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{company.crNumber}</span>
            </div>
            <h1 className="text-2xl font-bold">{company.nameEn}</h1>
            <p className="text-muted-foreground text-sm" dir="rtl">{company.nameAr}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button asChild variant="ghost" size="sm">
              <Link href="/b2b/company">Edit Profile</Link>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href="/b2b/rfq/new">
                <Plus className="h-4 w-4 me-1" /> Create RFQ
              </Link>
            </Button>
          </div>
        </div>

        {/* Approval alert */}
        {MOCK_APPROVALS.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-semibold text-amber-600 dark:text-amber-400 text-sm">{MOCK_APPROVALS.length} orders awaiting your approval</p>
                <p className="text-xs text-amber-500/85">Review and approve pending purchase orders from your team.</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 border border-amber-500/35 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
              <Link href="/b2b/approvals">Review Now →</Link>
            </Button>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Credit limit */}
          <div className="bg-card rounded-2xl border border-border p-4 col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credit Limit</p>
            </div>
            <p className="text-2xl font-bold mb-1">AED {company.creditLimit.toLocaleString()}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Used: AED {creditUsed.toLocaleString()}</span>
                <span className={creditPct >= 90 ? "text-red-500 font-semibold" : creditPct >= 75 ? "text-amber-500 font-semibold" : "text-primary font-semibold"}>
                  {creditPct}%
                </span>
              </div>
              <div className="flex gap-0.5 h-1.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`flex-1 rounded-full ${i < Math.floor(creditPct / 10) ? (creditPct >= 90 ? "bg-red-500" : creditPct >= 75 ? "bg-amber-500" : "bg-primary") : "bg-secondary"}`} />
                ))}
              </div>
              <p className="text-xs text-primary font-medium">AED {(company.creditLimit - creditUsed).toLocaleString()} available</p>
            </div>
          </div>

          {/* Payment terms */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Terms</p>
            </div>
            <p className="text-2xl font-bold">Net {company.paymentTerms}</p>
            <p className="text-xs text-muted-foreground mt-1">Days from invoice</p>
            <p className="text-xs text-primary mt-0.5 font-medium">✓ No overdue invoices</p>
          </div>

          {/* Active RFQs */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="h-4 w-4 text-purple-500" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active RFQs</p>
            </div>
            <p className="text-2xl font-bold">{rfqs.filter(r => !["ACCEPTED","REJECTED","EXPIRED"].includes(r.status)).length}</p>
            <p className="text-xs text-muted-foreground mt-1">{rfqs.filter(r => r.status === "QUOTED").length} quotes ready to review</p>
            <Link href="/b2b/quotes" className="text-xs text-primary hover:underline mt-0.5 block font-medium">View quotes →</Link>
          </div>

          {/* Account manager */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-teal-500" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Manager</p>
            </div>
            <p className="font-semibold text-sm">Sara Al-Ahmed</p>
            <p className="text-xs text-muted-foreground">sara@avenick.com</p>
            <div className="flex items-center gap-1 mt-1">
              {[1,2,3,4,5].map(s => <Star key={s} className="h-3 w-3 text-amber-400 fill-current" />)}
            </div>
            <Link href="mailto:sara@avenick.com" className="text-xs text-primary hover:underline mt-1 block font-medium">Contact →</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RFQ list — main column */}
          <div className="lg:col-span-2 space-y-5">

            {/* RFQs */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground">My RFQs</h2>
                <Link href="/b2b/rfq/new" className="text-sm text-primary hover:underline flex items-center gap-1 font-medium">
                  <Plus className="h-3.5 w-3.5" /> New RFQ
                </Link>
              </div>
              <div className="divide-y divide-border">
                {rfqs.map((rfq) => {
                  const sc = RFQ_STATUS[rfq.status] ?? RFQ_STATUS.DRAFT;
                  const hasQuotes = rfq.status === "QUOTED";
                  return (
                    <Link key={rfq.id} href={`/b2b/rfq/${rfq.id}`}
                      className="flex items-start justify-between px-5 py-3.5 hover:bg-secondary/40 transition-colors group">
                      <div className="flex-1 min-w-0 pe-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-muted-foreground">{rfq.rfqNumber}</span>
                          {hasQuotes && <span className="text-xs bg-purple-500/15 text-purple-500 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-medium animate-pulse">New quote!</span>}
                        </div>
                        <p className="text-sm font-medium line-clamp-1">{rfq.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Qty: {rfq.quantity} · Target: {rfq.currency} {rfq.targetPrice.toLocaleString()} · Due: {rfq.requiredBy}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/20">
                <Link href="/b2b/quotes" className="text-sm text-primary hover:underline flex items-center gap-1 font-medium">
                  View all quotes <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Approvals */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-amber-500" />
                  <h2 className="font-semibold text-foreground">Pending Approvals</h2>
                  {MOCK_APPROVALS.length > 0 && (
                    <span className="h-5 w-5 bg-amber-500 text-white rounded-full text-xs flex items-center justify-center font-bold">{MOCK_APPROVALS.length}</span>
                  )}
                </div>
                <Link href="/b2b/approvals" className="text-sm text-primary hover:underline">View all</Link>
              </div>
              {MOCK_APPROVALS.length === 0 ? (
                <div className="px-5 py-8 text-center text-muted-foreground text-sm">No pending approvals</div>
              ) : (
                <div className="divide-y divide-border">
                  {MOCK_APPROVALS.map((a) => (
                    <div key={a.id} className="flex items-start justify-between px-5 py-3.5">
                      <div className="flex-1 min-w-0 pe-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-muted-foreground">{a.orderRef}</span>
                          {a.urgency === "high" && <AlertTriangle className="h-3 w-3 text-red-500" />}
                        </div>
                        <p className="text-sm font-medium">{a.description}</p>
                        <p className="text-xs text-muted-foreground">By {a.requester} · {a.submittedAgo}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="font-bold text-sm text-primary">AED {a.amount.toLocaleString()}</p>
                        <div className="flex gap-1.5 mt-1.5">
                          <button type="button" className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-lg hover:bg-primary/95 transition-colors font-medium">Approve</button>
                          <button type="button" className="text-xs bg-card border border-border text-muted-foreground px-2.5 py-1 rounded-lg hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 hover:border-red-500/30 transition-colors">Reject</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Reorder center */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm text-foreground">Reorder Center</h2>
              </div>
              <div className="divide-y divide-border">
                {reorderProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0 pe-3">
                      <p className="text-sm font-medium line-clamp-1">{p.nameEn}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-bold text-primary">AED {p.price.toFixed(0)}</p>
                      <Link href={`/products/${p.slug}`} className="text-xs text-primary hover:underline">Reorder</Link>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-border">
                <Link href="/products" className="text-xs text-primary hover:underline font-medium">Browse all products →</Link>
              </div>
            </div>

            {/* Quick links */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="font-semibold text-sm mb-3 text-foreground">Quick Actions</h3>
              <div className="space-y-1">
                {[
                  { href: "/b2b/rfq/new", label: "Create New RFQ", icon: Plus, color: "text-primary" },
                  { href: "/b2b/quotes", label: "View My Quotes", icon: ClipboardList, color: "text-purple-500" },
                  { href: "/b2b/approvals", label: "Approval Center", icon: CheckSquare, color: "text-amber-500" },
                  { href: "/b2b/company", label: "Company Profile", icon: Building2, color: "text-primary" },
                  { href: "/account/orders", label: "Order History", icon: Clock, color: "text-muted-foreground" },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link key={href} href={href}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-secondary/40 transition-colors group">
                    <Icon className={`h-4 w-4 ${color} shrink-0`} />
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">{label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ms-auto" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </B2BShell>
  );
}
