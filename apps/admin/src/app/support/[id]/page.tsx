import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getSupportTicket } from "@avenick/database";
import { setTicketStatus } from "../actions";
import { User, Tag, Package } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Button, CellGrid, Dateline, Eyebrow, FieldWell, PageHeader, Stat, StatusPill, Surface, type PillTone,
} from "@avenick/ui";

export const metadata = { title: "Ticket Detail" };
export const dynamic = "force-dynamic";

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

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  await requireAdminSession();

  const ticket = await getSupportTicket(params.id);
  if (!ticket) notFound();

  const status = STATUS[ticket.status] ?? STATUS["OPEN"]!;

  // Exactly one forward action and, where the state allows it, one way back.
  // Round one offered up to four buttons in four different hand-mixed colours —
  // a green fill, a slate fill, a primary fill and an outline — which is four
  // vocabularies for one decision. Weight carries the rank now: the forward step
  // is raised, everything else is flat.
  const transitions: Array<{ to: "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "OPEN"; label: string; variant: "primary" | "secondary" | "ghost" }> = [];
  if (ticket.status === "OPEN") transitions.push({ to: "IN_PROGRESS", label: "Start working", variant: "primary" });
  if (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") {
    transitions.push({ to: "RESOLVED", label: "Mark resolved", variant: ticket.status === "IN_PROGRESS" ? "primary" : "secondary" });
  }
  if (ticket.status === "RESOLVED") {
    transitions.push({ to: "CLOSED", label: "Close ticket", variant: "primary" });
    transitions.push({ to: "IN_PROGRESS", label: "Reopen", variant: "ghost" });
  }
  if (ticket.status === "CLOSED") transitions.push({ to: "OPEN", label: "Reopen", variant: "ghost" });

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-block">
        <PageHeader
          eyebrow="Support"
          breadcrumbs={[{ label: "Support", href: "/support" }, { label: ticket.ticketNumber }]}
          linkComponent={Link}
          title={ticket.subject}
          dateline={`Opened ${format(ticket.createdAt, "d MMM yyyy 'at' HH:mm")} · last written to ${formatDistanceToNow(ticket.updatedAt, { addSuffix: true })} · every status change on this record is audit-logged`}
          actions={
            <>
              <StatusPill tone={PRIORITY_TONE[ticket.priority] ?? "neutral"}>{ticket.priority}</StatusPill>
              <StatusPill tone={status.tone} dot>{status.label}</StatusPill>
            </>
          }
        />

        {/* The three facts a person needs before they read a word of the
            complaint: who filed it, what it is about, and which order it names.
            A CellGrid rather than three bordered boxes — one panel divided by
            hairlines is one object, three cards are three. */}
        <CellGrid cols={{ base: 1, sm: 3 }} density="compact">
          <Stat
            label="Requester"
            value={`${ticket.user.firstName} ${ticket.user.lastName}`.trim() || ticket.user.email}
            rank="inline"
            icon={User}
            note={`${ticket.user.email} · ${ticket.user.role.replace(/_/g, " ").toLowerCase()}`}
          />
          <Stat label="Category" value={ticket.category.replace(/_/g, " ")} rank="inline" icon={Tag} />
          <Stat
            label="Order reference"
            value={ticket.orderRef ?? "None recorded"}
            rank="inline"
            icon={Package}
            note={ticket.orderRef ? undefined : "The customer did not attach an order to this ticket"}
          />
        </CellGrid>

        <Surface rung={2} className="p-4">
          <Eyebrow>What the customer wrote</Eyebrow>
          {/* Recessed, because it is the record being read rather than a control:
              law A holds even where nothing is clickable. `whitespace-pre-wrap`
              keeps the customer's own line breaks — reflowing somebody's
              complaint into one paragraph loses the shape of it. */}
          <FieldWell className="mt-2 p-4">
            <p className="u-body whitespace-pre-wrap text-ink-1">{ticket.description}</p>
          </FieldWell>
        </Surface>

        <Surface rung={2} className="flex flex-wrap items-center gap-2 p-4">
          {transitions.map((t) => (
            <form
              key={t.to}
              action={async () => {
                "use server";
                await setTicketStatus(ticket.id, t.to);
              }}
            >
              <Button type="submit" variant={t.variant} size="sm">
                {t.label}
              </Button>
            </form>
          ))}
          <Dateline className="ms-auto">
            Every transition is written to the audit stream with the acting administrator.
          </Dateline>
        </Surface>
      </div>
    </AdminLayout>
  );
}
