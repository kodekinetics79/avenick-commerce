import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAuditLogs, getAuditEntityTypes, AuditAction } from "@avenick/database";
import { FilterTabs, Pager, ConsoleSearch, queryHref } from "@/components/console/chrome";
import { ScrollText, X } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { Button, EmptyState, LedgerTable, PageHeader, StatusPill, type PillTone } from "@avenick/ui";

export const metadata = { title: "Audit Trail" };
export const dynamic = "force-dynamic";

/**
 * An action's tone. Only the three an operator scans for get one — something was
 * refused, something was revoked, something was destroyed — and everything else
 * stays neutral. Round one painted eleven actions in eight hand-mixed hues,
 * which is a legend nobody can hold in their head and, worse, made an ordinary
 * UPDATE as loud as a DELETE.
 */
const ACTION_TONE: Record<string, PillTone> = {
  REJECT: "danger",
  SUSPEND: "danger",
  DELETE: "danger",
};

interface PageProps {
  searchParams: { entityType?: string; action?: string; search?: string; page?: string };
}

type AuditRow = Awaited<ReturnType<typeof getAuditLogs>>["logs"][number];

/**
 * What changed, in one line. A status transition is rendered as one, a reason is
 * quoted, and anything else is stated as recorded-but-not-summarisable rather
 * than as an em dash — an em dash in a "Details" column reads as "nothing
 * happened", which on an audit register is the one wrong thing to imply.
 */
function detailOf(log: AuditRow): { text: string; muted: boolean } {
  const after = (log.after ?? {}) as Record<string, unknown>;
  const before = (log.before ?? {}) as Record<string, unknown>;
  if (typeof after["reason"] === "string" && after["reason"].trim()) {
    return { text: after["reason"], muted: false };
  }
  if (before["status"] && after["status"]) {
    return { text: `${String(before["status"])} → ${String(after["status"])}`, muted: false };
  }
  if (after["status"]) return { text: `→ ${String(after["status"])}`, muted: false };
  return { text: "Recorded with no summarisable change", muted: true };
}

export default async function AuditPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 50;
  const action = Object.values(AuditAction).includes(searchParams.action as AuditAction)
    ? (searchParams.action as AuditAction)
    : undefined;
  const entityType = searchParams.entityType?.trim() || undefined;
  const search = searchParams.search?.trim() || undefined;

  const [{ logs, total }, entityTypes] = await Promise.all([
    getAuditLogs({ page, limit, entityType, action, search }),
    getAuditEntityTypes(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const href = (next: Record<string, string | undefined>) => queryHref("/audit", searchParams, next);
  const filtered = Boolean(search || entityType || action);

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Settings"
          title="Audit trail"
          description="Every administrative and system action the platform recorded, in the order it happened."
          actions={<StatusPill>Read only</StatusPill>}
          /* Round one closed this header with a band of four stat cards, one of
             which read "Page 2 / 17". A pagination cursor is not a metric, and
             "Actions tracked: 11" counts an enum rather than anything that
             happened. The one number worth stating is how many events match what
             the operator is currently looking at, and the pager already says it
             in full — so the band is gone rather than filled. */
          dateline={`${total.toLocaleString()} ${total === 1 ? "event" : "events"} ${filtered ? "match the filters in force" : "recorded"} · the register is append-only and external retention is not activated`}
        />

        <div className="flex flex-wrap items-start gap-3">
          <FilterTabs
            label="Filter the audit trail by entity type"
            tabs={[
              { href: href({ entityType: undefined }), label: "All entities", active: !entityType },
              ...entityTypes.map((t) => ({
                href: href({ entityType: t }),
                label: t,
                active: entityType === t,
              })),
            ]}
          />
          <ConsoleSearch
            className="ms-auto"
            action="/audit"
            label="Search the audit trail by entity id or actor email"
            placeholder="Entity id or actor email…"
            defaultValue={search}
            preserve={{ entityType, action }}
            clearHref={href({ search: undefined })}
          />
        </div>

        {/* The action filter has no chip row of its own: eleven more chips beside
            the entity types is a wall. It is set by clicking an action in the
            table and cleared here, which is the only place it needs to be
            visible — an applied filter the operator cannot see is how a register
            silently lies about what it contains. */}
        {action && (
          <p className="flex flex-wrap items-center gap-2">
            <span className="u-meta text-ink-3">Showing only</span>
            <StatusPill tone={ACTION_TONE[action] ?? "neutral"}>{action.replace(/_/g, " ")}</StatusPill>
            <Button variant="ghost" size="xs" asChild>
              <Link href={href({ action: undefined })}>
                <X className="h-3 w-3" aria-hidden="true" /> Show every action
              </Link>
            </Button>
          </p>
        )}

        <LedgerTable<AuditRow>
          rows={logs}
          getRowKey={(log) => log.id}
          density="compact"
          stickyHead
          columns={[
            {
              key: "time",
              label: "Recorded",
              width: "168px",
              render: (log) => (
                <span className="tnum text-ink-2">{format(log.createdAt, "d MMM yyyy HH:mm:ss")}</span>
              ),
            },
            {
              key: "actor",
              label: "Actor",
              render: (log) =>
                log.actor ? (
                  <>
                    <span className="block truncate text-ink-1">
                      {`${log.actor.firstName} ${log.actor.lastName}`.trim() || log.actor.email}
                    </span>
                    <span className="u-meta block truncate text-ink-3">{log.actor.email}</span>
                  </>
                ) : (
                  // Not "—": an action with no actor was taken by the platform
                  // itself, which is a different fact from a missing value.
                  <span className="u-meta text-ink-3">The platform, with no acting person</span>
                ),
            },
            {
              key: "action",
              label: "Action",
              width: "156px",
              render: (log) => (
                <Link href={href({ action: log.action })} className="u-focus inline-block rounded-nested">
                  <StatusPill tone={ACTION_TONE[log.action] ?? "neutral"}>
                    {log.action.replace(/_/g, " ")}
                  </StatusPill>
                  <span className="sr-only"> — show only this action</span>
                </Link>
              ),
            },
            {
              key: "entity",
              label: "Entity",
              width: "196px",
              render: (log) => (
                <>
                  <Link href={href({ entityType: log.entityType })} className="u-focus block rounded-nested text-ink-1 underline-offset-4 hover:underline">
                    {log.entityType}
                    <span className="sr-only"> — show only this entity type</span>
                  </Link>
                  <span className="u-mono u-meta block truncate text-ink-3">{log.entityId}</span>
                </>
              ),
            },
            {
              key: "detail",
              label: "What changed",
              hideOnMobile: true,
              render: (log) => {
                const detail = detailOf(log);
                return <span className={detail.muted ? "u-meta text-ink-3" : "text-ink-2"}>{detail.text}</span>;
              },
            },
          ]}
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(p) => href({ page: String(p), search, entityType, action })}
              summary={`${total.toLocaleString()} ${total === 1 ? "event" : "events"}${filtered ? " match these filters" : ""}`}
            />
          }
          empty={
            filtered ? (
              <EmptyState
                eyebrow="No match"
                headline="No recorded event matches the filters currently applied."
                body="The register itself is not empty — clearing the filters returns every event it holds."
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/audit">Clear the filters</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                variant="certificate"
                glyph={<ScrollText />}
                eyebrow="Nothing recorded"
                headline="No administrative or system action has been written to this register yet."
                body="An entry is appended the moment anyone approves a supplier, changes a status, moves a payout or erases a subject. Nothing in it is ever edited or removed."
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/dashboard">Back to the command center</Link>
                  </Button>
                }
              />
            )
          }
        />
      </div>
    </AdminLayout>
  );
}
