import Link from "next/link";
import { requireSellerAnyPermission } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { cn } from "@avenick/utils";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  ImageFrame,
  PageHeader,
  Stat,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, ShieldCheck, XCircle } from "lucide-react";

export const metadata = { title: "Listing issues" };

/**
 * Severity → tone, never severity → hue.
 *
 * This page used to draw its three severities in `text-red-600 dark:text-red-400`
 * over `bg-red-500/10`, `text-yellow-600` over `bg-yellow-500/10` and a full-width
 * `bg-green-500/10` congratulation panel. Those are raw Tailwind palette values:
 * they exist in no token, they are tuned for neither theme, and the yellow in
 * particular measures well under 4.5:1 on a light ground. The four semantic tones
 * this system defines have real values in both themes and are the only colours
 * any status in the product is allowed to take.
 */
const SEVERITY: Record<string, { label: string; tone: PillTone; icon: typeof XCircle; rule: string; order: number }> = {
  ERROR: { label: "Error", tone: "danger", icon: XCircle, rule: "border-danger", order: 0 },
  WARNING: { label: "Warning", tone: "warning", icon: AlertTriangle, rule: "border-warning", order: 1 },
  INFO: { label: "Note", tone: "neutral", icon: Info, rule: "border-border-strong", order: 2 },
};

const severityView = (severity: string) =>
  SEVERITY[severity] ?? { label: severity.toLowerCase(), tone: "neutral" as PillTone, icon: Info, rule: "border-border-strong", order: 3 };

/**
 * Where each issue type is actually fixed. An issue with no mapping gets no
 * button rather than a generic "Fix it" that lands somewhere unrelated — a
 * control that does not do what it says is worse than no control.
 */
const ISSUE_ACTION: Record<string, { label: string; path: "edit" | "inventory" | "compliance" }> = {
  MISSING_IMAGES: { label: "Add images", path: "edit" },
  MISSING_ARABIC_TITLE: { label: "Edit listing", path: "edit" },
  MISSING_ARABIC_DESCRIPTION: { label: "Edit listing", path: "edit" },
  NO_PRICE: { label: "Set pricing", path: "edit" },
  NO_STOCK: { label: "Update inventory", path: "inventory" },
  MISSING_COMPLIANCE: { label: "Upload documents", path: "compliance" },
  REJECTED_BY_ADMIN: { label: "Edit and resubmit", path: "edit" },
  SUPPRESSED: { label: "Edit listing", path: "edit" },
};

function humaniseIssueType(type: string): string {
  return type.replace(/_/g, " ").toLowerCase();
}

export default async function IssuesPage() {
  const { seller, membership } = await requireSellerAnyPermission(["catalog.view", "catalog.manage"]);

  const issues = await db.productIssue.findMany({
    where: { product: { sellerId: seller.id }, resolvedAt: null },
    include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
  });

  const errors = issues.filter((issue) => issue.severity === "ERROR");
  const warnings = issues.filter((issue) => issue.severity === "WARNING");
  const other = issues.filter((issue) => issue.severity !== "ERROR" && issue.severity !== "WARNING");

  // Distinct listings, not issue rows: one listing missing both its Arabic title
  // and its price is one product to open, not two. The old summary counted rows
  // and called them products.
  const affectedProducts = new Set(issues.map((issue) => issue.productId)).size;

  /**
   * Errors first, then warnings, then anything else — and each group is headed,
   * so a supplier with forty warnings and two errors cannot scroll past the two
   * that are actually stopping a listing. Groups with nothing in them are not
   * rendered at all; an empty heading over nothing is a hole in the page.
   */
  const groups = [
    { key: "ERROR", title: "Blocking errors", rows: errors, note: "These stop a listing from being sold." },
    { key: "WARNING", title: "Warnings", rows: warnings, note: "These reduce listing health but do not stop a sale." },
    { key: "OTHER", title: "Notes", rows: other, note: "Recorded against the listing for information." },
  ].filter((group) => group.rows.length > 0);

  return (
    <SellerLayout
      sellerName={seller.businessNameEn}
      tier={seller.tier}
      issueCount={issues.length}
      permissions={membership.permissions}
    >
      <div className="space-y-block">
        <PageHeader
          className="mb-0"
          eyebrow="Catalog"
          title="Listing issues"
          description="Everything the platform has recorded against one of your listings and nobody has resolved yet."
          // LAW E. What is counted, and — just as importantly — what is not: a
          // resolved issue leaves this page, so an empty page is a real state
          // rather than a query that failed.
          dateline="Unresolved issues on your own listings, most severe first · an issue disappears from here the moment it is resolved"
        />

        {/* The summary band. Errors lead at SECTION rank and everything else sits
            at inline rank beneath it — a row of four identically-weighted figures
            is exactly why nothing on a console page can be subordinate to
            anything. A count of zero is still shown here, because on this page
            zero errors is the fact the supplier came to check. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label="Blocking errors"
            value={errors.length}
            rank="section"
            icon={XCircle}
            chip={errors.length > 0 ? "danger" : "neutral"}
            note="Issues that stop a listing being sold."
          />
          <Stat
            label="Warnings"
            value={warnings.length}
            icon={AlertTriangle}
            chip={warnings.length > 0 ? "warning" : "neutral"}
            note="Issues that reduce listing health."
          />
          <Stat
            label="Listings affected"
            value={affectedProducts}
            icon={ShieldCheck}
            note="Distinct products with at least one open issue."
            href="/products"
            linkComponent={Link}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          />
          <Stat label="Open issues" value={issues.length} icon={Info} note="Every unresolved row across your catalog." />
        </CellGrid>

        {issues.length === 0 ? (
          /* Not a green congratulation panel. The certificate says precisely what
             was checked and gives the supplier the one thing there is to do next,
             which on a clean catalog is to look at the catalog. */
          <EmptyState
            variant="certificate"
            glyph={<CheckCircle2 />}
            eyebrow="Nothing open"
            headline="No unresolved issue is recorded against any of your listings."
            /* States the RECORD, not an inference from it. "Every listing has
               passed the checks" would be a claim about work the platform did;
               what this page actually knows is that no unresolved row exists —
               issues are written when a listing is saved and when the platform
               reviews it, so a listing nobody has touched since the checks
               existed has simply never been examined. */
            body="Issues are recorded when a listing is saved and when the platform reviews it. None of yours currently carries one. An issue appears here the moment it is raised, and leaves the moment it is resolved."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/products">Open your catalog</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-block">
            {groups.map((group) => (
              <section key={group.key} aria-label={group.title} className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Eyebrow as="h2">
                    {group.title} — {group.rows.length}
                  </Eyebrow>
                  <Dateline className="min-w-0">{group.note}</Dateline>
                </div>

                <Surface rung={1} className="overflow-hidden">
                  <ul className="divide-y divide-hairline">
                    {group.rows.map((issue) => {
                      const view = severityView(issue.severity);
                      const SeverityIcon = view.icon;
                      const action = ISSUE_ACTION[issue.issueType];
                      const product = issue.product;
                      const href =
                        action?.path === "inventory"
                          ? `/inventory?product=${encodeURIComponent(product.id)}`
                          : action?.path === "compliance"
                            ? `/compliance?product=${encodeURIComponent(product.id)}`
                            : `/products/${encodeURIComponent(product.id)}/edit`;

                      return (
                        <li
                          key={issue.id}
                          /* The 3px inline-start rule is the whole severity
                             signal: always present, only ever changing colour, so
                             nothing reflows between an error row and a note. Same
                             gesture as the RFQ inbox and the commit rule — one
                             rule in different postures rather than a fifth
                             invention. border-s, never border-l. */
                          className={cn("flex flex-wrap items-start gap-3 border-s-[3px] px-4 py-3", view.rule)}
                        >
                          {/* The one product frame used everywhere in all three
                              portals: contained rather than cropped, inset off its
                              own edge, on the same lit plate with the same floor
                              under it — and with a designed no-image state instead
                              of a grey box reading "No img". This row used
                              object-cover, which crops the valve off a fitting. */}
                          <ImageFrame
                            src={product.images[0]?.url ?? null}
                            alt={product.images[0] ? product.nameEn : ""}
                            sku={product.sku}
                            className="h-12 w-12 shrink-0 rounded-nested"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill tone={view.tone}>
                                <SeverityIcon className="h-3 w-3" aria-hidden="true" />
                                {view.label}
                              </StatusPill>
                              <span className="u-meta text-ink-3">{humaniseIssueType(issue.issueType)}</span>
                            </div>

                            <Link
                              href={`/products/${encodeURIComponent(product.id)}/edit`}
                              className="u-ui u-focus mt-1 block truncate rounded-nested font-medium text-ink-1 hover:underline"
                            >
                              {product.nameEn}
                            </Link>
                            <p className="u-meta truncate text-ink-3">
                              {product.nameAr && <span>{product.nameAr} · </span>}
                              <span className="u-mono">{product.sku}</span>
                            </p>

                            <p className="u-body mt-1.5 max-w-prose text-ink-2">{issue.message}</p>
                            {/* The Arabic message is a second language, not a
                                right-aligned decoration. dir="rtl" is what makes
                                the paragraph lay out correctly — bidi ordering,
                                punctuation on the correct side, and alignment
                                that follows from the direction rather than from a
                                physical text-right. text-start is written for the
                                same reason every other alignment in this codebase
                                is logical: it resolves against THIS element's own
                                direction, so it stays correct if the element ever
                                carries a different one. */}
                            {issue.messageAr && (
                              <p dir="rtl" className="u-body mt-0.5 max-w-prose text-start text-ink-2">
                                {issue.messageAr}
                              </p>
                            )}
                          </div>

                          {action && (
                            <Button variant="secondary" size="sm" asChild className="shrink-0">
                              <Link href={href}>
                                {action.label}
                                <span className="sr-only"> for {product.nameEn}</span>
                                {/* A direction-implying icon must flip. */}
                                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                              </Link>
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Surface>
              </section>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
