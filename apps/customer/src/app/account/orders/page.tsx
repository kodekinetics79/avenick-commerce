import { auth } from "@/lib/auth-instance";
import { db, type OrderStatus } from "@avenick/database";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { formatCurrency } from "@avenick/utils";
import {
  Button,
  CellGrid,
  Dateline,
  Divider,
  EmptyState,
  Num,
  PageHeader,
  Reveal,
  Stat,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { Package, Truck, CheckCircle, Clock, ChevronRight, RotateCcw, ScrollText } from "lucide-react";
import { LOCALE_COOKIE, toIdentityLocale, type IdentityLocale } from "../../auth/identity-copy";
import { accountCopy } from "../account-copy";

/**
 * The tab title is a user-visible string like any other, and it was the last
 * English literal on this route: an Arabic reader's
 * browser tab read "My Orders" above a fully Arabic page. `metadata` is a static
 * export and cannot read a cookie, so it becomes `generateMetadata` — the same
 * accessor every other string on this track already uses. The route was already
 * dynamic (auth() and cookies()), so this adds no rendering cost.
 */
export async function generateMetadata() {
  const locale = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: accountCopy(locale).orders.title };
}

/**
 * Status presentation. The old map carried six independent hues — purple, amber,
 * cyan, blue, red, green — which is ten colours carrying zero information, the
 * loudest amateur signal there was in this product. There are now four semantic
 * states plus accent, and the tone says what the buyer should do about it:
 * `warning` is the only one that means "this is waiting on you".
 *
 * THE KEY IS THE STORED VALUE and it never localises; only the label does, from
 * account-copy. A localised status written back to the column would be a data
 * defect wearing a translation.
 */
const STATUS_CONFIG: Record<string, { tone: PillTone; icon: typeof Clock }> = {
  PENDING_PAYMENT:  { tone: "warning", icon: Clock },
  CONFIRMED:        { tone: "accent",  icon: CheckCircle },
  PROCESSING:       { tone: "neutral", icon: Package },
  READY_FOR_PICKUP: { tone: "warning", icon: Package },
  SHIPPED:          { tone: "accent",  icon: Truck },
  DELIVERED:        { tone: "success", icon: CheckCircle },
  CANCELLED:        { tone: "danger",  icon: Clock },
  RETURNED:         { tone: "neutral", icon: RotateCcw },
};

const FILTER_VALUES = ["", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

/** How many item names a row prints before it summarises the rest. */
const ITEM_PREVIEW = 2;

/**
 * ONE NUMERAL SYSTEM, WESTERN, IN BOTH LOCALES — DESIGN_SYSTEM.md §2.3.
 * `ar-AE-u-nu-latn` is what pins it: without the extension an Arabic date
 * renders in Arabic-Indic digits beside a price that does not, and the column
 * cannot align. This is the same policy `<Num>`'s docstring states for money.
 */
function dateFormatter(locale: IdentityLocale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const locale = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = accountCopy(locale).orders;
  const fmt = dateFormatter(locale);

  const statusFilter = searchParams.status && Object.hasOwn(STATUS_CONFIG, searchParams.status)
    ? searchParams.status as OrderStatus
    : undefined;
  const orders = await db.order.findMany({
    where: { userId: session.user.id, ...(statusFilter ? { status: statusFilter } : {}) },
    orderBy: { createdAt: "desc" },
    include: { items: true, statusHistory: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const activeTab = statusFilter ?? "";
  const deliveredCount  = orders.filter(o => o.status === "DELIVERED").length;
  const shippedCount    = orders.filter(o => o.status === "SHIPPED").length;
  const processingCount = orders.filter(o => ["CONFIRMED","PROCESSING"].includes(o.status)).length;
  const activeLabel = statusFilter ? t.statusLabels[statusFilter] : undefined;

  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl px-4 py-block">
        <PageHeader
          eyebrow={t.eyebrow}
          title={t.title}
          dateline={
            activeLabel ? t.datelineFiltered(activeLabel, orders.length) : t.dateline(orders.length)
          }
          linkComponent={Link}
          actions={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/returns">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {t.returnsAction}
              </Link>
            </Button>
          }
        />

        {/* The band is only honest when nothing is filtered: with a status
            filter applied every other count would necessarily read zero, which
            says nothing about the account. */}
        {!statusFilter && orders.length > 0 && (
          <Reveal className="mb-block">
            <CellGrid cols={{ base: 3 }}>
              <Stat label={t.bandInProgress} value={processingCount} rank="section" />
              <Stat label={t.bandShipped} value={shippedCount} rank="section" />
              <Stat label={t.bandDelivered} value={deliveredCount} rank="section" />
            </CellGrid>
            <Dateline className="mt-2">{t.bandBasis}</Dateline>
          </Reveal>
        )}

        {/* Filter tabs. The selected one is marked with the brass drawn rule —
            the same active-indicator gesture the navigation, the certificate's
            top edge and the quantity ladder's active band use — instead of a
            filled indigo pill, which spent the page's one primary fill on a
            filter. aria-current tells assistive technology which is live. */}
        <nav aria-label={t.filterLabel} className="mb-stack flex gap-1 overflow-x-auto border-b border-hairline">
          {FILTER_VALUES.map((value) => {
            const active = activeTab === value;
            const label = value ? t.statusLabels[value] ?? value : t.filterAll;
            return (
              <Link
                key={value}
                href={value ? `/account/orders?status=${value}` : "/account/orders"}
                aria-current={active ? "page" : undefined}
                className="u-focus u-drawn-host relative shrink-0 rounded-t-nested px-3 pb-2 pt-1.5"
              >
                <span className={active ? "u-ui font-medium text-ink-1" : "u-ui text-ink-3"}>{label}</span>
                <Divider drawn on={active} className="absolute inset-x-0 bottom-0" />
              </Link>
            );
          })}
        </nav>

        {orders.length === 0 ? (
          // THE CERTIFICATE. Not a centred grey apology: a composed plate with a
          // brass hairline across its top edge, ledger ruling behind, a cropped
          // glyph bleeding off the outer corner, and exactly one real action.
          // Nothing invented — no count, no ETA, no "popular searches".
          <EmptyState
            variant="certificate"
            glyph={<ScrollText />}
            eyebrow={t.emptyEyebrow}
            headline={activeLabel ? t.emptyHeadlineFiltered(activeLabel) : t.emptyHeadline}
            body={activeLabel ? t.emptyBodyFiltered : t.emptyBody}
            action={
              <Button variant="primary" asChild>
                <Link href={activeLabel ? "/account/orders" : "/products"}>
                  {activeLabel ? t.emptyActionFiltered : t.emptyAction}
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => {
              const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.CONFIRMED;
              const StatusIcon = sc.icon;
              const preview = order.items.slice(0, ITEM_PREVIEW);
              const remaining = order.items.length - preview.length;
              return (
                // The whole row is one link. It used to contain a second link
                // ("Return or exchange") nested inside the row's own anchor,
                // which is invalid and unreachable by keyboard; returns are
                // reached from the action in the page header instead.
                //
                // NOT staggered: this is a result set the reader asked for, and
                // staggering a result set is the canonical "this site is slow"
                // generator.
                <Surface as="li" key={order.id} rung={2} interactive className="overflow-hidden">
                  <Link href={`/orders/${order.id}`} className="u-focus block rounded-[inherit] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Mono is for references — order numbers, SKUs,
                              tracking IDs — and never for money. */}
                          <span className="u-mono u-meta text-ink-2" dir="ltr">{order.orderNumber}</span>
                          <StatusPill tone={sc.tone}>
                            <StatusIcon className="h-3 w-3" aria-hidden="true" />
                            {t.statusLabels[order.status] ?? order.status}
                          </StatusPill>
                          {order.type === "B2B" && <StatusPill tone="neutral">B2B</StatusPill>}
                        </div>
                        <p className="u-meta mt-1 text-ink-3">{fmt.format(order.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Num value={formatCurrency(Number(order.total), order.currency as never)} />
                        <ChevronRight className="h-4 w-4 text-ink-3 rtl:rotate-180" aria-hidden="true" />
                      </div>
                    </div>

                    {/* The old preview rendered every item and then appended
                        "+ more" whenever there were exactly two, which was
                        simply untrue. It now prints what it prints and counts
                        what it left out. */}
                    <p className="u-body mt-2 line-clamp-1 text-ink-2">
                      {preview.map((item, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-ink-3"> · </span>}
                          {item.nameEn}
                          {item.quantity > 1 && <span className="u-meta ms-1 text-ink-3">×{item.quantity}</span>}
                        </span>
                      ))}
                      {remaining > 0 && (
                        <span className="u-meta ms-1.5 text-ink-3">{t.moreItems(remaining)}</span>
                      )}
                    </p>
                  </Link>
                </Surface>
              );
            })}
          </ul>
        )}
      </div>
    </MainLayout>
  );
}
