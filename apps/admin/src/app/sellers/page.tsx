import { requireAdminSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import Link from "next/link";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import {
  Button,
  EmptyState,
  FieldWell,
  LedgerTable,
  NavItem,
  PageHeader,
  StatusPill,
  TierMark,
  type PillTone,
} from "@avenick/ui";
import { sellerTypeLabel, statusLabel, tierLabel } from "@/app/approvals/status-labels";

export async function generateMetadata() {
  const t = await getTranslations("adminReview");
  return { title: t("meta.sellers") };
}

/** Enum → tone. Four semantic states, which is all an operator distinguishes. */
const STATUS_TONE: Record<string, PillTone> = {
  ACTIVE: "success",
  PENDING_REVIEW: "warning",
  SUSPENDED: "danger",
  REJECTED: "neutral",
};

/**
 * The queues an operator works, in the order they are worked. The enum value is
 * the identifier the query and the URL carry; `key` is what the label is looked
 * up under, because a module-scope constant has no translator in scope.
 */
const STATUS_FILTERS: Array<{ value?: string; key: string }> = [
  { key: "all" },
  { value: "PENDING_REVIEW", key: "PENDING_REVIEW" },
  { value: "ACTIVE", key: "ACTIVE" },
  { value: "SUSPENDED", key: "SUSPENDED" },
];

type SellerRow = {
  id: string;
  businessNameEn: string;
  crNumber: string;
  type: string;
  tier: string;
  status: string;
  createdAt: Date;
  user: { email: string };
  documents: { status: string }[];
  _count: { products: number };
};

/**
 * The tier column.
 *
 * Brass has a hard budget — it is the whole GCC gesture and it dies the moment
 * it becomes a fill on a hundred rows — so only the two earned tiers get the
 * mark. VERIFIED is the accent verdigris, which is the token reserved for trade
 * and verification, and STANDARD is what everyone is by default: it is a fact,
 * not a badge, so it is set as one.
 */
function Tier({ tier, verifiedLabel, label }: { tier: string; verifiedLabel: string; label: string }) {
  if (tier === "PLATINUM" || tier === "GOLD") return <TierMark tier={tier} />;
  if (tier === "VERIFIED") return <StatusPill tone="accent">{verifiedLabel}</StatusPill>;
  return <span className="u-meta text-ink-3">{label}</span>;
}

/**
 * The document column. sellers.docs.none and sellers.docs.allDecided are
 * different facts and the old ✓ collapsed them into one — which, in a console
 * where approval rests on filed evidence, is the one place that must not be
 * ambiguous. A bare check mark also announced as "check mark" and nothing else.
 */
function Docs({
  documents,
  labels,
}: {
  documents: { status: string }[];
  /** Translated in the page; `pending` is a function because it carries a count. */
  labels: { none: string; allDecided: string; pending: (count: number) => string };
}) {
  if (documents.length === 0) return <span className="u-meta text-ink-3">{labels.none}</span>;
  const pending = documents.filter((doc) => doc.status === "PENDING_REVIEW").length;
  if (pending > 0) return <StatusPill tone="warning">{labels.pending(pending)}</StatusPill>;
  return <span className="u-meta text-ink-2">{labels.allDecided}</span>;
}

export default async function SellersPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminSession();
  const t = await getTranslations("adminReview");
  const pendingCount = await db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } });

  const sellers = await db.sellerProfile.findMany({
    where: { ...(searchParams.status && { status: searchParams.status as never }), deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      documents: { select: { id: true, status: true } },
      _count: { select: { products: true } },
    },
  });

  const activeFilter = STATUS_FILTERS.find((f) => f.value === searchParams.status) ?? STATUS_FILTERS[0];
  const activeFilterLabel = t(`sellers.filters.${activeFilter.key}`);
  // The in-sentence form is its own message rather than a .toLowerCase() of the
  // tab label: English lower-cases it inside a sentence, Arabic does not change.
  const activeFilterInline = t(`sellers.filtersInline.${activeFilter.key}`);
  const docLabels = {
    none: t("sellers.docs.none"),
    allDecided: t("sellers.docs.allDecided"),
    pending: (count: number) => t("sellers.docs.pending", { count, total: count.toLocaleString("en-US") }),
  };
  const verifiedLabel = t("sellers.verified");

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("sellers.eyebrow")}
          title={t("sellers.title")}
          // LAW E. The query takes 100, so this counts what was LOADED, never how
          // many accounts match. "N accounts match this filter" said of a
          // truncated page is a claim about the size of the supply base that the
          // page has no basis for.
          description={t("sellers.description", {
            count: sellers.length,
            total: sellers.length.toLocaleString("en-US"),
          })}
          // The query takes 100. Saying so is the difference between a count and
          // a claim about the size of the supply base.
          dateline={t("sellers.dateline", { filter: activeFilterLabel })}
        />

        {/* Recessed strip, raised current item: the same gesture as the sidebar,
            so a filter reads as "where you are" rather than as a coloured chip. */}
        <FieldWell as="nav" aria-label={t("sellers.filterLabel")} className="flex flex-wrap gap-1 p-1">
          {STATUS_FILTERS.map((filter) => (
            <NavItem
              key={filter.value ?? "all"}
              href={filter.value ? `/sellers?status=${filter.value}` : "/sellers"}
              label={t(`sellers.filters.${filter.key}`)}
              orientation="horizontal"
              active={filter.value === activeFilter.value}
              linkComponent={Link}
            />
          ))}
        </FieldWell>

        <LedgerTable<SellerRow>
          rows={sellers}
          getRowKey={(seller) => seller.id}
          stickyHead
          columns={[
            {
              key: "seller",
              label: t("sellers.columns.seller"),
              render: (seller) => (
                <div className="min-w-0">
                  <p className="font-medium text-ink-1">{seller.businessNameEn}</p>
                  <p className="u-meta truncate text-ink-3">{seller.user.email}</p>
                </div>
              ),
            },
            {
              key: "cr",
              label: t("sellers.columns.cr"),
              hideOnMobile: true,
              // Mono is for identifiers. A commercial registration number is one.
              render: (seller) => <span className="u-meta u-mono text-ink-2">{seller.crNumber}</span>,
            },
            {
              key: "type",
              label: t("sellers.columns.type"),
              hideOnMobile: true,
              render: (seller) => <span className="u-meta text-ink-2">{sellerTypeLabel(t, seller.type)}</span>,
            },
            {
              key: "tier",
              label: t("sellers.columns.tier"),
              render: (seller) => (
                <Tier tier={seller.tier} verifiedLabel={verifiedLabel} label={tierLabel(t, seller.tier)} />
              ),
            },
            {
              key: "status",
              label: t("sellers.columns.status"),
              render: (seller) => (
                <StatusPill tone={STATUS_TONE[seller.status] ?? "neutral"}>
                  {statusLabel(t, seller.status)}
                </StatusPill>
              ),
            },
            {
              key: "products",
              label: t("sellers.columns.products"),
              numeric: true,
              render: (seller) => seller._count.products,
            },
            {
              key: "docs",
              label: t("sellers.columns.documents"),
              render: (seller) => <Docs documents={seller.documents} labels={docLabels} />,
            },
            {
              key: "created",
              label: t("sellers.columns.applied"),
              hideOnMobile: true,
              render: (seller) => <span className="u-meta tnum text-ink-3">{format(seller.createdAt, "MMM d, yyyy")}</span>,
            },
            {
              key: "actions",
              label: t("sellers.columns.record"),
              align: "end",
              render: (seller) => (
                <Button variant="ghost" size="xs" asChild>
                  <Link href={`/sellers/${seller.id}`}>
                    {t("sellers.open")}
                    <span className="sr-only">{t("sellers.openSr", { name: seller.businessNameEn })}</span>
                  </Link>
                </Button>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("sellers.empty.eyebrow")}
              headline={
                activeFilter.value
                  ? t("sellers.empty.headlineFiltered", { filter: activeFilterInline })
                  : t("sellers.empty.headline")
              }
              body={t("sellers.empty.body")}
              action={
                activeFilter.value ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/sellers">{t("sellers.empty.showAll")}</Link>
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
