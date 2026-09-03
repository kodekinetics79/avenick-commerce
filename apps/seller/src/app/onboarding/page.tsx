import Link from "next/link";
import {
  SELLER_DOCUMENT_TYPES,
  SELLER_DOCUMENT_TYPE_LABELS,
  SUPERSEDED_REJECTION_REASON,
  db,
  type DocumentStatus,
  type DocumentType,
} from "@avenick/database";
import { requireSellerAnyPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { sellerNavigationAllows } from "@/lib/seller-permissions";
import { getTranslations } from "next-intl/server";
import { documentIsInDate, selectGoverningDocuments } from "./document-selection";
import { hasPayoutDetails, missingProfileFieldKeys } from "./readiness";
import { cn } from "@avenick/utils";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  FieldWell,
  Meter,
  Num,
  PageHeader,
  SectionHeader,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle,
  Circle,
  Clock,
  CreditCard,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  User,
  XCircle,
} from "lucide-react";

export async function generateMetadata() {
  const t = await getTranslations("sellerRelations");
  return { title: t("onboarding.metaTitle") };
}

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
 * changes, this fails to build rather than silently drifting. The NAME of each
 * comes from sellerRelations.documentType.<TYPE> — the same key the Document
 * Center reads, so the two surfaces cannot name one document differently — and
 * the reason from sellerRelations.onboarding.required.<TYPE>.why.
 */
const CORE_REQUIRED_DOCUMENTS: ReadonlyArray<{ type: DocumentType }> = [
  { type: "COMMERCIAL_REGISTRATION" },
  { type: "TRADE_LICENSE" },
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

// Status → tone, not status → hue. Every one of these used to be a hand-written
// light-only wash (bg-green-500/10, bg-amber-500/10, bg-muted) with no dark
// counterpart; the tones below resolve to token triples that have real values in
// both themes.
// The KEYS are the effective status and are never translated; each label is
// sellerRelations.onboarding.docStatus.<KEY>.
const DOC_STATUS_CONFIG: Record<EffectiveDocumentStatus, { tone: PillTone; icon: typeof CheckCircle }> = {
  APPROVED: { tone: "success", icon: CheckCircle },
  PENDING_REVIEW: { tone: "warning", icon: Clock },
  REJECTED: { tone: "danger", icon: XCircle },
  EXPIRED: { tone: "danger", icon: AlertTriangle },
  MISSING: { tone: "neutral", icon: Circle },
  SUPERSEDED: { tone: "neutral", icon: RefreshCw },
};

// Labels live at sellerRelations.onboarding.stepState.<KEY>.
const STEP_STATE_CONFIG: Record<StepState, { tone: PillTone; ink: string }> = {
  COMPLETE: { tone: "success", ink: "text-success-ink" },
  IN_PROGRESS: { tone: "warning", ink: "text-warning-ink" },
  BLOCKED: { tone: "warning", ink: "text-warning-ink" },
  PENDING: { tone: "neutral", ink: "text-ink-3" },
};

/** Statuses this page knows a label for; anything else prints its raw value. */
const KNOWN_SELLER_STATUSES = ["PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED"] as const;

/** Enum → tone. The pill states the status; it never grades it. */
const SELLER_STATUS_TONE: Record<string, PillTone> = {
  PENDING_REVIEW: "warning",
  ACTIVE: "success",
  SUSPENDED: "danger",
  REJECTED: "danger",
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
function renewalNote(
  status: EffectiveDocumentStatus,
  t: (key: string, values?: Record<string, string | number>) => string,
): { text: string; className: string } {
  switch (status) {
    case "PENDING_REVIEW":
      return { text: t("onboarding.renewal.pending"), className: "text-warning-ink" };
    case "REJECTED":
      return { text: t("onboarding.renewal.rejected"), className: "text-danger-ink" };
    default:
      return {
        text: t("onboarding.renewal.generic", { status: t(`onboarding.docStatus.${status}`).toLowerCase() }),
        className: "text-ink-3",
      };
  }
}

function humaniseDocumentType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * The NAME of a document type, as the Document Center prints it. It comes from
 * the message tree so both surfaces name the same document identically in both
 * languages; SELLER_DOCUMENT_TYPE_LABELS is the fallback for a type the Prisma
 * enum grows before this namespace does, and humaniseDocumentType the last
 * resort so an unknown value still reads as words rather than as an enum.
 */
function documentTypeLabel(type: string, t: (key: string) => string): string {
  if ((SELLER_DOCUMENT_TYPES as readonly string[]).includes(type)) return t(`documentType.${type}`);
  return SELLER_DOCUMENT_TYPE_LABELS[type as DocumentType] ?? humaniseDocumentType(type);
}

export default async function OnboardingPage() {
  const { seller, membership } = await requireSellerAnyPermission(["documents.view", "documents.manage"]);
  const t = await getTranslations("sellerRelations");

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
    ...CORE_REQUIRED_DOCUMENTS.map((d) => ({
      type: d.type,
      label: documentTypeLabel(d.type, t),
      why: t(`onboarding.required.${d.type}.why`),
    })),
    {
      type: "VAT_CERTIFICATE" as DocumentType,
      label: documentTypeLabel("VAT_CERTIFICATE", t),
      why: vatRegistered
        ? t("onboarding.required.VAT_CERTIFICATE.whyRegistered", { vatNumber: seller.vatNumber ?? "" })
        : t("onboarding.required.VAT_CERTIFICATE.whyNotRegistered"),
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

  // The profile and payout tests live in ./readiness because the dashboard's
  // checklist renders the same two claims and used to disagree with this page
  // about both of them.
  const missingProfile = missingProfileFieldKeys(seller).map((key) => t(`onboarding.profileFields.${key}`));
  const profileComplete = missingProfile.length === 0;

  const payoutReady = hasPayoutDetails(seller.bankDetails);

  // Owners carry "*"; staff carry explicit grants. Used only to decide whether a
  // step may be linked — every figure above is already scoped to this seller.
  const grantedPermissions = membership.permissions ?? [];

  const steps = [
    {
      id: "profile",
      label: t("onboarding.steps.profile.label"),
      icon: User,
      href: "/settings",
      permissions: ["settings.manage"],
      state: (profileComplete ? "COMPLETE" : "IN_PROGRESS") as StepState,
      desc: profileComplete
        ? t("onboarding.steps.profile.complete")
        : t("onboarding.steps.profile.missing", { fields: missingProfile.join(t("common.listSeparator")) }),
    },
    {
      id: "documents",
      label: t("onboarding.steps.documents.label"),
      icon: ShieldCheck,
      href: DOCUMENT_CENTER_HREF,
      permissions: ["documents.view", "documents.manage"],
      state: documentStepState,
      desc:
        applicableDocumentRows.length === 0
          ? t("onboarding.steps.documents.none")
          : t("onboarding.steps.documents.approved", {
              count: applicableDocumentRows.length,
              approved: String(approvedRequiredCount),
              n: String(applicableDocumentRows.length),
            }),
    },
    {
      id: "payout",
      label: t("onboarding.steps.payout.label"),
      icon: CreditCard,
      href: "/settings",
      permissions: ["settings.manage"],
      state: (payoutReady ? "COMPLETE" : "PENDING") as StepState,
      desc: payoutReady ? t("onboarding.steps.payout.complete") : t("onboarding.steps.payout.missing"),
    },
    {
      id: "products",
      label: t("onboarding.steps.products.label"),
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
          ? t("onboarding.steps.products.none")
          : t("onboarding.steps.products.active", {
              count: totalProductCount,
              active: String(activeProductCount),
              n: String(totalProductCount),
            }),
    },
    {
      id: "first-order",
      label: t("onboarding.steps.firstOrder.label"),
      icon: ShoppingCart,
      href: "/orders",
      permissions: ["orders.view", "orders.fulfill"],
      state: (orderItemCount > 0 ? "COMPLETE" : "PENDING") as StepState,
      desc:
        orderItemCount > 0
          ? t("onboarding.steps.firstOrder.received", { count: orderItemCount, n: String(orderItemCount) })
          : t("onboarding.steps.firstOrder.none"),
    },
  ];

  // Derived from the real states above — never a literal.
  const completedSteps = steps.filter((step) => step.state === "COMPLETE").length;
  const progress = Math.round((completedSteps / steps.length) * 100);
  const blockedSteps = steps.filter((step) => step.state === "BLOCKED").length;
  /**
   * The first step that is not finished, which is the one this page exists to
   * point at. Undefined once everything is complete, and the list then carries no
   * current marker at all rather than nominating a step arbitrarily.
   */
  const nextStep = steps.find((step) => step.state !== "COMPLETE");

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="max-w-2xl space-y-block">
        <PageHeader
          className="mb-0"
          eyebrow={t("onboarding.eyebrow")}
          title={t("onboarding.title")}
          description={t("onboarding.description", { seller: seller.businessNameEn })}
          actions={
            <StatusPill tone={SELLER_STATUS_TONE[seller.status] ?? "neutral"} dot>
              {t("onboarding.accountStatus", {
                status: (KNOWN_SELLER_STATUSES as readonly string[]).includes(seller.status)
                  ? t(`sellerStatus.${seller.status}`)
                  : seller.status,
              })}
            </StatusPill>
          }
        />

        {/* Progress — computed from the step states, which are computed from rows.
            Recessed, because progress is context for the steps below it rather
            than an object in its own right.

            The figure moved from section rank to hero rank. This is a five-step
            page whose whole job is to answer one question — how far along am I —
            and the answer was set at the same size as every step label under it.
            The console has no display rung by design; the figure ladder is where
            a console gets its range. */}
        <FieldWell className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <Eyebrow>{t("onboarding.overallProgress")}</Eyebrow>
              <div className="mt-1">
                <Num value={progress} unit="%" rank="hero" />
              </div>
            </div>
            <Meter
              className="min-w-[12rem] flex-1"
              value={completedSteps}
              max={steps.length}
              tone="accent"
              size="lg"
              label={t("onboarding.progressMeterLabel", { completed: String(completedSteps), total: String(steps.length) })}
            />
          </div>
          <Dateline className="mt-2">
            {t("onboarding.stepsComplete", { completed: String(completedSteps), total: String(steps.length) })}
            {blockedSteps > 0 ? ` · ${t("onboarding.blockedByPlatform", { n: String(blockedSteps) })}` : ""}
            {nextStep
              ? ` · ${t("onboarding.nextIs", { step: nextStep.label.toLowerCase() })}`
              : ` · ${t("onboarding.nothingOutstanding")}`}
          </Dateline>
        </FieldWell>

        {/* Step list. It is a SEQUENCE, not five equal rows: the first step that
            is not complete carries the brass drawn rule down its inline start —
            the same active-indicator gesture as the current nav entry, the
            selected tab and the certificate's top edge — and its own label steps
            up to h3. Nothing reflows to do it: the rule occupies a 3px track that
            every row already reserves, exactly as the commit rule does. */}
        <Surface rung={2} className="overflow-hidden">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const Icon = step.icon;
            const cfg = STEP_STATE_CONFIG[step.state];
            const isCurrent = nextStep?.id === step.id;
            // Each destination enforces its own capability and *throws* when the
            // member lacks it (/settings requires settings.manage, which this page
            // does not). Linking unconditionally would drop a documents-only staff
            // member on an error boundary, so an unreachable step is rendered as
            // plain text instead — the same rule the sidebar already applies.
            const canOpen = sellerNavigationAllows(grantedPermissions, step.permissions);
            const rowClass = cn(
              // The 3px inline-start track is always present and only its colour
              // changes, so marking the current step cannot shift a single pixel
              // of the four rows around it. border-s, never border-l.
              "flex items-start gap-4 border-s-[3px] p-4",
              isCurrent ? "border-s-brass bg-surface-1" : "border-s-transparent",
              !isLast && "border-b border-b-hairline",
            );
            // The system's :focus-visible ring is an OUTWARD two-stop box-shadow
            // and these rows are full-bleed children of an overflow-hidden panel,
            // so that ring is clipped away to nothing and a keyboard user sees no
            // focus at all. An outline at a negative offset draws the same --ring
            // token inside the row, where the panel cannot clip it.
            const rowFocus =
              "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";
            const body = (
              <>
                {/* One neutral chip carrying the state's ink, rather than four
                    background hues. Ten colours carrying zero information is the
                    loudest amateur signal in the product. */}
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-neutral-soft", cfg.ink)}>
                  {step.state === "COMPLETE" ? (
                    <CheckCircle className="h-4 w-4" aria-hidden="true" />
                  ) : step.state === "BLOCKED" ? (
                    <Ban className="h-4 w-4" aria-hidden="true" />
                  ) : step.state === "IN_PROGRESS" ? (
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  {isCurrent && (
                    // Brass eyebrow: brass marks the current position, and one of
                    // its three permitted uses in the whole product is exactly
                    // this — the active indicator.
                    <Eyebrow tone="brass" className="mb-0.5">
                      {t("onboarding.nextStep")}
                    </Eyebrow>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Rank, not colour: the step you are on is a size step up
                        from the four around it. Two adjacent ranks that differ
                        only in colour are the same rank. */}
                    <p className={cn(isCurrent ? "u-h3 text-ink-1" : "u-ui font-medium text-ink-1")}>{step.label}</p>
                    <StatusPill tone={cfg.tone}>{t(`onboarding.stepState.${step.state}`)}</StatusPill>
                  </div>
                  <p className={cn("mt-0.5 text-ink-2", isCurrent ? "u-body" : "u-meta")}>{step.desc}</p>
                </div>
                {/* A direction-implying icon must flip in Arabic. */}
                {canOpen && <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-3 rtl:rotate-180" aria-hidden="true" />}
              </>
            );
            return canOpen ? (
              <Link
                key={step.id}
                href={step.href}
                className={cn(rowClass, rowFocus, "u-focus transition-colors duration-hover ease-standard hover:bg-ink-1/[0.03]")}
              >
                {body}
              </Link>
            ) : (
              <div key={step.id} className={rowClass}>
                {body}
              </div>
            );
          })}
        </Surface>

        {/* Required documents — one row per required DocumentType, status from the database. */}
        <Surface rung={2} className="overflow-hidden">
          <div className="border-b border-hairline px-4 pt-4 pb-3">
            <SectionHeader
              className="mb-0"
              title={t("onboarding.requiredDocuments")}
              dateline={t("onboarding.requiredDateline", { notOnFile: t("onboarding.docStatus.MISSING") })}
              action={
                <Button variant="link" size="sm" asChild>
                  <Link href={DOCUMENT_CENTER_HREF}>{t("onboarding.documentCenter")}</Link>
                </Button>
              }
            />
          </div>

          {missingRequiredCount > 0 && (
            <FieldWell className="rounded-none border-x-0 border-t-0 border-b-hairline px-4 py-3">
              <p className="u-meta text-ink-2">
                {t.rich("onboarding.missingNotice", {
                  notOnFile: t("onboarding.docStatus.MISSING"),
                  center: t("onboarding.documentCenter"),
                  link: (chunks) => (
                    <Link href={DOCUMENT_UPLOAD_HREF} className="u-focus rounded-nested font-medium text-primary-ink underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </FieldWell>
          )}

          <div className="divide-y divide-hairline">
            {documentRows.map((doc) => {
              const cfg = DOC_STATUS_CONFIG[doc.status];
              const StatusIcon = cfg.icon;
              // The approved row governs; a newer filing is a second fact, not a
              // replacement — and a refused renewal is stated here, reason included,
              // rather than left for the seller to discover in the Document Center.
              const renewal =
                doc.renewal && doc.renewalStatus
                  ? {
                      ...renewalNote(doc.renewalStatus, t),
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
                <div key={doc.type} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="u-ui font-medium text-ink-1">{doc.label}</p>
                      {!doc.applicable && <StatusPill tone="neutral">{t("onboarding.notRequired")}</StatusPill>}
                    </div>
                    <p className="u-meta mt-0.5 text-ink-2">{doc.why}</p>
                    {doc.row && (
                      <p className="u-meta mt-1 truncate text-ink-3">
                        <span className="u-mono">{doc.row.fileName}</span> ·{" "}
                        {t("onboarding.filedOn", { date: doc.row.uploadedAt.toISOString().slice(0, 10) })}
                        {doc.row.expiryDate
                          ? ` · ${t("onboarding.expiresOn", { date: doc.row.expiryDate.toISOString().slice(0, 10) })}`
                          : ""}
                      </p>
                    )}
                    {/* A supersession reason is not a refusal; the "Replaced" badge already says what happened. */}
                    {doc.status === "REJECTED" && doc.row?.rejectionReason && (
                      <p className="u-meta mt-1 text-danger-ink">{doc.row.rejectionReason}</p>
                    )}
                    {/* Not truncated: a rejection reason is the actionable part and must not be clipped. */}
                    {renewal && (
                      <p className={cn("u-meta mt-1 flex items-start gap-1", renewal.className)}>
                        <renewal.Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 break-words">
                          {renewal.text} · {renewal.fileName}{" "}
                          {t("onboarding.filedOn", { date: renewal.filed })}
                          {renewal.reason}
                        </span>
                      </p>
                    )}
                  </div>
                  <StatusPill tone={cfg.tone} className="shrink-0">
                    <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {t(`onboarding.docStatus.${doc.status}`)}
                  </StatusPill>
                </div>
              );
            })}
          </div>

          {additionalDocuments.length > 0 && (
            <div className="border-t border-hairline">
              <FieldWell className="rounded-none border-x-0 border-t-0 border-b-hairline px-4 py-2">
                <Eyebrow>{t("onboarding.otherDocuments")}</Eyebrow>
              </FieldWell>
              <div className="divide-y divide-hairline">
                {additionalDocuments.map((doc) => {
                  const status = effectiveDocumentStatus(doc, now);
                  const cfg = DOC_STATUS_CONFIG[status];
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="u-ui font-medium text-ink-1">{documentTypeLabel(doc.type, t)}</p>
                        <p className="u-meta u-mono truncate text-ink-3">{doc.fileName}</p>
                      </div>
                      <StatusPill tone={cfg.tone} className="shrink-0">
                        <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {t(`onboarding.docStatus.${status}`)}
                      </StatusPill>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {documents.length === 0 && (
            <div className="border-t border-hairline">
              <EmptyState
                eyebrow={t("onboarding.empty.eyebrow")}
                headline={t("onboarding.empty.headline")}
                body={t("onboarding.empty.body", { seller: seller.businessNameEn })}
                action={
                  <Button variant="primary" size="sm" asChild>
                    <Link href={DOCUMENT_UPLOAD_HREF}>{t("onboarding.empty.action")}</Link>
                  </Button>
                }
              />
            </div>
          )}
        </Surface>
      </div>
    </SellerLayout>
  );
}
