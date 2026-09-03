import { ONBOARDING_SELLER_STATUSES, requireSellerAnyPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import {
  SELLER_DOCUMENT_TYPES,
  SELLER_DOCUMENT_TYPE_LABELS,
  SUPERSEDED_REJECTION_REASON,
  db,
  documentTypeExpires,
  type DocumentStatus,
  type DocumentType,
} from "@avenick/database";
import { UPLOAD_POLICIES, browserDirectUploadsEnabled } from "@avenick/utils/browser-upload-policy";
import { cn } from "@avenick/utils";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  FieldWell,
  PageHeader,
  Stat,
  StatusPill,
  Surface,
  TierMark,
  type PillTone,
} from "@avenick/ui";
import { AlertTriangle, Upload, CheckCircle, Clock, XCircle, FileText, Calendar, RefreshCw, Eye, Info } from "lucide-react";
import { DocumentUploader, UploadDocumentButton, UploadDocumentPanel, type DocumentTypeOption } from "./upload-document";
import { documentIsInDate } from "../onboarding/document-selection";

export const metadata = { title: "Document Center" };

// Every row and every count here belongs to the acting seller; nothing may be
// prerendered or shared between sellers.
export const dynamic = "force-dynamic";

/**
 * What a row means to the seller right now. APPROVED past its expiry date is
 * EXPIRED (nothing sweeps expiry into the column, so it is derived on read,
 * the same way /onboarding and /compliance do it). A REJECTED row carrying
 * the supersession reason was replaced by the seller's own newer upload, not
 * refused by an admin, and is labelled as such.
 */
type EffectiveStatus = DocumentStatus | "SUPERSEDED";

// Enum → label map, plus the semantic tone. Four states, not five hues: a
// replaced row is neutral because nothing is owed on it.
const STATUS_CONFIG: Record<EffectiveStatus, { label: string; tone: PillTone; icon: typeof CheckCircle }> = {
  APPROVED: { label: "Valid", tone: "success", icon: CheckCircle },
  PENDING_REVIEW: { label: "Under review", tone: "warning", icon: Clock },
  REJECTED: { label: "Rejected", tone: "danger", icon: XCircle },
  EXPIRED: { label: "Expired", tone: "danger", icon: XCircle },
  SUPERSEDED: { label: "Replaced", tone: "neutral", icon: RefreshCw },
};

/** How far ahead of a lapse the seller is warned; the copy quotes this same value. */
const EXPIRY_WARNING_DAYS = 30;

function daysUntilExpiry(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function isExpiringSoon(d: Date): boolean {
  const days = daysUntilExpiry(d);
  return days <= EXPIRY_WARNING_DAYS && days > 0;
}
// Same boundary as onboarding's documentIsInDate (expiry at the current
// instant counts as expired) so the two pages never disagree about a row.
function isExpired(d: Date): boolean {
  return !documentIsInDate({ expiryDate: d }, new Date());
}
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function effectiveStatus(doc: { status: DocumentStatus; expiryDate: Date | null; rejectionReason: string | null }): EffectiveStatus {
  if (doc.status === "REJECTED" && doc.rejectionReason === SUPERSEDED_REJECTION_REASON) return "SUPERSEDED";
  if (doc.status === "APPROVED" && doc.expiryDate && isExpired(doc.expiryDate)) return "EXPIRED";
  return doc.status;
}

const DOCUMENT_POLICY = UPLOAD_POLICIES["seller-document"];

const TYPE_OPTIONS: readonly DocumentTypeOption[] = SELLER_DOCUMENT_TYPES.map((type) => ({
  value: type,
  label: SELLER_DOCUMENT_TYPE_LABELS[type],
  expires: documentTypeExpires(type),
}));

function isDocumentType(value: string | undefined): value is DocumentType {
  return typeof value === "string" && (SELLER_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export default async function DocumentsPage({ searchParams }: { searchParams?: { upload?: string } }) {
  // PENDING_REVIEW is admitted on purpose: this is the page a seller under
  // review needs in order to file the evidence the review is waiting on.
  const { seller, membership } = await requireSellerAnyPermission(["documents.view", "documents.manage"], {
    allowedSellerStatuses: ONBOARDING_SELLER_STATUSES,
  });
  const permissions = membership.permissions ?? [];
  const canManage = permissions.includes("*") || permissions.includes("documents.manage");
  const uploadsEnabled = browserDirectUploadsEnabled();

  const raw = await db.sellerDocument.findMany({
    where: { sellerId: seller.id },
    orderBy: { uploadedAt: "desc" },
    // reviewedAt is selected for ONE reason: it is the citation the verification
    // seal below is welded to. The seal throws in development without a `basis`
    // string, and the basis has to name the document that was reviewed AND when
    // — "Trade licence reviewed 14 Feb 2026" — because a brass mark reading
    // "Verified" with no reviewed row behind it is a fabricated trust signal
    // rendered in CSS. Same where clause, same scope, same reader: one more
    // scalar off a row this page already reads.
    select: {
      id: true,
      type: true,
      status: true,
      fileName: true,
      expiryDate: true,
      rejectionReason: true,
      uploadedAt: true,
      reviewedAt: true,
    },
  });
  const documents = raw.map((d) => ({
    id: d.id,
    name: d.fileName || SELLER_DOCUMENT_TYPE_LABELS[d.type],
    type: d.type,
    typeLabel: SELLER_DOCUMENT_TYPE_LABELS[d.type],
    status: effectiveStatus(d),
    expiryDate: d.expiryDate,
    rejectionReason: d.rejectionReason,
    uploadedAt: d.uploadedAt,
    reviewedAt: d.reviewedAt,
  }));

  // Expiry only matters on a document that is (or was) valid: a rejected or
  // replaced row lapsing is not something the seller needs to act on.
  const live = documents.filter((d) => d.status === "APPROVED" || d.status === "EXPIRED" || d.status === "PENDING_REVIEW");
  const expiringDocs = live.filter((d) => d.expiryDate && isExpiringSoon(d.expiryDate));
  const expiredDocs = live.filter((d) => d.status === "EXPIRED" || (d.expiryDate && isExpired(d.expiryDate)));
  // An approval that is still in date is valid, including one lapsing soon:
  // "expiring" is a warning about a valid document, not a different bucket.
  const validDocs = documents.filter((d) => d.status === "APPROVED");
  const underReview = documents.filter((d) => d.status === "PENDING_REVIEW");

  /**
   * THE SEAL'S BASIS, and the seal does not exist without it.
   *
   * The single most recently reviewed document that is APPROVED right now AND
   * carries a real reviewedAt. Every one of those three conditions is load
   * bearing: an approval with a null reviewedAt cannot be dated, so it cites
   * nothing and gets no mark; an EXPIRED row was approved once and is not
   * approved now; and taking the most recent keeps this to ONE seal, which is
   * the per-viewport budget. If nothing qualifies, `sealBasis` is null and the
   * mark is not rendered at all — the surface says what is true instead.
   */
  const sealSource = validDocs
    .filter((d): d is typeof d & { reviewedAt: Date } => d.reviewedAt !== null)
    .sort((a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime())[0] ?? null;
  const sealBasis = sealSource ? `${sealSource.typeLabel} reviewed ${fmtDate(sealSource.reviewedAt)}` : null;

  // Deep link: /documents?upload=TRADE_LICENSE opens the form preset to that
  // type; any other value opens it unpreset. The value is only ever matched
  // against the enum, never echoed.
  const uploadParam = searchParams?.upload;
  const initialOpen = uploadParam !== undefined;
  const initialType = isDocumentType(uploadParam) ? uploadParam : null;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <DocumentUploader
        enabled={uploadsEnabled}
        canManage={canManage}
        types={TYPE_OPTIONS}
        maxBytes={DOCUMENT_POLICY.maxBytes}
        accept={Object.keys(DOCUMENT_POLICY.mediaTypesByExtension).sort().join(",")}
        initialOpen={initialOpen}
        initialType={initialType}
      >
        <div className="space-y-block">
          <PageHeader
            eyebrow="Compliance"
            title="Document Center"
            description="Every compliance and business document filed against this account."
            // Expiry is derived on read rather than swept into a column, so the
            // page says which clock it is reading.
            dateline={`Status as at page load · a document is expired the moment its expiry date passes · warnings start ${EXPIRY_WARNING_DAYS} days out`}
            actions={
              <UploadDocumentButton variant="primary" size="sm">
                <Upload className="h-4 w-4" aria-hidden="true" /> Upload document
              </UploadDocumentButton>
            }
          />

          {seller.status === "PENDING_REVIEW" && (
            <FieldWell className="flex items-start gap-3 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
              <div className="min-w-0">
                <p className="u-ui font-medium text-ink-1">
                  Your application is under review — upload the documents below to complete it.
                </p>
                <p className="u-meta mt-0.5 text-ink-2">
                  Each upload is reviewed by the platform team. Its status changes here once a decision is made.
                </p>
              </div>
            </FieldWell>
          )}

          {!canManage && (
            <p className="u-ui flex items-start gap-2 text-ink-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
              Your role can view these documents but not upload them; a member with the documents-manage capability can.
            </p>
          )}

          {/* Uploader — the form, or the honest disabled state when storage is not configured. */}
          <UploadDocumentPanel />

          {/* ══ COMPLIANCE STANDING ══
              The one place in the seller portal that holds the fact the seal must
              cite, so it is the one place the seal belongs — and there is exactly
              one of it, which is the per-viewport budget. On hover or keyboard
              focus a single arc of brass light travels once around the mark's 1px
              border and stops. It is the most beautiful gesture in the product,
              and it is welded to a SellerDocument row that is APPROVED right now
              and carries a real reviewedAt.

              When no row qualifies there is no mark, no greyed-out mark and no
              "pending verification" placeholder — the plate states what the
              records actually say. A trust signal that appears before the fact it
              claims is the one unsurvivable failure in this product.

              The ruling sits on an inner element rather than on the plate: the
              shoulder and the ruling are both drawn by a ::before, and an element
              has only one, so `rim` and [data-rule-ground] on the same node lose
              the shoulder silently. */}
          <Surface rung={2} rim className="overflow-hidden">
            <div data-rule-ground="" className="p-5 [&>*]:relative">
              <Eyebrow>Compliance standing</Eyebrow>
              {sealBasis ? (
                <>
                  <div className="mt-2">
                    <TierMark verified basis={sealBasis} verifiedLabel="Reviewed" showBasis />
                  </div>
                  <p className="u-body mt-2 max-w-desc text-ink-2">
                    {validDocs.length} document{validDocs.length === 1 ? "" : "s"} on this account {validDocs.length === 1 ? "is" : "are"}{" "}
                    approved and in date.
                    {underReview.length > 0 &&
                      ` ${underReview.length} more ${underReview.length === 1 ? "is" : "are"} with the review team.`}
                  </p>
                  <Dateline className="mt-1">
                    The mark cites the most recently reviewed approval on file. It is drawn from that row and disappears
                    with it.
                  </Dateline>
                </>
              ) : (
                <>
                  {/* The provenance voice, because this is a statement of fact about
                      the records rather than a status. */}
                  <p className="u-provenance mt-2 max-w-desc text-h2 text-ink-1">
                    {documents.length === 0
                      ? "Nothing has been filed against this account yet."
                      : underReview.length > 0
                        ? "Nothing is approved yet — your filings are with the review team."
                        : "No filing on this account is currently approved and in date."}
                  </p>
                  <Dateline className="mt-2">
                    No verification mark is shown, because there is no reviewed approval to cite. One appears here as soon
                    as the platform approves a document and records when it did.
                  </Dateline>
                </>
              )}
            </div>
          </Surface>

          {/* One panel divided by hairlines. Four separately tinted boxes in
              four hues said nothing the four labels did not already say. */}
          <CellGrid cols={{ base: 2, lg: 4 }}>
            <Stat
              label="Valid documents"
              value={validDocs.length}
              rank="section"
              icon={CheckCircle}
              chip={validDocs.length > 0 ? "success" : "neutral"}
            />
            <Stat
              label="Expiring soon"
              value={expiringDocs.length}
              icon={AlertTriangle}
              chip={expiringDocs.length > 0 ? "warning" : "neutral"}
              note={`Within ${EXPIRY_WARNING_DAYS} days`}
            />
            <Stat
              label="Expired"
              value={expiredDocs.length}
              icon={XCircle}
              chip={expiredDocs.length > 0 ? "danger" : "neutral"}
            />
            <Stat label="Under review" value={underReview.length} icon={Clock} chip="neutral" />
          </CellGrid>

          {/* One "action required" well instead of two banners stacked above the
              list. Each row keeps its own sentence and its own deep link, so the
              uploader still opens preset to the type that needs filing. */}
          {(expiredDocs.length > 0 || expiringDocs.length > 0) && (
            <section aria-label="Action required" className="space-y-2">
              <Eyebrow as="h2">Action required</Eyebrow>
              <Surface rung={1} className="divide-y divide-hairline overflow-hidden">
                {expiredDocs.length > 0 && (
                  <div className="flex flex-wrap items-start gap-3 border-s-[3px] border-s-danger px-4 py-3">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="u-ui font-medium text-ink-1">
                        {expiredDocs.length} document{expiredDocs.length > 1 ? "s" : ""} expired — action required
                      </p>
                      <p className="u-meta mt-0.5 text-ink-2">
                        {expiredDocs.map((d) => d.name).join(", ")} — upload a renewed copy so the review team can
                        re-approve it.
                      </p>
                    </div>
                    <UploadDocumentButton type={expiredDocs[0]!.type} variant="secondary" size="sm" className="shrink-0">
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Renew now
                    </UploadDocumentButton>
                  </div>
                )}
                {expiringDocs.length > 0 && (
                  <div className="flex flex-wrap items-start gap-3 border-s-[3px] border-s-warning px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="u-ui font-medium text-ink-1">
                        {expiringDocs.length} document{expiringDocs.length > 1 ? "s" : ""} expiring within{" "}
                        {EXPIRY_WARNING_DAYS} days
                      </p>
                      <p className="u-meta mt-0.5 text-ink-2">
                        {expiringDocs.map((d) => d.name).join(", ")} — upload renewed copies before they lapse. The
                        current approval stays valid until the renewal is decided.
                      </p>
                    </div>
                    <UploadDocumentButton type={expiringDocs[0]!.type} variant="secondary" size="sm" className="shrink-0">
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" /> Upload renewal
                    </UploadDocumentButton>
                  </div>
                )}
              </Surface>
            </section>
          )}

          {/* The filing itself */}
          {documents.length === 0 ? (
            <Surface rung={1}>
              <EmptyState
                eyebrow="Nothing recorded"
                headline={`No document has been filed against ${seller.businessNameEn}.`}
                body={
                  canManage && uploadsEnabled
                    ? "Use “Upload document” above to submit the first one; the review team decides on it from there."
                    : "Documents filed for this account will be listed here."
                }
                icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            </Surface>
          ) : (
            <section aria-label="Filed documents" className="space-y-2">
              <Eyebrow as="h2">On file — {documents.length}</Eyebrow>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => {
                  const cfg = STATUS_CONFIG[doc.status];
                  const StatusIcon = cfg.icon;
                  const expired = doc.status === "EXPIRED";
                  const expiring = !expired && doc.status === "APPROVED" && doc.expiryDate ? isExpiringSoon(doc.expiryDate) : false;
                  const daysLeft = doc.expiryDate && !isExpired(doc.expiryDate) ? daysUntilExpiry(doc.expiryDate) : null;
                  // Which follow-up makes sense depends on where the row is:
                  // renew a lapsed or lapsing approval, re-upload a refusal,
                  // replace an open review, and leave a valid or replaced row alone
                  // beyond the general upload button.
                  const followUp =
                    expired ? { label: "Renew", primary: true }
                    : expiring ? { label: "Renew", primary: true }
                    : doc.status === "REJECTED" ? { label: "Re-upload", primary: true }
                    : doc.status === "PENDING_REVIEW" ? { label: "Replace", primary: false }
                    : null;

                  return (
                    <Surface
                      key={doc.id}
                      rung={2}
                      // The card wears the state: a lapsed or lapsing filing is a
                      // toned surface with a thicker inline-start edge, so the
                      // grid is readable in one pass without reading a badge.
                      tone={expired ? "danger" : expiring ? "warning" : "default"}
                      className={cn("flex flex-col p-4", (expired || expiring) && "border-s-[3px]")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Eyebrow className="min-w-0 truncate">{doc.typeLabel}</Eyebrow>
                        <StatusPill tone={cfg.tone} className="shrink-0 whitespace-nowrap">
                          <StatusIcon className="h-3 w-3" aria-hidden="true" />
                          {cfg.label}
                        </StatusPill>
                      </div>

                      <p className="u-ui mt-1.5 truncate font-medium text-ink-1" title={doc.name}>
                        {doc.name}
                      </p>
                      <p className="u-meta text-ink-3">Uploaded {fmtDate(doc.uploadedAt)}</p>

                      {doc.expiryDate && (
                        <p
                          className={cn(
                            "u-meta mt-2 flex items-center gap-1.5",
                            expired ? "text-danger-ink" : expiring ? "text-warning-ink" : "text-ink-2",
                          )}
                        >
                          <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>
                            {isExpired(doc.expiryDate) ? "Expired on " : "Expires "}
                            {fmtDate(doc.expiryDate)}
                            {daysLeft !== null && (
                              // ms-1, not ml-1: a physical margin is wrong in Arabic.
                              <span className={cn("ms-1 font-medium", expiring ? "text-warning-ink" : "text-ink-2")}>
                                ({daysLeft > 0 ? `${daysLeft} days left` : "today"})
                              </span>
                            )}
                          </span>
                        </p>
                      )}

                      {/* The admin's reason, when there is one. A replaced row explains itself through its badge. */}
                      {doc.status === "REJECTED" && doc.rejectionReason && (
                        <Dateline className="mt-2 text-danger-ink">{doc.rejectionReason}</Dateline>
                      )}

                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                        <Button variant="ghost" size="sm" asChild>
                          {/* The stored value is a private object key, not a URL;
                              the view route mints a short-lived signed link per
                              request. */}
                          <a href={`/documents/${doc.id}/view`} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> View
                            <span className="sr-only"> {doc.name} (opens in a new tab)</span>
                          </a>
                        </Button>
                        {followUp && (
                          <UploadDocumentButton
                            type={doc.type}
                            variant={followUp.primary ? "secondary" : "ghost"}
                            size="sm"
                          >
                            {followUp.primary ? (
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {followUp.label}
                          </UploadDocumentButton>
                        )}
                      </div>
                    </Surface>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </DocumentUploader>
    </SellerLayout>
  );
}
