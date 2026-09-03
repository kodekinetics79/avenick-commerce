import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { setTicketStatus } from "./actions";
import { MessageSquare, Clock, CheckCircle, Activity, Scale, Gauge } from "lucide-react";
import Link from "next/link";
import {
  Button, CellGrid, EmptyState, LedgerTable, PageHeader, Stat, StatusPill, type PillTone,
} from "@avenick/ui";

export const metadata = { title: "Support Tickets" };

/** Enum → tone and label. The four states an operator distinguishes, and nothing else. */
const STATUS: Record<string, { label: string; tone: PillTone }> = {
  OPEN: { label: "Open", tone: "warning" },
  IN_PROGRESS: { label: "In progress", tone: "accent" },
  RESOLVED: { label: "Resolved", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

const PRIORITY_TONE: Record<string, PillTone> = {
  URGENT: "danger",
  HIGH: "warning",
  NORMAL: "neutral",
  LOW: "neutral",
};

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  orderRef: string | null;
  category: string;
  priority: string;
  status: string;
  createdAt: Date;
  user: { firstName: string; lastName: string; email: string };
};

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * One transition, as a real form posting a server action.
 *
 * The three of them deliberately do NOT look alike. Round one rendered them as
 * three identical 12px links in a row — Start / Resolve / Close — and in a
 * hundred-row queue the wrong one gets hit. Weight separates them instead of
 * colour, which survives both themes: the forward step is a raised secondary,
 * closing is a flat ghost.
 */
function Transition({
  id,
  number,
  to,
  label,
  variant,
}: {
  id: string;
  /** The ticket's own number, so a hundred identical buttons are not all "Start ticket". */
  number: string;
  to: "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  label: string;
  variant: "secondary" | "ghost";
}) {
  return (
    <form action={setTicketStatus.bind(null, id, to)}>
      <Button type="submit" variant={variant} size="xs">
        {label}
        <span className="sr-only"> ticket {number}</span>
      </Button>
    </form>
  );
}

export default async function SupportPage() {
  await requireAdminSession();

  const tickets = await db.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });

  const count = (s: string) => tickets.filter((t) => t.status === s).length;

  // The queue an operator opened this page to work, put first. The query is
  // newest-first across every state, so without this split the open tickets are
  // scattered through a hundred rows of already-closed ones.
  const live = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
  const settled = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED");

  const identity = (t: Ticket) => (
    <Link href={`/support/${t.id}`} className="u-focus block min-w-0 rounded-nested">
      <span className="block truncate font-medium text-ink-1">{t.subject}</span>
      <span className="u-meta block truncate text-ink-3">
        <span className="u-mono">{t.ticketNumber}</span> · {t.user.firstName} {t.user.lastName}
        {t.orderRef && <> · <span className="u-mono">{t.orderRef}</span></>}
      </span>
    </Link>
  );

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Support"
          title="Support tickets"
          description="Customer tickets raised across the marketplace. Every status change is written to the audit stream."
          dateline="The 100 most recently opened tickets, newest first. Counts below describe this loaded set, not the whole register."
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/disputes">
                  <Scale className="h-3.5 w-3.5" aria-hidden="true" /> Disputes
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/sla">
                  <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> SLA monitor
                </Link>
              </Button>
            </>
          }
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <Stat label="Open" value={count("OPEN")} icon={Clock} chip={count("OPEN") > 0 ? "warning" : "neutral"} />
          <Stat label="In progress" value={count("IN_PROGRESS")} icon={Activity} />
          <Stat label="Resolved" value={count("RESOLVED")} icon={CheckCircle} />
          <Stat label="Loaded" value={tickets.length} icon={MessageSquare} note="Of the whole register" />
        </CellGrid>

        <LedgerTable<Ticket>
          title="Awaiting a person"
          dateline="Tickets in OPEN or IN_PROGRESS, newest first · only tickets inside the 100 rows loaded on this page appear here"
          rows={live}
          getRowKey={(t) => t.id}
          stickyHead
          columns={[
            { key: "subject", label: "Ticket", render: identity },
            {
              key: "category",
              label: "Category",
              hideOnMobile: true,
              width: "128px",
              render: (t) => <span className="u-meta text-ink-2">{t.category.replace(/_/g, " ")}</span>,
            },
            {
              key: "priority",
              label: "Priority",
              width: "96px",
              render: (t) => <StatusPill tone={PRIORITY_TONE[t.priority] ?? "neutral"}>{t.priority}</StatusPill>,
            },
            {
              key: "status",
              label: "Status",
              width: "112px",
              render: (t) => (
                <StatusPill tone={STATUS[t.status]?.tone ?? "neutral"} dot>
                  {STATUS[t.status]?.label ?? t.status}
                </StatusPill>
              ),
            },
            {
              key: "opened",
              label: "Opened",
              hideOnMobile: true,
              width: "88px",
              render: (t) => <span className="tnum text-ink-2">{fmt(t.createdAt)}</span>,
            },
            {
              key: "decision",
              label: "Decision",
              align: "end",
              width: "184px",
              // ONE forward step per row, and only the one this register has
              // always offered. A "Close" on every live row would let a ticket
              // go from OPEN straight to CLOSED with no resolution ever
              // recorded — a path the detail screen deliberately does not
              // expose, and a capability a presentation pass has no business
              // adding. Closing happens on the ticket, where the resolution the
              // customer is owed was written.
              render: (t) => (
                <div className="flex items-center justify-end gap-1.5">
                  {t.status === "OPEN" && (
                    <Transition id={t.id} number={t.ticketNumber} to="IN_PROGRESS" label="Start" variant="secondary" />
                  )}
                  {t.status === "IN_PROGRESS" && (
                    <Transition id={t.id} number={t.ticketNumber} to="RESOLVED" label="Resolve" variant="secondary" />
                  )}
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              variant="certificate"
              glyph={<MessageSquare />}
              eyebrow="Queue clear"
              headline="No ticket in the loaded set is waiting on a person."
              body="A ticket appears here the moment a customer files one, and leaves it when someone resolves or closes it. Everything already decided is in the register below."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/sla">Check responsiveness</Link>
                </Button>
              }
            />
          }
        />

        <LedgerTable<Ticket>
          title="Already settled"
          dateline="Resolved and closed tickets in the loaded set, newest first"
          rows={settled}
          getRowKey={(t) => t.id}
          density="compact"
          columns={[
            { key: "subject", label: "Ticket", render: identity },
            {
              key: "category",
              label: "Category",
              hideOnMobile: true,
              width: "128px",
              render: (t) => <span className="u-meta text-ink-2">{t.category.replace(/_/g, " ")}</span>,
            },
            {
              key: "status",
              label: "Status",
              width: "112px",
              render: (t) => (
                <StatusPill tone={STATUS[t.status]?.tone ?? "neutral"}>{STATUS[t.status]?.label ?? t.status}</StatusPill>
              ),
            },
            {
              key: "opened",
              label: "Opened",
              align: "end",
              width: "88px",
              render: (t) => <span className="tnum text-ink-2">{fmt(t.createdAt)}</span>,
            },
          ]}
          footer={`${settled.length} settled ${settled.length === 1 ? "ticket" : "tickets"} loaded`}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No ticket in the loaded set has been resolved or closed."
              body="A ticket moves here once someone records a decision on it."
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
