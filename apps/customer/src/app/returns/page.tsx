import Link from "next/link";
import { Clock, CheckCircle, XCircle, Truck, Package, Banknote, LogIn } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { auth } from "@/lib/auth-instance";
import { formatCurrency } from "@avenick/utils";
import { ReturnForm } from "./return-form";
import { format } from "date-fns";
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

export const metadata = { title: "Returns" };
export const dynamic = "force-dynamic";

/**
 * Six pastel washes (blue, amber, red, purple, indigo, green) became five
 * semantic tones. `success` is reserved for the only state that means the money
 * has moved; `danger` for the only one that means the request was refused.
 */
const STATUS_CONFIG: Record<string, { label: string; tone: PillTone; icon: typeof Clock }> = {
  REQUESTED:  { label: "Under review", tone: "neutral", icon: Clock },
  APPROVED:   { label: "Approved",     tone: "accent",  icon: CheckCircle },
  REJECTED:   { label: "Rejected",     tone: "danger",  icon: XCircle },
  IN_TRANSIT: { label: "In transit",   tone: "accent",  icon: Truck },
  RECEIVED:   { label: "Received",     tone: "accent",  icon: Package },
  REFUNDED:   { label: "Refunded",     tone: "success", icon: Banknote },
};

export default async function ReturnsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-3xl px-4 py-block">
          <PageHeader eyebrow="Account" title="Returns & Refunds" linkComponent={Link} />
          <Surface rung={2}>
            <EmptyState
              eyebrow="Sign in required"
              headline="Returns are tied to the account that placed the order."
              body="Sign in to request a return for a delivered order, or to follow one already under review."
              action={
                <Button variant="primary" size="sm" asChild>
                  <Link href="/login?callbackUrl=/returns">
                    <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Sign in
                  </Link>
                </Button>
              }
            />
          </Surface>
        </div>
      </MainLayout>
    );
  }

  const cookieStore = await cookies();
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
          eyebrow="Account"
          title="Returns & Refunds"
          description="Request a return for a delivered order, then follow its review here."
          linkComponent={Link}
        />

        <div className="space-y-block">
          {/* Existing returns, as one panel divided by hairlines rather than a
              stack of independently bordered cards. */}
          {myReturns.length > 0 && (
            <section>
              <Surface rung={2} className="overflow-hidden">
                <div className="border-b-2 border-border-strong px-5 py-3">
                  <Eyebrow>Your return requests</Eyebrow>
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
                        className="flex items-start justify-between gap-3 border-t border-hairline px-5 py-3 first:border-t-0"
                      >
                        <div className="min-w-0">
                          <p className="u-mono u-ui text-ink-1">
                            {r.returnNumber} <span className="text-ink-3">·</span> {r.order.orderNumber}
                          </p>
                          <p className="u-meta mt-0.5 truncate text-ink-2">
                            {r.reason} · {format(new Date(r.createdAt), "MMM d, yyyy")}
                          </p>
                          {/* The resolution is the platform's answer to the
                              request, so it is the most important string in the
                              row. It was set in ink-3 — the metadata step, the
                              lowest contrast in the ramp — and truncated to one
                              line, which is exactly backwards. */}
                          {r.resolution && (
                            <p className="u-meta mt-1 text-ink-2">
                              <span className="text-ink-3">Outcome: </span>
                              {r.resolution}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-end">
                          <StatusPill tone={cfg.tone}>
                            <Icon className="h-3 w-3" aria-hidden="true" /> {cfg.label}
                          </StatusPill>
                          {r.refundAmount && (
                            <p className="mt-1">
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
              <Dateline className="mt-2">
                Refund amounts as recorded against each return, each in the order&apos;s own currency · no conversion applied
              </Dateline>
            </section>
          )}

          {/* New return */}
          <section>
            <Surface rung={2} className="p-5">
              <Eyebrow>Start a new return</Eyebrow>
              {eligibleOrders.length > 0 ? (
                <>
                  <p className="u-ui mt-1 max-w-desc text-ink-2">
                    Choose a delivered order, pick the items, and say what went wrong.
                  </p>
                  <div className="mt-4">
                    <ReturnForm
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
                </>
              ) : (
                <EmptyState
                  eyebrow="Nothing eligible"
                  headline="No delivered order on this account can be returned right now."
                  body="A return can only be started from an order that has been marked delivered."
                  action={
                    <Button variant="secondary" size="sm" asChild>
                      <Link href="/account/orders">View your orders</Link>
                    </Button>
                  }
                />
              )}
            </Surface>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
