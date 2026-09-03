import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckSquare, Clock, CheckCircle, XCircle, FileText, ShieldCheck } from "lucide-react";
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
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import { toneRule } from "@/components/b2b/rules";
import { fetchB2BJson } from "@/lib/b2b";
import { approvePO, rejectPO } from "../purchase-orders/actions";
import { ActionBanner } from "@/components/b2b/action-banner";

export async function generateMetadata() {
  return b2bMetadata("approvals.title");
}
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

  const { t, f } = await getB2B();
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
    return u ? `${u.firstName} ${u.lastName}` : t("common.unknown");
  };

  const approvedCount = decided.filter((d) => ["APPROVED", "ORDERED"].includes(d.status)).length;
  const rejectedCount = decided.filter((d) => d.status === "REJECTED").length;

  return (
    <B2BShell
      eyebrow={t("approvals.eyebrow")}
      title={t("approvals.title")}
      description={t("approvals.description")}
      // /api/b2b/purchase-orders returns the 100 most recent POs. Every count
      // and every row on this page is drawn from that window, so the window is
      // stated rather than left for the reader to assume it is the whole book.
      dateline={t("approvals.basis")}
    >
      <div className="space-y-block">
        <ActionBanner done={searchParams?.poDone} error={searchParams?.poError} />

        {/* One panel, hairline-divided. The four amber/green/red/white boxes
            this replaces used colour to say what the label already said. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label={t("approvals.stat.awaiting")}
            value={pending.length}
            rank="section"
            chip={pending.length > 0 ? "warning" : "neutral"}
            icon={Clock}
          />
          {/* A chip is a state, not a decoration: a green chip on a zero says
              nothing happened is a good thing, so it stays neutral until there
              is something to report. */}
          <Stat
            label={t("approvals.stat.approved")}
            value={approvedCount}
            chip={approvedCount > 0 ? "success" : "neutral"}
            icon={CheckCircle}
          />
          <Stat
            label={t("approvals.stat.rejected")}
            value={rejectedCount}
            chip={rejectedCount > 0 ? "danger" : "neutral"}
            icon={XCircle}
          />
          <Stat label={t("approvals.stat.policies")} value={policies.length} icon={CheckSquare} />
        </CellGrid>
        {/* The two decided counts are drawn from the ten most recent decisions
            this page loads, not from the company's whole history. Say so. */}
        <Dateline>{t("approvals.stat.basis")}</Dateline>

        {!isApprover && (
          <Surface rung={1} tone="accent" className="flex items-start gap-2 p-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <p className="u-ui text-ink-1">{t("approvals.notApprover")}</p>
          </Surface>
        )}

        <LedgerTable
          title={t("approvals.pending.title")}
          rows={pending}
          getRowKey={(po) => po.id}
          dateline={t("approvals.pending.basis")}
          // Every row in this table is held, so every row carries the held rule.
          rowProps={() => ({ className: toneRule("warning") })}
          columns={[
            {
              key: "poNumber",
              label: t("approvals.col.po"),
              render: (po) => (
                <div className="min-w-0 py-2">
                  <p className="u-mono font-medium text-ink-1">{po.poNumber}</p>
                  <p className="u-meta text-ink-2">
                    {po.notes ?? t("approvals.noNote")} · {t("approvals.requestedBy", { name: nameOf(po.requesterId) })}
                  </p>
                </div>
              ),
            },
            {
              key: "createdAt",
              label: t("approvals.col.waiting"),
              render: (po) => (
                <span className="u-meta whitespace-nowrap text-ink-2">{f.relative(po.createdAt)}</span>
              ),
            },
            {
              key: "total",
              label: t("common.total"),
              numeric: true,
              render: (po) => <Money amount={Number(po.total)} currency={po.currency} />,
            },
            {
              key: "actions",
              label: t("approvals.col.decision"),
              align: "end",
              render: (po) =>
                isApprover ? (
                  <div className="flex items-center justify-end gap-2">
                    {/* Two forms, two server actions, unchanged. Only the
                        controls they submit through have been restyled. */}
                    <form action={approvePO.bind(null, po.id)}>
                      <Button type="submit" variant="primary" size="sm">
                        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> {t("common.approve")}
                      </Button>
                    </form>
                    <form action={rejectPO.bind(null, po.id)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> {t("common.reject")}
                      </Button>
                    </form>
                  </div>
                ) : (
                  <span className="u-meta text-ink-3">{t("approvals.approverOnly")}</span>
                ),
            },
          ]}
          // THE CERTIFICATE, and there is exactly one per page. This is the
          // page's subject: an approver who opens the queue and finds it clear
          // has been told the most important thing on the screen, so it is the
          // composed plate rather than a centred grey line. Every other empty
          // region in the suite gets the default blank WITH a real action —
          // three composed plates down one page stop reading as composition.
          empty={
            <EmptyState
              variant="certificate"
              glyph={<ShieldCheck />}
              eyebrow={t("approvals.pending.empty.eyebrow")}
              headline={t("approvals.pending.empty.headline")}
              body={t("approvals.pending.empty.body")}
              action={
                <Button asChild variant="secondary">
                  <Link href="/b2b/approval-policies">{t("approvals.pending.empty.action")}</Link>
                </Button>
              }
            />
          }
        />

        <LedgerTable
          title={t("approvals.decided.title")}
          dateline={t("approvals.decided.basis")}
          rows={decided}
          getRowKey={(po) => po.id}
          density="compact"
          rowProps={(po) => ({ className: toneRule(po.status === "REJECTED" ? "danger" : "success") })}
          toolbar={
            <Button asChild variant="link" size="sm">
              <Link href="/b2b/purchase-orders">
                <FileText className="h-3 w-3" aria-hidden="true" /> {t("approvals.allPos")}
              </Link>
            </Button>
          }
          columns={[
            {
              key: "poNumber",
              label: t("approvals.col.po"),
              render: (po) => (
                <div className="min-w-0">
                  <p className="u-mono font-medium text-ink-1">{po.poNumber}</p>
                  <p className="u-meta truncate text-ink-2">
                    {nameOf(po.requesterId)} · {f.date(po.updatedAt)}
                    {po.rejectionReason ? ` · ${po.rejectionReason}` : ""}
                  </p>
                </div>
              ),
            },
            {
              key: "total",
              label: t("common.total"),
              numeric: true,
              render: (po) => <Money amount={Number(po.total)} currency={po.currency} />,
            },
            {
              key: "status",
              label: t("approvals.col.outcome"),
              align: "end",
              render: (po) => (
                <StatusPill tone={po.status === "REJECTED" ? "danger" : "success"} className="whitespace-nowrap">
                  {po.status === "ORDERED"
                    ? t("approvals.outcome.orderedLabel")
                    : po.status === "REJECTED"
                      ? t("po.status.rejected")
                      : t("po.status.approved")}
                </StatusPill>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("approvals.decided.empty.eyebrow")}
              headline={t("approvals.decided.empty.headline")}
              body={t("approvals.decided.empty.body")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/b2b/purchase-orders">{t("approvals.decided.empty.action")}</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </B2BShell>
  );
}
