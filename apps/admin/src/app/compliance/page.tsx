import type { ReactNode } from "react";
import { requireAdminSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import { format, addDays, isAfter } from "date-fns";
import Link from "next/link";
import { FileText, FileCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button, EmptyState, LedgerTable, PageHeader, StatusPill, type PillTone } from "@avenick/ui";
import { documentTypeLabel, statusLabel } from "@/app/approvals/status-labels";

export async function generateMetadata() {
  const t = await getTranslations("adminReview");
  return { title: t("meta.compliance") };
}

/** Enum → tone. The four states an operator distinguishes, and nothing else. */
const STATUS_TONE: Record<string, PillTone> = {
  APPROVED: "success",
  REJECTED: "danger",
  EXPIRED: "warning",
  PENDING_REVIEW: "warning",
};

type ComplianceRow = {
  id: string;
  type: string;
  fileName: string;
  status: string;
  expiryDate: Date | null;
  uploadedAt: Date;
  seller: { id: string; businessNameEn: string };
};

/**
 * The document link. It is the one control on this page that reaches outside the
 * console, so it is built to read as a deliberate, audited act rather than as an
 * ordinary link: a file mark, the type, and the filename in mono because a
 * filename is an identifier.
 *
 * The stored value is a private object key, not a URL; the view route mints a
 * short-lived signed link per request. That fact is stated once, as the table's
 * dateline, instead of being invisible.
 */
function DocumentLink({
  doc,
  typeLabel,
  openLabel,
}: {
  doc: ComplianceRow;
  /** Translated in the page: a module-scope helper has no translator in scope. */
  typeLabel: string;
  openLabel: string;
}): ReactNode {
  return (
    <a
      href={`/documents/${doc.id}/view`}
      target="_blank"
      rel="noopener noreferrer"
      className="u-focus inline-flex max-w-[26ch] items-start gap-1.5 rounded-nested text-ink-1 hover:text-primary-ink"
    >
      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-medium">{typeLabel}</span>
        <span className="u-meta u-mono block truncate text-ink-3">{doc.fileName}</span>
        {/* Every icon-only or ambiguous target needs its destination said out
            loud; a new tab that is not announced is a navigation the reader
            cannot undo. */}
        <span className="sr-only">{openLabel}</span>
      </span>
    </a>
  );
}

/**
 * The expiry column: a date, plus the one derived fact an operator acts on.
 * Its three words are passed in, for the same reason DocumentLink's are.
 */
function Expiry({
  date,
  labels,
}: {
  date: Date | null;
  labels: { notRecorded: string; past: string; soon: string };
}): ReactNode {
  if (!date) return <span className="u-meta text-ink-3">{labels.notRecorded}</span>;
  const now = new Date();
  const expired = !isAfter(date, now);
  const soon = !expired && !isAfter(date, addDays(now, 30));
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="tnum">{format(date, "MMM d, yyyy")}</span>
      {expired && <StatusPill tone="danger">{labels.past}</StatusPill>}
      {soon && <StatusPill tone="warning">{labels.soon}</StatusPill>}
    </span>
  );
}

export default async function AdminCompliancePage() {
  await requireAdminSession();
  const t = await getTranslations("adminReview");
  const pendingCount = await db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } });

  const docs = await db.sellerDocument.findMany({
    where: { status: { in: ["PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED"] } },
    orderBy: [{ status: "asc" }, { uploadedAt: "desc" }],
    take: 100,
    include: { seller: { select: { id: true, businessNameEn: true } } },
  });

  // The query orders by status alphabetically, which buries PENDING_REVIEW under
  // APPROVED and EXPIRED — the one queue an operator opens this page to work was
  // the hardest thing on it to find. Splitting the rows that are already loaded
  // puts the work first without changing what is fetched.
  const pending = docs.filter((doc) => doc.status === "PENDING_REVIEW");
  const decided = docs.filter((doc) => doc.status !== "PENDING_REVIEW");

  const expiryLabels = {
    notRecorded: t("compliance.expiry.notRecorded"),
    past: t("compliance.expiry.past"),
    soon: t("compliance.expiry.soon"),
  };
  const openLabel = t("compliance.openInNewTab");

  const sellerCell = (doc: ComplianceRow) => (
    <Link href={`/sellers/${doc.seller.id}`} className="u-focus rounded-nested text-primary-ink hover:underline">
      {doc.seller.businessNameEn}
    </Link>
  );

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("compliance.eyebrow")}
          title={t("compliance.title")}
          // LAW E. `pending` is what survived the take:100, and the query orders
          // by status ALPHABETICALLY — APPROVED and EXPIRED load before
          // PENDING_REVIEW — so this number is a count of what is on this page
          // and can never be a count of the queue. It is stated as exactly that.
          // A figure the reader cannot check is worse than no figure.
          description={t("compliance.description", {
            count: pending.length,
            pending: pending.length.toLocaleString("en-US"),
            loaded: docs.length.toLocaleString("en-US"),
          })}
          // The stored reference is a private object key, never a URL. Saying so
          // is what makes opening a supplier's trade licence read as an audited
          // act rather than as clicking a file share.
          dateline={t("compliance.dateline")}
        />

        <LedgerTable<ComplianceRow>
          title={t("compliance.pending.title")}
          dateline={t("compliance.pending.dateline", { loaded: docs.length.toLocaleString("en-US") })}
          rows={pending}
          getRowKey={(doc) => doc.id}
          stickyHead
          columns={[
            { key: "seller", label: t("compliance.columns.seller"), render: sellerCell },
            {
              key: "document",
              label: t("compliance.columns.document"),
              render: (doc) => (
                <DocumentLink doc={doc} typeLabel={documentTypeLabel(t, doc.type)} openLabel={openLabel} />
              ),
            },
            {
              key: "expiry",
              label: t("compliance.columns.expiry"),
              render: (doc) => <Expiry date={doc.expiryDate} labels={expiryLabels} />,
            },
            {
              key: "uploaded",
              label: t("compliance.columns.uploaded"),
              hideOnMobile: true,
              render: (doc) => <span className="tnum text-ink-2">{format(doc.uploadedAt, "MMM d, yyyy")}</span>,
            },
            {
              key: "review",
              label: t("compliance.columns.decision"),
              align: "end",
              render: (doc) => (
                <Button variant="secondary" size="xs" asChild>
                  {/* The decision itself is taken on the seller's record, where
                      the rest of the evidence for that application lives. */}
                  <Link href={`/sellers/${doc.seller.id}`}>
                    {t("compliance.review")}
                    <span className="sr-only">
                      {t("compliance.reviewSr", {
                        type: documentTypeLabel(t, doc.type),
                        seller: doc.seller.businessNameEn,
                      })}
                    </span>
                  </Link>
                </Button>
              ),
            },
          ]}
          empty={
            <EmptyState
              variant="certificate"
              glyph={<FileCheck />}
              eyebrow={t("compliance.pending.empty.eyebrow")}
              headline={t("compliance.pending.empty.headline")}
              body={t("compliance.pending.empty.body")}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/sellers/pending">{t("compliance.pending.empty.action")}</Link>
                </Button>
              }
            />
          }
        />

        <LedgerTable<ComplianceRow>
          title={t("compliance.decided.title")}
          dateline={t("compliance.decided.dateline")}
          rows={decided}
          getRowKey={(doc) => doc.id}
          density="compact"
          columns={[
            { key: "seller", label: t("compliance.columns.seller"), render: sellerCell },
            {
              key: "document",
              label: t("compliance.columns.document"),
              render: (doc) => (
                <DocumentLink doc={doc} typeLabel={documentTypeLabel(t, doc.type)} openLabel={openLabel} />
              ),
            },
            {
              key: "status",
              label: t("compliance.columns.status"),
              render: (doc) => (
                <StatusPill tone={STATUS_TONE[doc.status] ?? "neutral"}>{statusLabel(t, doc.status)}</StatusPill>
              ),
            },
            {
              key: "expiry",
              label: t("compliance.columns.expiry"),
              render: (doc) => <Expiry date={doc.expiryDate} labels={expiryLabels} />,
            },
            {
              key: "uploaded",
              label: t("compliance.columns.uploaded"),
              hideOnMobile: true,
              render: (doc) => <span className="tnum text-ink-2">{format(doc.uploadedAt, "MMM d, yyyy")}</span>,
            },
          ]}
          footer={t("compliance.decided.footer", {
            count: decided.length,
            total: decided.length.toLocaleString("en-US"),
          })}
          empty={
            <EmptyState
              eyebrow={t("compliance.decided.empty.eyebrow")}
              headline={t("compliance.decided.empty.headline")}
              body={t("compliance.decided.empty.body")}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
