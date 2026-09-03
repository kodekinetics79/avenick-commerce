import Link from "next/link";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money, MoneyStack } from "@/components/b2b/money";
import {
  Button,
  CellGrid,
  EmptyState,
  Eyebrow,
  LedgerTable,
  Stat,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { type SupportedCurrency } from "@avenick/utils";
import { fetchB2BJson } from "@/lib/b2b";
import { approvePO, rejectPO, markOrdered, cancelPO } from "./actions";
import { FileCheck2, Clock, CheckCircle2, Truck, XCircle, FileEdit, Plus, ShoppingCart } from "lucide-react";
import { POActionBanner } from "@/components/b2b/po-action-banner";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = { title: `Purchase Orders — ${platformName()} for Business` };

// Six states, four tones. The amber pair that used to be written out per theme
// (`text-amber-600 dark:text-amber-400`) is now one token that has a dark value.
const STATUS: Record<string, { label: string; tone: PillTone; icon: typeof Clock }> = {
  DRAFT: { label: "Draft", tone: "neutral", icon: FileEdit },
  PENDING_APPROVAL: { label: "Pending approval", tone: "warning", icon: Clock },
  APPROVED: { label: "Approved", tone: "primary", icon: CheckCircle2 },
  ORDERED: { label: "Ordered", tone: "success", icon: Truck },
  REJECTED: { label: "Rejected", tone: "danger", icon: XCircle },
  CANCELLED: { label: "Cancelled", tone: "neutral", icon: XCircle },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PurchaseOrdersPage({ searchParams }: { searchParams?: { poDone?: string; poError?: string } }) {
  type PurchaseOrderRow = {
    id: string;
    poNumber: string;
    requesterId: string;
    status: string;
    currency: SupportedCurrency;
    total: string | number;
    notes: string | null;
    requiredDate: string | null;
    createdAt: string;
    items: Array<{ id: string; sku: string; nameEn: string; quantity: number }>;
  };
  type PurchaseOrderData = {
    company: { nameEn: string; country: string };
    isApprover: boolean;
    purchaseOrders: PurchaseOrderRow[];
    requesters: Array<{ id: string; firstName: string; lastName: string }>;
  };

  let data: PurchaseOrderData;
  try {
    data = await fetchB2BJson<PurchaseOrderData>("/api/b2b/purchase-orders");
  } catch {
    return (
      <B2BShell title="Purchase Orders">
        <Surface rung={2}>
          <EmptyState
            eyebrow="No company context"
            headline="This session is not attached to an active company account."
            body="Purchase orders belong to a company, not to a person. Sign in with an active company membership to manage them."
          />
        </Surface>
      </B2BShell>
    );
  }

  const pos = data.purchaseOrders;
  const nameOf = new Map(data.requesters.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const isApprover = data.isApprover;
  const open = pos.filter((p) => ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(p.status)).length;
  const pending = pos.filter((p) => p.status === "PENDING_APPROVAL").length;
  const orderedByCurrency = new Map<SupportedCurrency, number>();
  for (const po of pos.filter((row) => row.status === "ORDERED")) {
    orderedByCurrency.set(po.currency, (orderedByCurrency.get(po.currency) ?? 0) + Number(po.total));
  }
  // One row per currency, never a blended total: the platform holds no
  // exchange rates, so a sum across currencies is not a sum of anything.
  const orderedValue = [...orderedByCurrency.entries()].map(([currency, total]) => ({ currency, total }));

  return (
    <B2BShell
      eyebrow="Working"
      title="Purchase Orders"
      description={`Raise, approve and place governed POs for ${data.company.nameEn}.`}
      // /api/b2b/purchase-orders returns the 100 most recent POs, and every
      // count and money figure on this page is computed from that array. The
      // window is stated so no figure here can be mistaken for a lifetime one.
      dateline="Drawn from the 100 most recent purchase orders raised by this company, newest first"
    >
      <div className="space-y-block">
        <POActionBanner done={searchParams?.poDone} error={searchParams?.poError} />

        {/* Recessed, because it is context about how a PO is built — with the
            one action it leads to raised on top of it. */}
        <Surface rung={1} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="u-ui inline-flex items-center gap-2 font-medium text-ink-1">
              <ShoppingCart className="h-4 w-4 text-ink-3" aria-hidden="true" />
              Purchase orders come from real catalog lines
            </p>
            <p className="u-meta mt-1 text-ink-2">
              Add products to your cart, then create a company PO. A browser-entered total is never trusted.
            </p>
          </div>
          <Button asChild variant="primary" size="sm" className="shrink-0">
            <Link href="/b2b/purchase-orders/new">
              <Plus className="h-4 w-4" aria-hidden="true" /> Create PO from cart
            </Link>
          </Button>
        </Surface>

        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label="Pending approval"
            value={pending}
            rank="section"
            chip={pending > 0 ? "warning" : "neutral"}
            icon={Clock}
          />
          <Stat label="Open POs" value={open} icon={FileCheck2} note="Draft, pending or approved" />
          <div>
            <Eyebrow>Ordered value</Eyebrow>
            <div className="mt-1.5">
              <MoneyStack
                rows={orderedValue}
                dateline="Placed POs within the window above, each in the currency it was raised in · no conversion applied"
              />
            </div>
          </div>
          {/* "Listed", not "Total": pos.length is the size of a 100-row window. */}
          <Stat label="POs listed" value={pos.length} icon={FileEdit} />
        </CellGrid>

        <LedgerTable
          rows={pos}
          getRowKey={(po) => po.id}
          stickyHead
          // Not "snapshotted at approval": this column carries `total` for every
          // row, including drafts and POs still awaiting a decision, which have
          // never been through an approval to be snapshotted at.
          dateline="Each value is the server-priced total held on the PO, in the PO's own currency"
          columns={[
            {
              key: "poNumber",
              label: "PO #",
              render: (po) => <span className="u-mono font-medium text-primary-ink">{po.poNumber}</span>,
            },
            {
              key: "lines",
              label: "Lines",
              width: "260px",
              render: (po) =>
                po.items.length === 0 ? (
                  // Kept verbatim: a header-only PO predates line snapshotting
                  // and cannot be placed, and saying so is the whole point.
                  <span className="u-meta font-medium text-danger-ink">
                    Legacy header-only PO — recreate before placement
                  </span>
                ) : (
                  <div className="py-1">
                    <p className="font-medium text-ink-1">
                      {po.items.length} product line{po.items.length === 1 ? "" : "s"}
                    </p>
                    <p className="u-meta mt-0.5 truncate text-ink-3">
                      <span className="u-mono">
                        {po.items.slice(0, 3).map((item) => `${item.sku} × ${item.quantity}`).join(" · ")}
                      </span>
                      {po.items.length > 3 ? " …" : ""}
                    </p>
                  </div>
                ),
            },
            {
              key: "requester",
              label: "Requester",
              hideOnMobile: true,
              render: (po) => <span className="text-ink-2">{nameOf.get(po.requesterId) ?? "Unknown"}</span>,
            },
            {
              key: "total",
              label: "Approved value",
              numeric: true,
              render: (po) => <Money amount={Number(po.total)} currency={po.currency} />,
            },
            {
              key: "status",
              label: "Status",
              render: (po) => {
                const st = STATUS[po.status] ?? STATUS.DRAFT!;
                return (
                  <StatusPill tone={st.tone} className="whitespace-nowrap">
                    <st.icon className="h-3 w-3" aria-hidden="true" /> {st.label}
                  </StatusPill>
                );
              },
            },
            {
              key: "requiredDate",
              label: "Required",
              hideOnMobile: true,
              render: (po) => (
                <span className="u-meta whitespace-nowrap text-ink-3">
                  {po.requiredDate ? fmtDate(po.requiredDate) : "No date set"}
                </span>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              align: "end",
              render: (po) => (
                <div className="flex items-center justify-end gap-1">
                  {isApprover && po.status === "PENDING_APPROVAL" && (
                    <>
                      <form action={approvePO.bind(null, po.id)}>
                        <Button type="submit" variant="ghost" size="xs" className="text-success-ink hover:bg-success-soft hover:text-success-ink">
                          Approve
                        </Button>
                      </form>
                      <form action={rejectPO.bind(null, po.id)}>
                        <Button type="submit" variant="ghost" size="xs" className="hover:text-danger-ink">
                          Reject
                        </Button>
                      </form>
                    </>
                  )}
                  {po.status === "APPROVED" && po.items.length > 0 && (
                    <form action={markOrdered.bind(null, po.id)}>
                      <Button type="submit" variant="ghost" size="xs" className="text-primary-ink hover:bg-primary-soft hover:text-primary-ink">
                        Place order
                      </Button>
                    </form>
                  )}
                  {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(po.status) && (
                    <form action={cancelPO.bind(null, po.id)}>
                      <Button type="submit" variant="ghost" size="xs" className="hover:text-danger-ink">
                        Cancel
                      </Button>
                    </form>
                  )}
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="This company has raised no purchase orders."
              body="A PO is built from products already in the cart, so its lines and prices come from the catalogue rather than from a form. Start one with the button above."
            />
          }
        />
      </div>
    </B2BShell>
  );
}
