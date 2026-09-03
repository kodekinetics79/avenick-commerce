import { requireAdminSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import Link from "next/link";
import { format } from "date-fns";
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

export const metadata = { title: "Sellers" };

/** Enum → tone. Four semantic states, which is all an operator distinguishes. */
const STATUS_TONE: Record<string, PillTone> = {
  ACTIVE: "success",
  PENDING_REVIEW: "warning",
  SUSPENDED: "danger",
  REJECTED: "neutral",
};

/** The queues an operator works, in the order they are worked. */
const STATUS_FILTERS: Array<{ value?: string; label: string }> = [
  { label: "All" },
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
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
function Tier({ tier }: { tier: string }) {
  if (tier === "PLATINUM" || tier === "GOLD") return <TierMark tier={tier} />;
  if (tier === "VERIFIED") return <StatusPill tone="accent">Verified</StatusPill>;
  return <span className="u-meta text-ink-3">{tier.replace(/_/g, " ")}</span>;
}

/**
 * The document column. "No documents filed" and "every document decided" are
 * different facts and the old ✓ collapsed them into one — which, in a console
 * where approval rests on filed evidence, is the one place that must not be
 * ambiguous. A bare check mark also announced as "check mark" and nothing else.
 */
function Docs({ documents }: { documents: { status: string }[] }) {
  if (documents.length === 0) return <span className="u-meta text-ink-3">None filed</span>;
  const pending = documents.filter((doc) => doc.status === "PENDING_REVIEW").length;
  if (pending > 0) return <StatusPill tone="warning">{pending} pending</StatusPill>;
  return <span className="u-meta text-ink-2">All decided</span>;
}

export default async function SellersPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminSession();
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

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Supply base"
          title="Sellers"
          // LAW E. The query takes 100, so this counts what was LOADED, never how
          // many accounts match. "N accounts match this filter" said of a
          // truncated page is a claim about the size of the supply base that the
          // page has no basis for.
          description={
            sellers.length === 1
              ? "1 supplier account is loaded for this filter."
              : `${sellers.length.toLocaleString()} supplier accounts are loaded for this filter.`
          }
          // The query takes 100. Saying so is the difference between a count and
          // a claim about the size of the supply base.
          dateline={`Filter: ${activeFilter.label} · newest first · at most 100 loaded`}
        />

        {/* Recessed strip, raised current item: the same gesture as the sidebar,
            so a filter reads as "where you are" rather than as a coloured chip. */}
        <FieldWell as="nav" aria-label="Filter sellers by status" className="flex flex-wrap gap-1 p-1">
          {STATUS_FILTERS.map((filter) => (
            <NavItem
              key={filter.value ?? "all"}
              href={filter.value ? `/sellers?status=${filter.value}` : "/sellers"}
              label={filter.label}
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
              label: "Seller",
              render: (seller) => (
                <div className="min-w-0">
                  <p className="font-medium text-ink-1">{seller.businessNameEn}</p>
                  <p className="u-meta truncate text-ink-3">{seller.user.email}</p>
                </div>
              ),
            },
            {
              key: "cr",
              label: "CR",
              hideOnMobile: true,
              // Mono is for identifiers. A commercial registration number is one.
              render: (seller) => <span className="u-meta u-mono text-ink-2">{seller.crNumber}</span>,
            },
            {
              key: "type",
              label: "Type",
              hideOnMobile: true,
              render: (seller) => <span className="u-meta text-ink-2">{seller.type.replace(/_/g, " ")}</span>,
            },
            { key: "tier", label: "Tier", render: (seller) => <Tier tier={seller.tier} /> },
            {
              key: "status",
              label: "Status",
              render: (seller) => (
                <StatusPill tone={STATUS_TONE[seller.status] ?? "neutral"}>
                  {seller.status.replace(/_/g, " ")}
                </StatusPill>
              ),
            },
            { key: "products", label: "Products", numeric: true, render: (seller) => seller._count.products },
            { key: "docs", label: "Documents", render: (seller) => <Docs documents={seller.documents} /> },
            {
              key: "created",
              label: "Applied",
              hideOnMobile: true,
              render: (seller) => <span className="u-meta tnum text-ink-3">{format(seller.createdAt, "MMM d, yyyy")}</span>,
            },
            {
              key: "actions",
              label: "Record",
              align: "end",
              render: (seller) => (
                <Button variant="ghost" size="xs" asChild>
                  <Link href={`/sellers/${seller.id}`}>
                    Open<span className="sr-only"> the record for {seller.businessNameEn}</span>
                  </Link>
                </Button>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline={
                activeFilter.value
                  ? `No supplier account is currently ${activeFilter.label.toLowerCase()}.`
                  : "No supplier accounts have been created yet."
              }
              body="Supplier accounts appear here as soon as a business registers."
              action={
                activeFilter.value ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/sellers">Show every supplier</Link>
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
