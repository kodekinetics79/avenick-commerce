import Link from "next/link";
import { SUPERSEDED_REJECTION_REASON, db, type DocumentStatus, type DocumentType } from "@avenick/database";
import { requireSellerAnyPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { sellerNavigationAllows } from "@/lib/seller-permissions";
import { documentIsInDate, selectGoverningDocuments } from "./document-selection";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle,
  Circle,
  Clock,
  CreditCard,
  FileText,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  User,
  XCircle,
} from "lucide-react";

export const metadata = { title: "Onboarding" };

// Every figure on this page is read from the acting seller's own rows, so it must
// never be prerendered or shared between sellers.
export const dynamic = "force-dynamic";

/**
 * Where a seller goes to see the document rows the platform holds, and to file
 * new ones. The upload path is recordSellerDocument
 * (packages/database/src/services/seller-documents.ts), reached through the
 * Document Center's uploader; `?upload=<DocumentType>` opens it preset.
 */
const DOCUMENT_CENTER_HREF = "/documents";
const DOCUMENT_UPLOAD_HREF = "/documents?upload=1";

/**
 * Compliance documents Avenick expects from every seller. Typed as DocumentType
 * so the list is checked against the Prisma enum at compile time — if the enum
 * changes, this fails to build rather than silently drifting.
 */
const CORE_REQUIRED_DOCUMENTS: ReadonlyArray<{ type: DocumentType; label: string; why: string }> = [
  {
    type: "COMMERCIAL_REGISTRATION",
    label: "Commercial Registration (CR)",
    why: "Required for every seller account.",
  },
  {
    type: "TRADE_LICENSE",
    label: "Trade License",
    why: "Valid trade license from your issuing authority.",
  },
];

/**
 * MISSING is not a DocumentStatus — it means no row exists for that type at all.
 * SUPERSEDED is a REJECTED row carrying SUPERSEDED_REJECTION_REASON: replaced
 * by a newer upload (or a newer approval), never refused by an admin. The
 * Document Center and /compliance label that pair "Replaced", so this page
 * must too, or the same row reads as a refusal here and a replacement there.
 */
type EffectiveDocumentStatus = DocumentStatus | "MISSING" | "SUPERSEDED";

type StepState = "COMPLETE" | "IN_PROGRESS" | "BLOCKED" | "PENDING";

const DOC_STATUS_CONFIG: Record<
  EffectiveDocumentStatus,
  { label: string; className: string; icon: typeof CheckCircle }
> = {
  APPROVED: {
    label: "Approved",
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    icon: CheckCircle,
  },
  PENDING_REVIEW: {
    label: "Under review",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: Clock,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    icon: XCircle,
  },
  EXPIRED: {
    label: "Expired",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    icon: AlertTriangle,
  },
  MISSING: {
    label: "Not on file",
    className: "bg-muted text-muted-foreground border-border",
    icon: Circle,
  },
  SUPERSEDED: {
    label: "Replaced",
    className: "bg-muted text-muted-foreground border-border",
    icon: RefreshCw,
  },
};

const STEP_STATE_CONFIG: Record<StepState, { label: string; badgeClass: string; ringClass: string }> = {
  COMPLETE: {
    label: "Complete",
    badgeClass: "bg-green-500/10 text-green-600 dark:text-green-400",
    ringClass: "bg-green-500/10",
  },
  IN_PROGRESS: {
    label: "In progress",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    ringClass: "bg-orange-500/10",
  },
  BLOCKED: {
    label: "Blocked by platform",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    ringClass: "bg-amber-500/10",
  },
  PENDING: {
    label: "Not started",
    badgeClass: "bg-muted text-muted-foreground",
    ringClass: "bg-muted",
  },
};

const SELLER_STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "Pending review",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
};

/**
 * A row can still read APPROVED after its expiry date has passed, because nothing
 * sweeps expired documents. Only an APPROVED row is corrected to EXPIRED: a
 * pending or refused row past its date is still pending or refused, and that
 * is exactly what /documents and /compliance show for it, so all three
 * surfaces agree on what the same row means. This is the one place on this
 * page that turns a row into a label; the in-date test itself lives in
 * ./document-selection so row selection and labelling read the same boundary.
 */
function effectiveDocumentStatus(
  doc: { status: DocumentStatus; expiryDate: Date | null; rejectionReason: string | null } | undefined,
  now: Date,
): EffectiveDocumentStatus {
  if (!doc) return "MISSING";
  if (doc.status === "REJECTED" && doc.rejectionReason === SUPERSEDED_REJECTION_REASON) return "SUPERSEDED";
  if (doc.status === "APPROVED" && !documentIsInDate(doc, now)) return "EXPIRED";
  return doc.status;
}

/**
 * The note shown under an approved required document when the seller has
 * filed something newer for the same type. The renewal's own label comes from
 * effectiveDocumentStatus like every other row; this only decides the wording
 * and tone of the note. PENDING_REVIEW and REJECTED are the two states a
 * renewal can actually sit in while an approval still holds; the rest are
 * spelled from the shared label so nothing is ever left unsaid.
 */
function renewalNote(status: EffectiveDocumentStatus): { text: string; className: string } {
  switch (status) {
    case "PENDING_REVIEW":
      return { text: "Renewal pending review", className: "text-amber-600 dark:text-amber-400" };
    case "REJECTED":
      return { text: "Renewal rejected", className: "text-red-600 dark:text-red-400" };
    default:
      return { text: `Renewal ${DOC_STATUS_CONFIG[status].label.toLowerCase()}`, className: "text-muted-foreground" };
  }
}

/**
 * Prisma surfaces both SQL NULL and JSON null as `null`, and an empty object is
 * not usable settlement information either — so require at least one key before
 * claiming payout details exist.
 */
function hasPayoutDetails(bankDetails: unknown): boolean {
  return (
    bankDetails !== null &&
    typeof bankDetails === "object" &&
    !Array.isArray(bankDetails) &&
    Object.keys(bankDetails as Record<string, unknown>).length > 0
  );
}

function humaniseDocumentType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export default async function OnboardingPage() {
  const { seller, membership } = await requireSellerAnyPermission(["documents.view", "documents.manage"]);

  // Everything below is scoped to the acting seller resolved from the session.
  // No identifier is taken from the request.
  const [documents, totalProductCount, activeProductCount, orderItemCount] = await Promise.all([
    db.sellerDocument.findMany({
      where: { sellerId: seller.id },
      select: { id: true, type: true, status: true, expiryDate: true, uploadedAt: true, fileName: true, rejectionReason: true },
      orderBy: { uploadedAt: "desc" },
    }),
    db.product.count({ where: { sellerId: seller.id, deletedAt: null } }),
    db.product.count({ where: { sellerId: seller.id, deletedAt: null, status: "ACTIVE" } }),
    db.orderItem.count({ where: { sellerId: seller.id } }),
  ]);

  // One clock for the whole render, so selection and labelling judge expiry at
  // the same instant.
  const now = new Date();

  // The newest row per type is NOT necessarily the one that governs: a seller who
  // files a renewal still holds the in-date APPROVED row that admin approval
  // reads. selectGoverningDocuments prefers that row and hands back the newer
  // row alongside it so both facts can be shown.
  const governingByType = selectGoverningDocuments(documents, now);

  // A VAT certificate is only demanded when the profile actually carries a VAT
  // registration number — that is a real column, not an assumption about the seller.
  const vatRegistered = Boolean(seller.vatNumber?.trim());
  const requiredDocuments = [
    ...CORE_REQUIRED_DOCUMENTS,
    {
      type: "VAT_CERTIFICATE" as DocumentType,
      label: "VAT Certificate",
      why: vatRegistered
        ? `Required because VAT number ${seller.vatNumber} is recorded on your profile.`
        : "Only required if your account carries a VAT registration number. None is recorded on your profile.",
    },
  ];

  const documentRows = requiredDocuments.map((required) => {
    const selected = governingByType.get(required.type);
    const row = selected?.governing;
    const renewal = selected?.renewal ?? null;
    return {
      ...required,
      applicable: required.type !== "VAT_CERTIFICATE" || vatRegistered,
      row,
      status: effectiveDocumentStatus(row, now),
      renewal,
      // Labelled by the same function as the governing row, so a superseded
      // or expired renewal is named as such rather than guessed at.
      renewalStatus: renewal ? effectiveDocumentStatus(renewal, now) : null,
    };
  });

  // Documents the seller genuinely holds that are not on the required list. Showing
  // them keeps the page a complete account of what the database contains.
  const requiredTypes = new Set(requiredDocuments.map((d) => d.type));
  const additionalDocuments = documents.filter((doc) => !requiredTypes.has(doc.type));

  const applicableDocumentRows = documentRows.filter((row) => row.applicable);
  const approvedRequiredCount = applicableDocumentRows.filter((row) => row.status === "APPROVED").length;
  const missingRequiredCount = applicableDocumentRows.filter((row) => row.status === "MISSING").length;
  const documentsComplete =
    applicableDocumentRows.length > 0 && approvedRequiredCount === applicableDocumentRows.length;

  // BLOCKED is reserved for a platform gap the seller cannot act on. Uploads
  // exist now, so a missing document is a step the seller can take.
  const documentStepState: StepState = documentsComplete
    ? "COMPLETE"
    : documents.length > 0
      ? "IN_PROGRESS"
      : "PENDING";

  // Fields the schema already guarantees (business name, CR number, country, city)
  // cannot be absent, so the only honest profile signal is the nullable columns a
  // storefront actually needs. The missing ones are named so the basis is visible.
  const missingProfileFields = [
    seller.businessNameAr?.trim() ? null : "Arabic business name",
    seller.description?.trim() ? null : "Business description",
    seller.logo ? null : "Store logo",
  ].filter((field): field is string => field !== null);
  const profileComplete = missingProfileFields.length === 0;

  const payoutReady = hasPayoutDetails(seller.bankDetails);

  // Owners carry "*"; staff carry explicit grants. Used only to decide whether a
  // step may be linked — every figure above is already scoped to this seller.
  const grantedPermissions = membership.permissions ?? [];

  const steps = [
    {
      id: "profile",
      label: "Business profile",
      icon: User,
      href: "/settings",
      permissions: ["settings.manage"],
      state: (profileComplete ? "COMPLETE" : "IN_PROGRESS") as StepState,
      desc: profileComplete
        ? "Arabic name, description, and logo are all on file."
        : `Still missing: ${missingProfileFields.join(", ")}.`,
    },
    {
      id: "documents",
      label: "Compliance documents",
      icon: ShieldCheck,
      href: DOCUMENT_CENTER_HREF,
      permissions: ["documents.view", "documents.manage"],
      state: documentStepState,
      desc:
        applicableDocumentRows.length === 0
          ? "No compliance documents apply to this account."
          : `${approvedRequiredCount} of ${applicableDocumentRows.length} required document${applicableDocumentRows.length === 1 ? "" : "s"} approved.`,
    },
    {
      id: "payout",
      label: "Payout details",
      icon: CreditCard,
      href: "/settings",
      permissions: ["settings.manage"],
      state: (payoutReady ? "COMPLETE" : "PENDING") as StepState,
      desc: payoutReady
        ? "Bank details are recorded for settlement."
        : "No bank details are recorded on your profile, so payouts cannot be settled.",
    },
    {
      id: "products",
      label: "Product listings",
      icon: Package,
      href: "/products",
      permissions: ["catalog.view", "catalog.manage"],
      state: (activeProductCount > 0
        ? "COMPLETE"
        : totalProductCount > 0
          ? "IN_PROGRESS"
          : "PENDING") as StepState,
      desc:
        totalProductCount === 0
          ? "You have no products in the catalogue yet."
          : `${activeProductCount} active of ${totalProductCount} product${totalProductCount === 1 ? "" : "s"} in your catalogue.`,
    },
    {
      id: "first-order",
      label: "First order",
      icon: ShoppingCart,
      href: "/orders",
      permissions: ["orders.view", "orders.fulfill"],
      state: (orderItemCount > 0 ? "COMPLETE" : "PENDING") as StepState,
      desc:
        orderItemCount > 0
          ? `${orderItemCount} order line${orderItemCount === 1 ? "" : "s"} received to date.`
          : "No buyer has ordered from you yet.",
    },
  ];

  // Derived from the real states above — never a literal.
  const completedSteps = steps.filter((step) => step.state === "COMPLETE").length;
  const progress = Math.round((completedSteps / steps.length) * 100);
  const blockedSteps = steps.filter((step) => step.state === "BLOCKED").length;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="max-w-2xl space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Onboarding</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Account status: {SELLER_STATUS_LABEL[seller.status] ?? seller.status}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Every item below reflects what is recorded for {seller.businessNameEn} right now. Nothing on this page is
            an example.
          </p>
        </div>

        {/* Progress — computed from the step states, which are computed from rows. */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-semibold text-sm">Overall progress</p>
              <p className="text-xs text-muted-foreground">
                {completedSteps} of {steps.length} steps complete
                {blockedSteps > 0 ? ` · ${blockedSteps} blocked by the platform` : ""}
              </p>
            </div>
            <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step list */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const Icon = step.icon;
            const cfg = STEP_STATE_CONFIG[step.state];
            // Each destination enforces its own capability and *throws* when the
            // member lacks it (/settings requires settings.manage, which this page
            // does not). Linking unconditionally would drop a documents-only staff
            // member on an error boundary, so an unreachable step is rendered as
            // plain text instead — the same rule the sidebar already applies.
            const canOpen = sellerNavigationAllows(grantedPermissions, step.permissions);
            const rowClass = `flex items-start gap-4 p-5 ${!isLast ? "border-b border-border" : ""}`;
            const body = (
              <>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${cfg.ringClass}`}>
                  {step.state === "COMPLETE" ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : step.state === "BLOCKED" ? (
                    <Ban className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  ) : step.state === "IN_PROGRESS" ? (
                    <Icon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sm">{step.label}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badgeClass}`}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
                {canOpen && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
              </>
            );
            return canOpen ? (
              <Link
                key={step.id}
                href={step.href}
                className={`${rowClass} hover:bg-muted/30 transition-colors`}
              >
                {body}
              </Link>
            ) : (
              <div key={step.id} className={rowClass}>
                {body}
              </div>
            );
          })}
        </div>

        {/* Required documents — one row per required DocumentType, status from the database. */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Required documents</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Status is read from your document records. A type with no record shows as “Not on file”.
              </p>
            </div>
            <Link
              href={DOCUMENT_CENTER_HREF}
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline shrink-0"
            >
              Document Center
            </Link>
          </div>

          {missingRequiredCount > 0 && (
            <div className="border-b border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
              A document shown as “Not on file” can be submitted from the{" "}
              <Link href={DOCUMENT_UPLOAD_HREF} className="underline font-semibold text-foreground">
                Document Center
              </Link>
              . Each upload is reviewed before it counts as approved.
            </div>
          )}

          <div className="divide-y divide-border">
            {documentRows.map((doc) => {
              const cfg = DOC_STATUS_CONFIG[doc.status];
              const StatusIcon = cfg.icon;
              // The approved row governs; a newer filing is a second fact, not a
              // replacement — and a refused renewal is stated here, reason included,
              // rather than left for the seller to discover in the Document Center.
              const renewal =
                doc.renewal && doc.renewalStatus
                  ? {
                      ...renewalNote(doc.renewalStatus),
                      Icon: DOC_STATUS_CONFIG[doc.renewalStatus].icon,
                      fileName: doc.renewal.fileName,
                      filed: doc.renewal.uploadedAt.toISOString().slice(0, 10),
                      reason:
                        doc.renewalStatus === "REJECTED" && doc.renewal.rejectionReason
                          ? ` — ${doc.renewal.rejectionReason}`
                          : "",
                    }
                  : null;
              return (
                <div key={doc.type} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{doc.label}</p>
                      {!doc.applicable && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          Not required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.why}</p>
                    {doc.row && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {doc.row.fileName} · filed {doc.row.uploadedAt.toISOString().slice(0, 10)}
                        {doc.row.expiryDate ? ` · expires ${doc.row.expiryDate.toISOString().slice(0, 10)}` : ""}
                      </p>
                    )}
                    {/* A supersession reason is not a refusal; the "Replaced" badge already says what happened. */}
                    {doc.status === "REJECTED" && doc.row?.rejectionReason && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{doc.row.rejectionReason}</p>
                    )}
                    {/* Not truncated: a rejection reason is the actionable part and must not be clipped. */}
                    {renewal && (
                      <p className={`text-xs mt-1 flex items-start gap-1 ${renewal.className}`}>
                        <renewal.Icon className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="min-w-0 break-words">
                          {renewal.text} · {renewal.fileName} filed {renewal.filed}
                          {renewal.reason}
                        </span>
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0 ${cfg.className}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>

          {additionalDocuments.length > 0 && (
            <div className="border-t border-border">
              <div className="px-5 py-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Other documents on file
                </p>
              </div>
              <div className="divide-y divide-border">
                {additionalDocuments.map((doc) => {
                  const status = effectiveDocumentStatus(doc, now);
                  const cfg = DOC_STATUS_CONFIG[status];
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{humaniseDocumentType(doc.type)}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0 ${cfg.className}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {documents.length === 0 && (
            <div className="px-5 py-6 text-center border-t border-border">
              <FileText className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium mt-2">No documents are recorded for this account</p>
              <p className="text-xs text-muted-foreground mt-1">
                Nothing has ever been filed against {seller.businessNameEn}. Your compliance obligations are not yet
                satisfied.
              </p>
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
