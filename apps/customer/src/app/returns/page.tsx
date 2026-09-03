import Link from "next/link";
import { Clock, CheckCircle, XCircle, Truck, Package, Banknote, LogIn, PackageOpen, RotateCcw } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { auth } from "@/lib/auth-instance";
import { formatCurrency } from "@avenick/utils";
import { ReturnForm } from "./return-form";
import { cookies } from "next/headers";
import { cookieHeaderFromStore, fetchBackendJsonWithCookies } from "@/lib/backend";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  Num,
  PageHeader,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { LOCALE_COOKIE, toIdentityLocale, type IdentityLocale } from "../auth/identity-copy";
import { accountCopy } from "../account/account-copy";

/**
 * The tab title is a user-visible string like any other, and it was the last
 * English literal on this route: an Arabic reader's
 * browser tab read "Returns" above a fully Arabic page. `metadata` is a static
 * export and cannot read a cookie, so it becomes `generateMetadata` — the same
 * accessor every other string on this track already uses. The route was already
 * dynamic (force-dynamic), so this adds no rendering cost.
 */
export async function generateMetadata() {
  const locale = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: accountCopy(locale).returns.title };
}

export const dynamic = "force-dynamic";

/**
 * Six pastel washes (blue, amber, red, purple, indigo, green) became five
 * semantic tones. `success` is reserved for the only state that means the money
 * has moved; `danger` for the only one that means the request was refused.
 *
 * The key is the value stored on Return.status and never localises; only the
 * label does.
 */
const STATUS_CONFIG: Record<string, { tone: PillTone; icon: typeof Clock }> = {
  REQUESTED:  { tone: "neutral", icon: Clock },
  APPROVED:   { tone: "accent",  icon: CheckCircle },
  REJECTED:   { tone: "danger",  icon: XCircle },
  IN_TRANSIT: { tone: "accent",  icon: Truck },
  RECEIVED:   { tone: "accent",  icon: Package },
  REFUNDED:   { tone: "success", icon: Banknote },
};

/** Western digits in both locales — DESIGN_SYSTEM.md §2.3. */
function dateFormatter(locale: IdentityLocale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ReturnsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const cookieStore = await cookies();
  const locale = toIdentityLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const t = accountCopy(locale).returns;
  const fmt = dateFormatter(locale);

  if (!userId) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-3xl px-4 py-block">
          <PageHeader eyebrow={t.eyebrow} title={t.title} linkComponent={Link} />
          {/* THE CERTIFICATE. This is the whole page for a signed-out visitor,
              so it is composed rather than apologised for: brass hairline, ruled
              ground, a cropped glyph off the outer corner, and exactly one real
              action. */}
          <EmptyState
            variant="certificate"
            glyph={<RotateCcw />}
            eyebrow={t.signInEyebrow}
            headline={t.signInHeadline}
            body={t.signInBody}
            action={
              <Button variant="primary" asChild>
                <Link href="/login?callbackUrl=/returns">
                  {/* An arrow entering a door is a directional glyph: it mirrors.
                      -scale-x-100 rather than rotate-180, which would also turn it
                      upside down. */}
                  <LogIn className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" /> {t.signInAction}
                </Link>
              </Button>
            }
          />
        </div>
      </MainLayout>
    );
  }

  const cookieHeader = cookieHeaderFromStore(cookieStore);
  const { eligibleOrders, myReturns } = await fetchBackendJsonWithCookies<{ eligibleOrders: any[]; myReturns: any[] }>(
    "/api/returns",
    undefined,
    cookieHeader,
  );

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl px-4 py-block">
        <PageHeader
          eyebrow={t.eyebrow}
          title={t.title}
          description={t.description}
          linkComponent={Link}
        />

        <div className="space-y-block">
          {/* Existing returns, as one panel divided by hairlines rather than a
              stack of independently bordered cards. */}
          {myReturns.length > 0 && (
            <section>
              <Surface rung={2} className="overflow-hidden">
                <div className="border-b-2 border-border-strong px-5 py-3">
                  <Eyebrow as="h2">{t.listHeading}</Eyebrow>
                </div>
                <ul>
                  {myReturns.map((r) => {
                    // A status the platform has since renamed would otherwise
                    // take the whole page down over one row.
                    const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.REQUESTED;
                    const Icon = cfg.icon;
                    return (
                      <li
                        key={r.id}
                        className="flex items-start justify-between gap-3 border-t border-hairline px-5 py-3.5 first:border-t-0"
                      >
                        <div className="min-w-0">
                          <p className="u-mono u-ui text-ink-1" dir="ltr">
                            {r.returnNumber} <span className="text-ink-3">·</span> {r.order.orderNumber}
                          </p>
                          <p className="u-meta mt-0.5 truncate text-ink-2">
                            {t.form.reasonLabels[r.reason] ?? r.reason} · {fmt.format(new Date(r.createdAt))}
                          </p>
                          {/* The resolution is the platform's answer to the
                              request, so it is the most important string in the
                              row. It was set in ink-3 — the metadata step, the
                              lowest contrast in the ramp — and truncated to one
                              line, which is exactly backwards. */}
                          {r.resolution && (
                            <p className="u-body mt-1 text-ink-2">
                              <span className="u-micro me-1.5 text-ink-3">{t.outcome}</span>
                              {r.resolution}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-end">
                          <StatusPill tone={cfg.tone}>
                            <Icon className="h-3 w-3" aria-hidden="true" />{" "}
                            {t.statusLabels[r.status] ?? r.status}
                          </StatusPill>
                          {r.refundAmount && (
                            <p className="mt-1.5">
                              <Num value={formatCurrency(Number(r.refundAmount), r.order.currency as never)} />
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Surface>
              {/* LAW E. A refund figure with no basis is a number; with one it is
                  a record. */}
              <Dateline className="mt-2">{t.refundBasis}</Dateline>
            </section>
          )}

          {/* New return */}
          <section>
            {eligibleOrders.length > 0 ? (
              <Surface rung={2} className="p-5 sm:p-6">
                <Eyebrow as="h2">{t.newHeading}</Eyebrow>
                <p className="u-body mt-1.5 max-w-desc text-ink-2">{t.newBody}</p>
                <div className="mt-5">
                  <ReturnForm
                    locale={locale}
                    orders={eligibleOrders.map((o) => ({
                      id: o.id,
                      orderNumber: o.orderNumber,
                      total: Number(o.total),
                      currency: o.currency,
                      // Orders arrive through the JSON API, so createdAt is already
                      // an ISO string; calling toISOString on it threw for every
                      // buyer with an eligible order.
                      createdAt: new Date(o.createdAt).toISOString(),
                      summary: o.items.map((i: { quantity: number; nameEn: string }) => `${i.quantity}× ${i.nameEn}`).join(", "),
                      items: o.items.map((i: { id: string; quantity: number; nameEn: string; total: unknown }) => ({
                        id: i.id,
                        quantity: i.quantity,
                        nameEn: i.nameEn,
                        total: Number(i.total),
                      })),
                    }))}
                  />
                </div>
              </Surface>
            ) : (
              // The certificate again, because with nothing eligible this IS the
              // section. The one action is the surface that answers the
              // question the reader actually has — which orders do I have?
              <EmptyState
                variant="certificate"
                glyph={<PackageOpen />}
                eyebrow={t.noneEyebrow}
                headline={t.noneHeadline}
                body={t.noneBody}
                action={
                  <Button variant="secondary" asChild>
                    <Link href="/account/orders">{t.noneAction}</Link>
                  </Button>
                }
              />
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
