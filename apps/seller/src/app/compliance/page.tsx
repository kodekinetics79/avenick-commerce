import { ONBOARDING_SELLER_STATUSES, requireSellerAnyPermission } from "@/lib/auth";
import { SELLER_DOCUMENT_TYPE_LABELS, SUPERSEDED_REJECTION_REASON, db } from "@avenick/database";
import { browserDirectUploadsEnabled } from "@avenick/utils/browser-upload-policy";
import { SellerLayout } from "@/components/layout/seller-layout";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  LedgerTable,
  PageHeader,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { format, isAfter, addDays } from "date-fns";
import { AlertTriangle, CheckCircle, Clock, ExternalLink, RefreshCw, XCircle, Upload } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Compliance" };

// Every row here belongs to the acting seller; never prerender or share it.
export const dynamic = "force-dynamic";

// Enum → label map, plus the semantic tone the pill is drawn in. Four states,
// not five hues: a replaced row is neutral because nothing is owed on it.
const DOC_STATUS: Record<string, { icon: typeof CheckCircle; tone: PillTone; label: string }> = {
  APPROVED: { icon: CheckCircle, tone: "success", label: "Approved" },
  PENDING_REVIEW: { icon: Clock, tone: "warning", label: "Pending review" },
  REJECTED: { icon: XCircle, tone: "danger", label: "Rejected" },
  EXPIRED: { icon: AlertTriangle, tone: "danger", label: "Expired" },
  // A REJECTED row carrying the supersession reason was replaced by the
  // seller's own newer upload, not refused by an admin.
  SUPERSEDED: { icon: RefreshCw, tone: "neutral", label: "Replaced" },
};

function DocStatus({ status }: { status: string }) {
  const cfg = DOC_STATUS[status] ?? DOC_STATUS["PENDING_REVIEW"]!;
  return (
    <StatusPill tone={cfg.tone} className="whitespace-nowrap">
      <cfg.icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label}
    </StatusPill>
  );
}

export default async function CompliancePage() {
  // Same admission as the Document Center: a seller under review reads the
  // same rows here, so the two pages must agree on who may see them.
  const { seller, membership } = await requireSellerAnyPermission(["documents.view", "documents.manage"], {
    allowedSellerStatuses: ONBOARDING_SELLER_STATUSES,
  });
  const permissions = membership.permissions ?? [];
  const canUpload = (permissions.includes("*") || permissions.includes("documents.manage")) && browserDirectUploadsEnabled();

  const docs = await db.sellerDocument.findMany({
    where: { sellerId: seller.id },
    orderBy: [{ status: "asc" }, { uploadedAt: "desc" }],
  });

  // A refused or replaced row lapsing is not something the seller must act on;
  // only rows that are (or were) valid, or still awaiting a decision, count.
  const tracked = docs.filter((d) => d.status !== "REJECTED");
  const expiringSoon = tracked.filter((d) => d.expiryDate && isAfter(d.expiryDate, new Date()) && !isAfter(d.expiryDate, addDays(new Date(), 30)));
  const expired = tracked.filter((d) => d.expiryDate && !isAfter(d.expiryDate, new Date()));

  const rows = docs.map((doc) => {
    const isExpired = Boolean(doc.expiryDate) && !isAfter(doc.expiryDate!, new Date());
    const isExpiring = Boolean(doc.expiryDate) && isAfter(doc.expiryDate!, new Date()) && !isAfter(doc.expiryDate!, addDays(new Date(), 30));
    const superseded = doc.status === "REJECTED" && doc.rejectionReason === SUPERSEDED_REJECTION_REASON;
    return {
      doc,
      isExpired,
      isExpiring,
      superseded,
      status: superseded ? "SUPERSEDED" : isExpired && doc.status === "APPROVED" ? "EXPIRED" : doc.status,
    };
  });
  type ComplianceRow = (typeof rows)[number];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} issueCount={expired.length + expiringSoon.length} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Compliance"
          title="Compliance — الامتثال"
          description="Every document the platform holds for this account, and what it is worth right now."
          // Nothing sweeps expiry into the status column, so it is derived when
          // the page is read. Saying which clock the page is reading is what
          // makes the "Expired" label credible.
          dateline="Status as at page load · expiry is derived on read, not stored · warnings start 30 days out"
          actions={
            // Uploads live in the Document Center; this is a link to its uploader,
            // shown only when the member can upload and storage is configured.
            canUpload ? (
              <Button variant="primary" size="sm" asChild>
                <Link href="/documents?upload=1">
                  <Upload className="h-4 w-4" aria-hidden="true" /> Upload document
                </Link>
              </Button>
            ) : undefined
          }
        />

        {(expired.length > 0 || expiringSoon.length > 0) && (
          <section aria-label="Action required" className="space-y-2">
            <Eyebrow as="h2">Action required</Eyebrow>
            <Surface rung={1} className="divide-y divide-hairline overflow-hidden">
              {expired.length > 0 && (
                <div className="flex items-start gap-3 border-s-[3px] border-s-danger px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="u-ui font-medium text-ink-1">Expired documents ({expired.length})</p>
                    <p className="u-meta mt-0.5 text-ink-2">
                      These documents have expired and may affect your account status.
                    </p>
                  </div>
                </div>
              )}
              {expiringSoon.length > 0 && (
                <div className="flex items-start gap-3 border-s-[3px] border-s-warning px-4 py-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="u-ui font-medium text-ink-1">Expiring within 30 days ({expiringSoon.length})</p>
                    <p className="u-meta mt-0.5 text-ink-2">
                      Please renew these documents soon to avoid service interruptions.
                    </p>
                  </div>
                </div>
              )}
            </Surface>
          </section>
        )}

        <LedgerTable<ComplianceRow>
          rows={rows}
          getRowKey={(r) => r.doc.id}
          stickyHead
          // A lapsed or lapsing row wears its state, so the table is readable
          // in one pass without reading every badge.
          rowProps={(r) => ({
            className: r.isExpired ? "bg-danger-soft" : r.isExpiring ? "bg-warning-soft" : undefined,
          })}
          columns={[
            {
              key: "type",
              label: "Document type",
              render: (r) => <span className="font-medium">{SELLER_DOCUMENT_TYPE_LABELS[r.doc.type]}</span>,
            },
            {
              key: "file",
              label: "File",
              render: (r) => (
                // The stored value is a private object key, not a URL; the
                // view route mints a short-lived signed link per request.
                <a
                  href={`/documents/${r.doc.id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="u-focus u-meta inline-flex max-w-[220px] items-center gap-1 truncate rounded-nested text-primary-ink hover:underline"
                >
                  <span className="truncate">{r.doc.fileName}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ),
            },
            { key: "status", label: "Status", render: (r) => <DocStatus status={r.status} /> },
            {
              key: "expiry",
              label: "Expiry",
              align: "end",
              render: (r) =>
                r.doc.expiryDate ? (
                  <span
                    className={
                      r.isExpired ? "font-medium text-danger-ink" : r.isExpiring ? "font-medium text-warning-ink" : "text-ink-2"
                    }
                  >
                    {format(r.doc.expiryDate, "MMM d, yyyy")}
                  </span>
                ) : (
                  <span className="text-ink-3">—</span>
                ),
            },
            {
              key: "uploaded",
              label: "Uploaded",
              align: "end",
              hideOnMobile: true,
              render: (r) => <span className="u-meta whitespace-nowrap text-ink-2">{format(r.doc.uploadedAt, "MMM d, yyyy")}</span>,
            },
            {
              key: "actions",
              label: "Follow-up",
              align: "end",
              render: (r) => (
                <div className="flex flex-col items-end gap-1">
                  {r.doc.rejectionReason && !r.superseded && (
                    <Dateline className="text-danger-ink">{r.doc.rejectionReason}</Dateline>
                  )}
                  {canUpload && (r.isExpired || r.isExpiring || r.doc.status === "REJECTED") && !r.superseded && (
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/documents?upload=${r.doc.type}`}>
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        {r.doc.status === "REJECTED" ? "Re-upload" : "Renew"}
                      </Link>
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No compliance document has been filed for this account."
              body="Documents you upload are listed here with the decision the review team reached on each."
              action={
                canUpload ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/documents?upload=1">Upload the first one</Link>
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </div>
    </SellerLayout>
  );
}
