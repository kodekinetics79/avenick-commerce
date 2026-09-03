import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckSquare, Clock, CheckCircle, XCircle, FileText } from "lucide-react";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  LedgerTable,
  Stat,
  StatusPill,
  Surface,
} from "@avenick/ui";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { fetchB2BJson } from "@/lib/b2b";
import { approvePO, rejectPO } from "../purchase-orders/actions";
import { format, formatDistanceToNow } from "date-fns";
import { POActionBanner } from "@/components/b2b/po-action-banner";

export const metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

export default async function ApprovalsPage({ searchParams }: { searchParams?: { poDone?: string; poError?: string } }) {
  type PurchaseOrderRow = {
    id: string;
    poNumber: string;
    requesterId: string;
    status: string;
    currency: string;
    total: string | number;
    notes: string | null;
    rejectionReason: string | null;
    createdAt: string;
    updatedAt: string;
  };
  type ApprovalData = {
    isApprover: boolean;
    purchaseOrders: PurchaseOrderRow[];
    policies: Array<{ id: string }>;
    requesters: Array<{ id: string; firstName: string; lastName: string }>;
  };
  let data: ApprovalData;
  try {
    data = await fetchB2BJson<ApprovalData>("/api/b2b/purchase-orders");
  } catch {
    redirect("/b2b/register");
  }

  const isApprover = data.isApprover;
  const pending = data.purchaseOrders
    .filter((po) => po.status === "PENDING_APPROVAL")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  // Sorted by updatedAt before it is sliced. /api/b2b/purchase-orders returns
  // rows ordered by createdAt, so slicing that order gave the ten most recently
  // RAISED decided POs, not the ten most recent decisions — and the heading, the
  // dates in the rows and the two counts below all claim decision order.
  const decided = data.purchaseOrders
    .filter((po) => ["APPROVED", "REJECTED", "ORDERED"].includes(po.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);
  const policies = data.policies;
  const requesters = data.requesters;
  const nameOf = (id: string) => {
    const u = requesters.find((r) => r.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "Unknown";
  };

  const approvedCount = decided.filter((d) => ["APPROVED", "ORDERED"].includes(d.status)).length;
  const rejectedCount = decided.filter((d) => d.status === "REJECTED").length;

  return (
    <B2BShell
      eyebrow="Working"
      title="Approvals"
      description="Purchase orders routed to approvers by your company's approval policies."
      // /api/b2b/purchase-orders returns the 100 most recent POs. Every count
      // and every row on this page is drawn from that window, so the window is
      // stated rather than left for the reader to assume it is the whole book.
      dateline="Drawn from the 100 most recent purchase orders raised by this company"
    >
      <div className="space-y-block">
        <POActionBanner done={searchParams?.poDone} error={searchParams?.poError} />

        {/* One panel, hairline-divided. The four amber/green/red/white boxes
            this replaces used colour to say what the label already said. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label="Awaiting approval"
            value={pending.length}
            rank="section"
            chip={pending.length > 0 ? "warning" : "neutral"}
            icon={Clock}
          />
          {/* A chip is a state, not a decoration: a green chip on a zero says
              nothing happened is a good thing, so it stays neutral until there
              is something to report. */}
          <Stat
            label="Approved"
            value={approvedCount}
            chip={approvedCount > 0 ? "success" : "neutral"}
            icon={CheckCircle}
          />
          <Stat label="Rejected" value={rejectedCount} chip={rejectedCount > 0 ? "danger" : "neutral"} icon={XCircle} />
          <Stat label="Active policies" value={policies.length} icon={CheckSquare} />
        </CellGrid>
        {/* The two decided counts are drawn from the ten most recent decisions
            this page loads, not from the company's whole history. Say so. */}
        <Dateline>Approved and rejected counts cover the ten most recent decisions shown below</Dateline>

        {!isApprover && (
          <Surface rung={1} tone="accent" className="flex items-start gap-2 p-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <p className="u-ui text-ink-1">
              You can view the approval queue; approving or rejecting requires an approver or admin role.
            </p>
          </Surface>
        )}

        <LedgerTable
          title="Pending approval"
          rows={pending}
          getRowKey={(po) => po.id}
          dateline="Oldest request first · each total in the currency the PO was raised in"
          columns={[
            {
              key: "poNumber",
              label: "Purchase order",
              render: (po) => (
                <div className="min-w-0 py-2">
                  <p className="u-mono font-medium text-ink-1">{po.poNumber}</p>
                  <p className="u-meta text-ink-2">
                    {po.notes ?? "No note"} · requested by {nameOf(po.requesterId)}
                  </p>
                </div>
              ),
            },
            {
              key: "createdAt",
              label: "Waiting",
              render: (po) => (
                <span className="u-meta whitespace-nowrap text-ink-2">
                  {formatDistanceToNow(new Date(po.createdAt), { addSuffix: true })}
                </span>
              ),
            },
            {
              key: "total",
              label: "Total",
              numeric: true,
              render: (po) => <Money amount={Number(po.total)} currency={po.currency} />,
            },
            {
              key: "actions",
              label: "Decision",
              align: "end",
              render: (po) =>
                isApprover ? (
                  <div className="flex items-center justify-end gap-2">
                    {/* Two forms, two server actions, unchanged. Only the
                        controls they submit through have been restyled. */}
                    <form action={approvePO.bind(null, po.id)}>
                      <Button type="submit" variant="primary" size="sm">
                        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Approve
                      </Button>
                    </form>
                    <form action={rejectPO.bind(null, po.id)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Reject
                      </Button>
                    </form>
                  </div>
                ) : (
                  <span className="u-meta text-ink-3">Approver only</span>
                ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Queue clear"
              headline="No purchase order is waiting for a decision."
              body="A PO appears here once its value crosses one of your company's approval thresholds."
            />
          }
        />

        <LedgerTable
          title="Recent decisions"
          rows={decided}
          getRowKey={(po) => po.id}
          density="compact"
          toolbar={
            <Button asChild variant="link" size="sm">
              <Link href="/b2b/purchase-orders">
                <FileText className="h-3 w-3" aria-hidden="true" /> All purchase orders
              </Link>
            </Button>
          }
          columns={[
            {
              key: "poNumber",
              label: "Purchase order",
              render: (po) => (
                <div className="min-w-0">
                  <p className="u-mono font-medium text-ink-1">{po.poNumber}</p>
                  <p className="u-meta truncate text-ink-2">
                    {nameOf(po.requesterId)} · {format(new Date(po.updatedAt), "MMM d, yyyy")}
                    {po.rejectionReason ? ` · ${po.rejectionReason}` : ""}
                  </p>
                </div>
              ),
            },
            {
              key: "total",
              label: "Total",
              numeric: true,
              render: (po) => <Money amount={Number(po.total)} currency={po.currency} />,
            },
            {
              key: "status",
              label: "Outcome",
              align: "end",
              render: (po) => (
                <StatusPill tone={po.status === "REJECTED" ? "danger" : "success"}>
                  {po.status === "ORDERED" ? "Approved · Ordered" : po.status.charAt(0) + po.status.slice(1).toLowerCase()}
                </StatusPill>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No purchase order has been approved or rejected yet."
              body="Decisions taken on this page are listed here, most recent first."
            />
          }
        />
      </div>
    </B2BShell>
  );
}
