import type { ReactNode } from "react";
import { requireAdminSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import { format, addDays, isAfter } from "date-fns";
import Link from "next/link";
import { FileText, FileCheck } from "lucide-react";
import { Button, EmptyState, LedgerTable, PageHeader, StatusPill, type PillTone } from "@avenick/ui";

export const metadata = { title: "Compliance" };

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
function DocumentLink({ doc }: { doc: ComplianceRow }): ReactNode {
  return (
    <a
      href={`/documents/${doc.id}/view`}
      target="_blank"
      rel="noopener noreferrer"
      className="u-focus inline-flex max-w-[26ch] items-start gap-1.5 rounded-nested text-ink-1 hover:text-primary-ink"
    >
      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-medium">{doc.type.replace(/_/g, " ")}</span>
        <span className="u-meta u-mono block truncate text-ink-3">{doc.fileName}</span>
        {/* Every icon-only or ambiguous target needs its destination said out
            loud; a new tab that is not announced is a navigation the reader
            cannot undo. */}
        <span className="sr-only">Open the filed document in a new tab</span>
      </span>
    </a>
  );
}

/** The expiry column: a date, plus the one derived fact an operator acts on. */
function Expiry({ date }: { date: Date | null }): ReactNode {
  if (!date) return <span className="u-meta text-ink-3">Not recorded</span>;
  const now = new Date();
  const expired = !isAfter(date, now);
  const soon = !expired && !isAfter(date, addDays(now, 30));
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="tnum">{format(date, "MMM d, yyyy")}</span>
      {expired && <StatusPill tone="danger">Past expiry</StatusPill>}
      {soon && <StatusPill tone="warning">Within 30 days</StatusPill>}
    </span>
  );
}

export default async function AdminCompliancePage() {
  await requireAdminSession();
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

  const sellerCell = (doc: ComplianceRow) => (
    <Link href={`/sellers/${doc.seller.id}`} className="u-focus rounded-nested text-primary-ink hover:underline">
      {doc.seller.businessNameEn}
    </Link>
  );

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Compliance"
          title="Compliance documents"
          // LAW E. `pending` is what survived the take:100, and the query orders
          // by status ALPHABETICALLY — APPROVED and EXPIRED load before
          // PENDING_REVIEW — so this number is a count of what is on this page
          // and can never be a count of the queue. It is stated as exactly that.
          // A figure the reader cannot check is worse than no figure.
          description={
            pending.length === 1
              ? `1 of the ${docs.length} filings loaded here is awaiting review.`
              : `${pending.length} of the ${docs.length} filings loaded here are awaiting review.`
          }
          // The stored reference is a private object key, never a URL. Saying so
          // is what makes opening a supplier's trade licence read as an audited
          // act rather than as clicking a file share.
          dateline="Seller-filed documents, ordered by status then upload date · at most 100 loaded · each file opens through a short-lived signed link minted per request"
        />

        <LedgerTable<ComplianceRow>
          title="Awaiting review"
          dateline={`Filed by the seller and not yet decided by an administrator · only filings inside the ${docs.length} rows loaded on this page appear here`}
          rows={pending}
          getRowKey={(doc) => doc.id}
          stickyHead
          columns={[
            { key: "seller", label: "Seller", render: sellerCell },
            { key: "document", label: "Document", render: (doc) => <DocumentLink doc={doc} /> },
            { key: "expiry", label: "Expiry", render: (doc) => <Expiry date={doc.expiryDate} /> },
            {
              key: "uploaded",
              label: "Uploaded",
              hideOnMobile: true,
              render: (doc) => <span className="tnum text-ink-2">{format(doc.uploadedAt, "MMM d, yyyy")}</span>,
            },
            {
              key: "review",
              label: "Decision",
              align: "end",
              render: (doc) => (
                <Button variant="secondary" size="xs" asChild>
                  {/* The decision itself is taken on the seller's record, where
                      the rest of the evidence for that application lives. */}
                  <Link href={`/sellers/${doc.seller.id}`}>
                    Review<span className="sr-only"> {doc.type.replace(/_/g, " ")} for {doc.seller.businessNameEn}</span>
                  </Link>
                </Button>
              ),
            },
          ]}
          empty={
            <EmptyState
              variant="certificate"
              glyph={<FileCheck />}
              eyebrow="Nothing awaiting review"
              headline="No compliance document is waiting on an administrator."
              body="A filing appears here the moment a supplier submits one, and leaves it as soon as somebody approves, rejects or lets it expire. Everything already decided is in the register below."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/sellers/pending">Review supplier applications</Link>
                </Button>
              }
            />
          }
        />

        <LedgerTable<ComplianceRow>
          title="Already decided"
          dateline="Approved, rejected and expired filings, newest upload first"
          rows={decided}
          getRowKey={(doc) => doc.id}
          density="compact"
          columns={[
            { key: "seller", label: "Seller", render: sellerCell },
            { key: "document", label: "Document", render: (doc) => <DocumentLink doc={doc} /> },
            {
              key: "status",
              label: "Status",
              render: (doc) => (
                <StatusPill tone={STATUS_TONE[doc.status] ?? "neutral"}>{doc.status.replace(/_/g, " ")}</StatusPill>
              ),
            },
            { key: "expiry", label: "Expiry", render: (doc) => <Expiry date={doc.expiryDate} /> },
            {
              key: "uploaded",
              label: "Uploaded",
              hideOnMobile: true,
              render: (doc) => <span className="tnum text-ink-2">{format(doc.uploadedAt, "MMM d, yyyy")}</span>,
            },
          ]}
          footer={`${decided.length} decided ${decided.length === 1 ? "document" : "documents"} loaded`}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No decided document is in the loaded set."
              body="Approved, rejected and expired filings appear here once a decision is written."
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
