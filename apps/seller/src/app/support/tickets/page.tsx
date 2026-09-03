import Link from "next/link";
import { requireSellerPermission } from "@/lib/auth";
import { db } from "@avenick/database";
import { format } from "date-fns";
import { SellerLayout } from "@/components/layout/seller-layout";
import { cn } from "@avenick/utils";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  PageHeader,
  Stat,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { AlertCircle, CheckCircle, CircleOff, Clock, LifeBuoy } from "lucide-react";

export const metadata = { title: "Support tickets" };

/**
 * Status → tone, never status → hue. The four semantic tones have real values in
 * both themes; the `bg-amber-500/10` / `bg-green-500/10` / `bg-muted` washes this
 * page used to carry are raw palette values tuned for neither.
 *
 * `rule` is the 3px inline-start rule — the same always-present, colour-only
 * signal the RFQ inbox and the listing-issue list use, so a supplier reads
 * "waiting on someone" the same way on all three surfaces.
 */
const STATUS: Record<string, { label: string; tone: PillTone; icon: typeof Clock; rule: string; open: boolean }> = {
  OPEN:        { label: "Open",        tone: "warning", icon: AlertCircle, rule: "border-warning",       open: true },
  IN_PROGRESS: { label: "In progress", tone: "primary", icon: Clock,       rule: "border-primary",       open: true },
  RESOLVED:    { label: "Resolved",    tone: "success", icon: CheckCircle, rule: "border-transparent",   open: false },
  CLOSED:      { label: "Closed",      tone: "neutral", icon: CheckCircle, rule: "border-transparent",   open: false },
};

const statusView = (status: string) =>
  STATUS[status] ?? {
    label: status.replace(/_/g, " ").toLowerCase(),
    tone: "neutral" as PillTone,
    icon: Clock,
    rule: "border-transparent",
    open: false,
  };

/**
 * Priority is the stored SupportPriority enum, spelled exactly — LOW, NORMAL,
 * HIGH, URGENT. It is stated, never graded and never coloured: the platform
 * publishes no response-time commitment, so drawing "URGENT" in red would imply
 * a promise nothing behind it supports.
 */
const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low priority",
  NORMAL: "Normal priority",
  HIGH: "High priority",
  URGENT: "Urgent priority",
};

const TICKET_LIMIT = 50;

export default async function TicketsPage() {
  const { seller, membership } = await requireSellerPermission("support.view");

  const [tickets, total] = await Promise.all([
    db.supportTicket.findMany({
      where: { userId: seller.userId },
      orderBy: { createdAt: "desc" },
      take: TICKET_LIMIT,
    }),
    db.supportTicket.count({ where: { userId: seller.userId } }),
  ]);

  const openTickets = tickets.filter((ticket) => statusView(ticket.status).open);
  const settledTickets = tickets.filter((ticket) => !statusView(ticket.status).open);
  const capped = total > tickets.length;

  const groups = [
    { key: "open", title: "Waiting on the platform", rows: openTickets, note: "Open and in-progress tickets you have raised." },
    { key: "settled", title: "Resolved and closed", rows: settledTickets, note: "Tickets the platform has finished with." },
  ].filter((group) => group.rows.length > 0);

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          className="mb-0"
          eyebrow="Support"
          title="Support tickets"
          description="Every support ticket recorded against your account, most recent first."
          dateline={
            capped
              ? `The ${tickets.length} most recent of ${total} tickets on this account · counts describe the rows listed here`
              : "Read from your own support records · a ticket appears here as soon as it exists"
          }
          actions={
            // The disabled-control problem, solved by not rendering a control.
            // Ticket creation is not connected, so this states the fact once
            // rather than showing a button that cannot do anything.
            <StatusPill tone="neutral">
              <CircleOff className="h-3 w-3" aria-hidden="true" /> Ticket creation unavailable
            </StatusPill>
          }
        />

        {/* Open leads at section rank. A row of four identically-weighted counts
            is exactly why nothing on a console page could be subordinate to
            anything — the number a supplier came for is the one still waiting. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label="Waiting on the platform"
            value={openTickets.length}
            rank="section"
            icon={AlertCircle}
            chip={openTickets.length > 0 ? "warning" : "neutral"}
            note="Open or in progress."
          />
          <Stat
            label="Resolved"
            value={tickets.filter((t) => t.status === "RESOLVED").length}
            icon={CheckCircle}
            note="Answered and marked resolved."
          />
          <Stat
            label="Closed"
            value={tickets.filter((t) => t.status === "CLOSED").length}
            icon={CheckCircle}
            note="Closed without a further reply."
          />
          <Stat label="Listed here" value={tickets.length} icon={LifeBuoy} note="Rows shown on this page." />
        </CellGrid>

        {tickets.length === 0 ? (
          <EmptyState
            variant="certificate"
            glyph={<LifeBuoy />}
            eyebrow="Nothing recorded"
            headline="No support ticket has been raised on this account."
            body="Ticket creation is deliberately not connected here: a form that cannot persist and audit what it submits is a promise, not a feature. Existing tickets appear on this page the moment the platform records one."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/support/contact">How to reach the platform</Link>
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
                    {group.rows.map((ticket) => {
                      const view = statusView(ticket.status);
                      const StatusIcon = view.icon;
                      return (
                        <li
                          key={ticket.id}
                          // Always 3px, only the colour changes, so a resolved
                          // row and an open one cannot differ in width.
                          className={cn("border-s-[3px] px-4 py-3", view.rule)}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                            <div className="min-w-0 flex-1">
                              {/* Mono for the reference, which is exactly what
                                  mono is reserved for. It is also the string the
                                  platform will ask for. */}
                              <span className="u-mono u-micro text-ink-3">{ticket.ticketNumber}</span>
                              <p className="u-ui font-medium text-ink-1">{ticket.subject}</p>
                            </div>
                            <StatusPill tone={view.tone} className="shrink-0">
                              <StatusIcon className="h-3 w-3" aria-hidden="true" />
                              {view.label}
                            </StatusPill>
                          </div>
                          {ticket.description && (
                            <p className="u-meta mt-1 line-clamp-2 max-w-prose text-ink-2">{ticket.description}</p>
                          )}
                          <Dateline className="mt-1.5">
                            {PRIORITY_LABEL[ticket.priority] ?? ticket.priority.toLowerCase()} · raised{" "}
                            {/* The portal's own date shape, not a raw ISO
                                string: every other date a supplier reads here is
                                "3 Sep 2026", and toISOString additionally renders
                                in UTC, so a ticket raised late in a Gulf evening
                                printed the previous day. */}
                            {format(ticket.createdAt, "d MMM yyyy")}
                            {ticket.orderRef ? ` · order ${ticket.orderRef}` : ""}
                          </Dateline>
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
