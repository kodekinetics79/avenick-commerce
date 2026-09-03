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

const STATUS_CONFIG: Record<EffectiveStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  APPROVED: { label: "Valid", color: "bg-success/15 text-success border-success/30", icon: CheckCircle },
  PENDING_REVIEW: { label: "Under Review", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: Clock },
  REJECTED: { label: "Rejected", color: "bg-danger/15 text-danger border-danger/30", icon: XCircle },
  EXPIRED: { label: "Expired", color: "bg-danger/15 text-danger border-danger/30", icon: XCircle },
  SUPERSEDED: { label: "Replaced", color: "bg-muted text-muted-foreground border-border", icon: RefreshCw },
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

const TRIGGER_PRIMARY =
  "flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm";
const TRIGGER_ROW_PRIMARY =
  "flex-1 flex items-center justify-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors";
const TRIGGER_ROW_SECONDARY =
  "flex-1 flex items-center justify-center gap-1.5 text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors";

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
    select: { id: true, type: true, status: true, fileName: true, expiryDate: true, rejectionReason: true, uploadedAt: true },
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
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Document Center</h1>
              <p className="text-muted-foreground text-sm">Manage your compliance and business documents</p>
            </div>
            <UploadDocumentButton className={TRIGGER_PRIMARY}>
              <Upload className="h-4 w-4" /> Upload Document
            </UploadDocumentButton>
          </div>

          {seller.status === "PENDING_REVIEW" && (
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Your application is under review — upload the documents below to complete it.</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Each upload is reviewed by the platform team. Its status changes here once a decision is made.
                </p>
              </div>
            </div>
          )}

          {!canManage && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              Your role can view these documents but not upload them; a member with the documents-manage capability can.
            </p>
          )}

          {/* Uploader — the form, or the honest disabled state when storage is not configured. */}
          <UploadDocumentPanel />

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mb-2" />
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{validDocs.length}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Valid Documents</p>
            </div>
            <div className={`rounded-2xl border p-4 ${expiringDocs.length > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-card border-border"}`}>
              <AlertTriangle className={`h-4 w-4 mb-2 ${expiringDocs.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
              <p className={`text-2xl font-bold ${expiringDocs.length > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>{expiringDocs.length}</p>
              <p className={`text-xs mt-0.5 ${expiringDocs.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>Expiring Soon</p>
            </div>
            <div className={`rounded-2xl border p-4 ${expiredDocs.length > 0 ? "bg-red-500/10 border-red-500/20" : "bg-card border-border"}`}>
              <XCircle className={`h-4 w-4 mb-2 ${expiredDocs.length > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
              <p className={`text-2xl font-bold ${expiredDocs.length > 0 ? "text-red-700 dark:text-red-400" : ""}`}>{expiredDocs.length}</p>
              <p className={`text-xs mt-0.5 ${expiredDocs.length > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>Expired</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <Clock className="h-4 w-4 text-yellow-500 mb-2" />
              <p className="text-2xl font-bold">{underReview.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Under Review</p>
            </div>
          </div>

          {/* Alert banners — the action opens the uploader preset to the first affected type. */}
          {expiredDocs.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-700 dark:text-red-400 text-sm">{expiredDocs.length} document{expiredDocs.length > 1 ? "s" : ""} expired — Action required</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{expiredDocs.map((d) => d.name).join(", ")} — upload a renewed copy so the review team can re-approve it.</p>
              </div>
              <UploadDocumentButton
                type={expiredDocs[0]!.type}
                className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-colors"
              >
                Renew Now
              </UploadDocumentButton>
            </div>
          )}
          {expiringDocs.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">{expiringDocs.length} document{expiringDocs.length > 1 ? "s" : ""} expiring within {EXPIRY_WARNING_DAYS} days</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{expiringDocs.map((d) => d.name).join(", ")} — upload renewed copies before they lapse. The current approval stays valid until the renewal is decided.</p>
              </div>
              <UploadDocumentButton
                type={expiringDocs[0]!.type}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-colors"
              >
                Upload Renewal
              </UploadDocumentButton>
            </div>
          )}

          {/* Documents grid */}
          {documents.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border px-5 py-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium mt-3">No documents are recorded for this account</p>
              <p className="text-xs text-muted-foreground mt-1">
                Nothing has been filed against {seller.businessNameEn} yet.
                {canManage && uploadsEnabled ? " Use “Upload Document” to submit your first one." : ""}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div
                    key={doc.id}
                    className={`bg-card rounded-2xl border p-4 hover:shadow-sm transition-shadow ${
                      expired ? "border-red-500/20 bg-red-500/5" :
                      expiring ? "border-amber-500/20 bg-amber-500/5" :
                      "border-border"
                    }`}
                  >
                    {/* Icon + status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Name + type */}
                    <h3 className="font-semibold text-sm text-foreground mb-0.5 truncate" title={doc.name}>{doc.name}</h3>
                    <p className="text-xs text-muted-foreground mb-1">{doc.typeLabel}</p>
                    <p className="text-xs text-muted-foreground mb-3">Uploaded {fmtDate(doc.uploadedAt)}</p>

                    {/* Expiry info */}
                    {doc.expiryDate && (
                      <div className={`flex items-center gap-1.5 text-xs mb-3 ${expired ? "text-red-600 dark:text-red-400" : expiring ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>
                          {isExpired(doc.expiryDate) ? "Expired on " : "Expires "}
                          {fmtDate(doc.expiryDate)}
                          {daysLeft !== null && (
                            <span className={`ml-1 font-semibold ${expiring ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                              ({daysLeft > 0 ? `${daysLeft} days left` : "today"})
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Admin's reason, when there is one. A replaced row explains itself through its badge. */}
                    {doc.status === "REJECTED" && doc.rejectionReason && (
                      <p className="text-xs text-red-600 dark:text-red-400 mb-3">{doc.rejectionReason}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <a
                        href={`/documents/${doc.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={TRIGGER_ROW_SECONDARY}
                      >
                        <Eye className="h-3 w-3" /> View
                      </a>
                      {followUp && (
                        <UploadDocumentButton type={doc.type} className={followUp.primary ? TRIGGER_ROW_PRIMARY : TRIGGER_ROW_SECONDARY}>
                          {followUp.primary ? <RefreshCw className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
                          {followUp.label}
                        </UploadDocumentButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DocumentUploader>
    </SellerLayout>
  );
}
