import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { checkDatabaseHealth, db, getIntegrationOperationalSummary } from "@avenick/database";
import { AlertTriangle, Database, Plug, RefreshCcw, ServerCog } from "lucide-react";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Eyebrow, Dateline, Button,
  type PillTone,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";
import { CONTROL, CONTROL_SM } from "@/components/console/chrome";
import { configureCompanyOrderRoute, createIntegrationConnection, redriveInboundIntegrationMessage, redriveIntegrationMessage, setIntegrationConnectionStatus } from "./actions";

export const metadata = { title: "Integration Hub" };
export const dynamic = "force-dynamic";

function fmtDate(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "Never";
}

export default async function IntegrationsPage() {
  await requireAdminSession();
  const [dbHealth, summary, failedMessages, failedInboundMessages, companies, routes] = await Promise.all([
    checkDatabaseHealth(),
    getIntegrationOperationalSummary(),
    db.integrationOutbox.findMany({
      where: { status: { in: ["DEAD", "RETRY"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.integrationInbox.findMany({
      where: { status: { in: ["DEAD", "RETRY"] } },
      orderBy: { receivedAt: "desc" },
      take: 20,
    }),
    db.company.findMany({ where: { deletedAt: null }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true } }),
    db.integrationCompanyRoute.findMany({ where: { tenantKey: "default", purpose: "ORDER_SUBMISSION" } }),
  ]);
  const env = (key: string) => Boolean(process.env[key]);
  // installRedisRateLimitStore() / installRedisCacheStore() install the shared
  // store if and only if BOTH of these are present, so this is the actual
  // install condition rather than a proxy for it. It reports this admin
  // instance; each portal carries its own environment.
  // Trimmed, because both install functions read them with `?.trim()`: a
  // whitespace-only value installs nothing and must not report as configured.
  const envSet = (key: string) => Boolean(process.env[key]?.trim());
  const redisShared = envSet("UPSTASH_REDIS_REST_URL") && envSet("UPSTASH_REDIS_REST_TOKEN");

  const runtimeServices = [
    {
      name: "PostgreSQL",
      category: "Database",
      state: dbHealth.ok ? "LIVE" : "DOWN",
      detail: dbHealth.ok ? `Health query ${dbHealth.latencyMs}ms` : dbHealth.error ?? "Unreachable",
      truth: "Health verified by this deployment.",
    },
    {
      name: "Checkout.com",
      category: "Payments",
      state: env("CHECKOUT_SECRET_KEY") && env("CHECKOUT_WEBHOOK_SECRET") ? "INCOMPLETE" : "NOT_CONFIGURED",
      detail: env("CHECKOUT_SECRET_KEY") ? "Credentials detected" : "Credentials missing",
      truth: "Signed webhook consumption exists, but outbound payment-session initiation is not implemented yet. Card/mada/Apple Pay therefore fail closed.",
    },
    {
      name: "Resend",
      category: "Messaging",
      state: env("RESEND_API_KEY") ? "CONFIGURED" : "NOT_CONFIGURED",
      detail: env("RESEND_API_KEY") ? "Credential present" : "Email disabled",
      truth: "Presence only; no provider health check has been recorded on this screen.",
    },
    {
      name: "Twilio",
      category: "Messaging",
      state: env("TWILIO_AUTH_TOKEN") ? "CONFIGURED" : "NOT_CONFIGURED",
      detail: env("TWILIO_AUTH_TOKEN") ? "Credential present" : "SMS/WhatsApp disabled",
      truth: "Presence only; no provider health check has been recorded on this screen.",
    },
    {
      name: "S3 / MinIO",
      category: "Storage",
      state: env("S3_ENDPOINT") && env("S3_ACCESS_KEY") ? "CONFIGURED" : "NOT_CONFIGURED",
      detail: env("S3_ENDPOINT") ? "Endpoint configured" : "Uploads disabled",
      truth: "Configuration presence only. Pilot media import should run only after a write/read/delete probe succeeds.",
    },
    {
      name: "Elasticsearch",
      category: "Search",
      state: "NOT_IMPLEMENTED",
      detail: env("ELASTICSEARCH_URL") ? "Endpoint set but never read" : "No endpoint set",
      truth: "No Elasticsearch client dependency or indexing/query code exists in this repository, so this is not a fallback — catalog search is served entirely by PostgreSQL. The environment variable proves configuration intent only.",
    },
    {
      name: "Redis",
      category: "Infrastructure",
      state: redisShared ? "CONFIGURED" : "DEGRADED",
      detail: redisShared ? "Upstash REST credentials present" : "In-memory store, this process only",
      truth: redisShared
        ? "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are both set, which is the condition under which the shared store is installed at boot. Credential presence only — no Redis reachability probe has been recorded on this screen."
        : "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are unset, so the shared store was never installed: rate limiting and the read cache run in per-process memory, are not shared across instances and reset on every restart. Per-IP login, registration and catalog throttles are therefore only as strong as one instance. REDIS_URL is read by no code in this repository and configures nothing.",
    },
  ];

  // Four states, four tones. A credential being present is never green here —
  // only a state this deployment has actually verified is.
  const stateTone = (state: string): PillTone => {
    if (["LIVE", "ACTIVE", "PROCESSED"].includes(state)) return "success";
    if (["DOWN", "DEAD"].includes(state)) return "danger";
    if (["INCOMPLETE", "DEGRADED", "RETRY"].includes(state)) return "warning";
    return "neutral";
  };

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Platform"
          title="Integration hub"
          description="Configuration, health evidence, durable queue state and ERP acceptance truth are shown separately."
          dateline="A credential being present is never presented as a successful integration"
        />

        {/* Two panels rather than one seven-cell strip: the outbound queue and
            the inbound queue are different ledgers and were never one row. */}
        <div className="space-y-4">
          <div>
            <Eyebrow className="mb-2">Outbound durable queue</Eyebrow>
            <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
              <CountStat label="Pending" value={summary.outbox.pending} />
              <CountStat label="Processing" value={summary.outbox.processing} />
              <CountStat label="Retry" value={summary.outbox.retry} tone={summary.outbox.retry > 0 ? "warning" : "default"} />
              <CountStat label="Dead-letter" value={summary.outbox.dead} tone={summary.outbox.dead > 0 ? "danger" : "default"} />
            </CellGrid>
          </div>
          <div>
            <Eyebrow className="mb-2">Registry and inbound queue</Eyebrow>
            <CellGrid cols={{ base: 1, sm: 3 }} density="compact">
              <CountStat label="ERP connections" value={summary.connections.length} rank="section" />
              <CountStat label="Inbound retry" value={summary.inbox.retry ?? 0} tone={(summary.inbox.retry ?? 0) > 0 ? "warning" : "default"} />
              <CountStat label="Inbound dead" value={summary.inbox.dead ?? 0} tone={(summary.inbox.dead ?? 0) > 0 ? "danger" : "default"} />
            </CellGrid>
          </div>
        </div>

        <section>
          <h2 className="u-h3 mb-3 inline-flex items-center gap-2 text-ink-1">
            <Plug className="h-4 w-4 text-ink-3" aria-hidden="true" /> Runtime services
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {runtimeServices.map((service) => (
              <Surface key={service.name} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-nested bg-neutral-soft text-ink-3">
                      {service.name === "PostgreSQL" ? <Database className="h-4 w-4" aria-hidden="true" /> : <ServerCog className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <p className="u-ui font-medium text-ink-1">{service.name}</p>
                      <Eyebrow>{service.category}</Eyebrow>
                    </div>
                  </div>
                  <StatusPill tone={stateTone(service.state)} className="shrink-0 whitespace-nowrap">
                    {service.state.replaceAll("_", " ")}
                  </StatusPill>
                </div>
                <p className="u-meta mt-3 font-medium text-ink-1">{service.detail}</p>
                {/* The provenance line is the point of this card: it says exactly
                    what has and has not been verified. */}
                <Dateline className="mt-1">{service.truth}</Dateline>
              </Surface>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
          <Surface className="p-5">
            <h2 className="u-h3 text-ink-1">Register ERP / operational system</h2>
            <Dateline className="mt-1">
              Only secret-manager references are stored. Editing a connection always returns it to Disabled until an
              admin explicitly activates it.
            </Dateline>
            <form action={createIntegrationConnection} className="mt-4 grid gap-3">
              <label className="u-meta flex flex-col gap-1 text-ink-2">
                System
                <select name="system" data-rung={1} className={CONTROL} defaultValue="D365">
                  <option>D365</option><option>SAP</option><option>ERP</option><option>WMS</option><option>PIM</option>
                </select>
              </label>
              <label className="u-meta flex flex-col gap-1 text-ink-2">
                Connection key
                <input name="connectionKey" data-rung={1} className={CONTROL} required placeholder="primary-ksa" pattern="[a-z0-9][a-z0-9_-]{1,48}" />
              </label>
              <label className="u-meta flex flex-col gap-1 text-ink-2">
                Name
                <input name="name" data-rung={1} className={CONTROL} required placeholder="Dynamics 365 — KSA Production" minLength={2} maxLength={120} />
              </label>
              <label className="u-meta flex flex-col gap-1 text-ink-2">
                Base URL
                <input name="baseUrl" data-rung={1} className={CONTROL} placeholder="https://erp.example.com" type="url" />
              </label>
              <label className="u-meta flex flex-col gap-1 text-ink-2">
                Credentials reference
                <input name="credentialsRef" data-rung={1} className={CONTROL} placeholder="env:D365_CLIENT_SECRET" />
              </label>
              <Button type="submit" variant="secondary" size="md" className="justify-self-start">
                Save disabled connection
              </Button>
            </form>
          </Surface>

          <LedgerTable
            title="ERP / system registry"
            dateline="ACTIVE means administratively enabled. “Verified” requires a recorded successful health or transaction event."
            rows={summary.connections}
            getRowKey={(connection) => connection.id}
            density="compact"
            columns={[
              {
                key: "system",
                label: "System",
                render: (connection) => (
                  <div className="min-w-0 py-1">
                    <p className="font-medium text-ink-1">{connection.name}</p>
                    <p className="u-mono u-meta text-ink-3">{connection.system}/{connection.connectionKey}</p>
                  </div>
                ),
              },
              {
                key: "endpoint",
                label: "Endpoint / secret ref",
                hideOnMobile: true,
                render: (connection) => (
                  <div className="py-1">
                    <p className="u-meta max-w-[260px] truncate text-ink-2">{connection.baseUrl ?? "No endpoint"}</p>
                    <p className="u-meta text-ink-3">{connection.credentialsRef ? "Secret reference set" : "No secret reference"}</p>
                  </div>
                ),
              },
              {
                key: "evidence",
                label: "Evidence",
                render: (connection) => {
                  const verified = Boolean(connection.lastSuccessAt && (!connection.lastFailureAt || connection.lastSuccessAt > connection.lastFailureAt));
                  return (
                    <div className="py-1">
                      <p className={`u-meta font-medium ${verified ? "text-success-ink" : "text-ink-3"}`}>
                        {verified ? "Last result: verified success" : "No verified success"}
                      </p>
                      <p className="u-meta text-ink-3">Success: {fmtDate(connection.lastSuccessAt)}</p>
                      {connection.lastError && (
                        <p className="u-meta mt-1 max-w-[260px] truncate text-danger-ink" title={connection.lastError}>
                          {connection.lastError}
                        </p>
                      )}
                    </div>
                  );
                },
              },
              {
                key: "state",
                label: "State",
                render: (connection) => <StatusPill tone={stateTone(connection.status)}>{connection.status}</StatusPill>,
              },
              {
                key: "control",
                label: "Control",
                width: "280px",
                render: (connection) => (
                  <div className="flex flex-col gap-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {connection.status !== "ACTIVE" && (
                        <form action={setIntegrationConnectionStatus.bind(null, connection.id, "ACTIVE")}>
                          <Button type="submit" variant="secondary" size="xs">Activate</Button>
                        </form>
                      )}
                      {connection.status !== "DISABLED" && (
                        <form action={setIntegrationConnectionStatus.bind(null, connection.id, "DISABLED")}>
                          <Button type="submit" variant="ghost" size="xs">Disable</Button>
                        </form>
                      )}
                    </div>
                    {["D365", "SAP", "ERP"].includes(connection.system) && (
                      <form action={configureCompanyOrderRoute.bind(null, connection.id)} className="flex max-w-[260px] gap-1">
                        <select
                          name="companyId"
                          data-rung={1}
                          className={`${CONTROL_SM} min-w-0 flex-1`}
                          aria-label={`Company to route through ${connection.name}`}
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>Route company…</option>
                          {companies.map((company) => <option key={company.id} value={company.id}>{company.nameEn}</option>)}
                        </select>
                        <select
                          name="enabled"
                          data-rung={1}
                          className={`${CONTROL_SM} w-auto shrink-0`}
                          aria-label={`Assign or remove the route on ${connection.name}`}
                          defaultValue="true"
                        >
                          <option value="true">Assign</option>
                          <option value="false">Remove</option>
                        </select>
                        <Button type="submit" variant="secondary" size="xs" className="shrink-0">Apply</Button>
                      </form>
                    )}
                    <Eyebrow>{routes.filter((route) => route.connectionId === connection.id).length} company route(s)</Eyebrow>
                  </div>
                ),
              },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing registered"
                headline="No ERP, WMS or PIM connection has been registered."
                body="Register one on the left. It is saved disabled until an administrator explicitly activates it."
                icon={<ServerCog className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            }
          />
        </section>

        <LedgerTable
          title="Outbound retry / dead-letter queue"
          dateline="Manual redrive is explicit and audited; processed messages cannot be replayed from this control."
          toolbar={<RefreshCcw className="h-4 w-4 text-ink-3" aria-hidden="true" />}
          rows={failedMessages}
          getRowKey={(message) => message.id}
          density="compact"
          // Hover deepens the same hue; the generic row hover is a plain
          // background-color and would otherwise replace the dead-letter wash.
          rowProps={(message) => ({ className: message.status === "DEAD" ? "bg-danger-soft hover:bg-danger/10" : undefined })}
          columns={[
            {
              key: "event",
              label: "Event",
              render: (message) => (
                <div className="min-w-0 py-1">
                  <p className="font-medium text-ink-1">{message.eventType}</p>
                  <p className="u-mono u-meta text-ink-3">{message.aggregateType}:{message.aggregateId}</p>
                </div>
              ),
            },
            { key: "destination", label: "Destination", render: (message) => <span className="text-ink-2">{message.destination}</span> },
            { key: "attempts", label: "Attempts", numeric: true, render: (message) => message.attempts },
            {
              key: "lastError",
              label: "Last error",
              render: (message) => (
                <span className="block max-w-[320px] truncate text-meta text-danger-ink" title={message.lastError ?? undefined}>
                  {message.lastError ?? "—"}
                </span>
              ),
            },
            { key: "status", label: "State", render: (message) => <StatusPill tone={stateTone(message.status)}>{message.status}</StatusPill> },
            {
              key: "redrive",
              label: "Redrive",
              align: "end",
              render: (message) => (
                <form action={redriveIntegrationMessage.bind(null, message.id)} className="flex justify-end">
                  <Button type="submit" variant="secondary" size="xs">Redrive</Button>
                </form>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Queue is clear"
              headline="No outbound message is in retry or dead-letter."
              body="A message lands here only after the durable outbox has exhausted its automatic attempts."
            />
          }
        />

        <LedgerTable
          title="Inbound retry / dead-letter queue"
          dateline="Provider deliveries retain source identity, attempt history and audited manual redrive."
          toolbar={<RefreshCcw className="h-4 w-4 text-ink-3" aria-hidden="true" />}
          rows={failedInboundMessages}
          getRowKey={(message) => message.id}
          density="compact"
          // Hover deepens the same hue; the generic row hover is a plain
          // background-color and would otherwise replace the dead-letter wash.
          rowProps={(message) => ({ className: message.status === "DEAD" ? "bg-danger-soft hover:bg-danger/10" : undefined })}
          columns={[
            {
              key: "event",
              label: "Event",
              render: (message) => (
                <div className="min-w-0 py-1">
                  <p className="font-medium text-ink-1">{message.eventType}</p>
                  <p className="u-mono u-meta text-ink-3">{message.externalEventId}</p>
                </div>
              ),
            },
            { key: "source", label: "Source", render: (message) => <span className="text-ink-2">{message.source}</span> },
            { key: "attempts", label: "Attempts", numeric: true, render: (message) => message.attempts },
            {
              key: "lastError",
              label: "Last error",
              render: (message) => (
                <span className="block max-w-[320px] truncate text-meta text-danger-ink" title={message.lastError ?? undefined}>
                  {message.lastError ?? "—"}
                </span>
              ),
            },
            { key: "status", label: "State", render: (message) => <StatusPill tone={stateTone(message.status)}>{message.status}</StatusPill> },
            {
              key: "redrive",
              label: "Redrive",
              align: "end",
              render: (message) => (
                <form action={redriveInboundIntegrationMessage.bind(null, message.id)} className="flex justify-end">
                  <Button type="submit" variant="secondary" size="xs">Redrive</Button>
                </form>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Queue is clear"
              headline="No inbound message is in retry or dead-letter."
              body="A provider delivery lands here only after its automatic attempts are exhausted."
            />
          }
        />

        <Surface tone="warning" className="flex gap-2 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
          <p className="u-ui max-w-prose text-ink-1">
            <span className="font-medium">Activation is not certification.</span> A connection can be administratively
            active while health is unverified. Production-pilot certification requires a successful provider/ERP
            handshake plus an accepted and rejected transaction scenario with evidence.
          </p>
        </Surface>
      </div>
    </AdminLayout>
  );
}
