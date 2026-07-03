import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckSquare, Clock, CheckCircle, XCircle, FileText } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { getB2BContext } from "@/lib/b2b";
import { approvePO, rejectPO } from "../purchase-orders/actions";
import { format, formatDistanceToNow } from "date-fns";

export const metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

const APPROVER_ROLES = ["COMPANY_ADMIN", "COMPANY_APPROVER"];

export default async function ApprovalsPage() {
  const ctx = await getB2BContext();
  if (!ctx) redirect("/b2b/register");

  const isApprover = APPROVER_ROLES.includes(ctx.member.role);

  const [pending, decided, policies] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { companyId: ctx.companyId, status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "asc" },
    }),
    db.purchaseOrder.findMany({
      where: { companyId: ctx.companyId, status: { in: ["APPROVED", "REJECTED", "ORDERED"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    db.approvalPolicy.findMany({ where: { companyId: ctx.companyId, isActive: true } }),
  ]);

  // Requester names for display.
  const requesterIds = [...new Set([...pending, ...decided].map((p) => p.requesterId))];
  const requesters = await db.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nameOf = (id: string) => {
    const u = requesters.find((r) => r.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "Unknown";
  };

  return (
    <B2BShell
      title="Approvals"
      description="Purchase orders routed to approvers by your company's approval policies."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Awaiting approval", value: pending.length, color: "bg-amber-50 border-amber-200" },
            { label: "Approved", value: decided.filter((d) => ["APPROVED", "ORDERED"].includes(d.status)).length, color: "bg-green-50 border-green-200" },
            { label: "Rejected", value: decided.filter((d) => d.status === "REJECTED").length, color: "bg-red-50 border-red-200" },
            { label: "Active policies", value: policies.length, color: "bg-white border-border" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {!isApprover && (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-primary">
            <Clock className="h-4 w-4 shrink-0" />
            You can view the approval queue; approving or rejecting requires an approver or admin role.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Pending approval</h2>
          </div>
          {pending.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <CheckSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nothing awaiting approval. POs above your policy thresholds appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pending.map((po) => (
                <li key={po.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{po.poNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {po.notes ?? "—"} · requested by {nameOf(po.requesterId)} · {formatDistanceToNow(po.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  <p className="font-bold">{formatCurrency(Number(po.total), po.currency as never)}</p>
                  {isApprover && (
                    <div className="flex gap-2">
                      <form action={approvePO.bind(null, po.id)}>
                        <button type="submit" className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                          <CheckCircle className="h-3.5 w-3.5" /> Approve
                        </button>
                      </form>
                      <form action={rejectPO.bind(null, po.id)}>
                        <button type="submit" className="inline-flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Recent decisions</h2>
            <Link href="/b2b/purchase-orders" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <FileText className="h-3 w-3" /> All purchase orders
            </Link>
          </div>
          {decided.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">No decisions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {decided.map((po) => (
                <li key={po.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{po.poNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {nameOf(po.requesterId)} · {format(po.updatedAt, "MMM d, yyyy")}
                      {po.rejectionReason ? ` · ${po.rejectionReason}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold">{formatCurrency(Number(po.total), po.currency as never)}</span>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        po.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}
                    >
                      {po.status === "ORDERED" ? "Approved · Ordered" : po.status.charAt(0) + po.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </B2BShell>
  );
}
