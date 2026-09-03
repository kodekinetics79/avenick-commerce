import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { checkDatabaseHealth, db, getIntegrationOperationalSummary } from "@avenick/database";
import { AlertTriangle, Database, Plug, RefreshCcw, ServerCog } from "lucide-react";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Eyebrow, Dateline, Button,
  type PillTone,
} from "@avenick/ui";
import { getTranslations } from "next-intl/server";
import { CountStat } from "@/app/finance/money-figures";
import { CONTROL, CONTROL_SM } from "@/components/console/chrome";
import { configureCompanyOrderRoute, createIntegrationConnection, redriveInboundIntegrationMessage, redriveIntegrationMessage, setIntegrationConnectionStatus } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.integrations");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/**
 * Every operational state this screen can render. A state outside the set is
 * printed as its own code rather than under an invented label, so a new value
 * from the queue or the registry can never be silently mislabelled.
 */
const KNOWN_STATES = new Set([
  "LIVE", "DOWN", "CONFIGURED", "NOT_CONFIGURED", "INCOMPLETE", "NOT_IMPLEMENTED",
  "DEGRADED", "ACTIVE", "DISABLED", "DEAD", "RETRY", "PENDING", "PROCESSING", "PROCESSED",
]);

export default async function IntegrationsPage() {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.integrations");
  const fmtDate = (value: Date | null) =>
    value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : t("never");
  const stateLabel = (state: string) => (KNOWN_STATES.has(state) ? t(`state.${state}`) : state.replaceAll("_", " "));
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
      category: t("services.category.database"),
      state: dbHealth.ok ? "LIVE" : "DOWN",
      detail: dbHealth.ok ? t("services.postgresOk", { latency: String(dbHealth.latencyMs) }) : dbHealth.error ?? t("services.postgresUnreachable"),
      truth: t("services.postgresTruth"),
    },
    {
      name: "Checkout.com",
      category: t("services.category.payments"),
      state: env("CHECKOUT_SECRET_KEY") && env("CHECKOUT_WEBHOOK_SECRET") ? "INCOMPLETE" : "NOT_CONFIGURED",
      detail: env("CHECKOUT_SECRET_KEY") ? t("services.checkoutPresent") : t("services.checkoutMissing"),
      truth: t("services.checkoutTruth"),
    },
    {
      name: "Resend",
      category: t("services.category.messaging"),
      state: env("RESEND_API_KEY") ? "CONFIGURED" : "NOT_CONFIGURED",
      detail: env("RESEND_API_KEY") ? t("services.credentialPresent") : t("services.emailDisabled"),
      truth: t("services.presenceOnly"),
    },
    {
      name: "Twilio",
      category: t("services.category.messaging"),
      state: env("TWILIO_AUTH_TOKEN") ? "CONFIGURED" : "NOT_CONFIGURED",
      detail: env("TWILIO_AUTH_TOKEN") ? t("services.credentialPresent") : t("services.smsDisabled"),
      truth: t("services.presenceOnly"),
    },
    {
      name: "S3 / MinIO",
      category: t("services.category.storage"),
      state: env("S3_ENDPOINT") && env("S3_ACCESS_KEY") ? "CONFIGURED" : "NOT_CONFIGURED",
      detail: env("S3_ENDPOINT") ? t("services.s3Present") : t("services.s3Missing"),
      truth: t("services.s3Truth"),
    },
    {
      name: "Elasticsearch",
      category: t("services.category.search"),
      state: "NOT_IMPLEMENTED",
      detail: env("ELASTICSEARCH_URL") ? t("services.elasticSet") : t("services.elasticUnset"),
      truth: t("services.elasticTruth"),
    },
    {
      name: "Redis",
      category: t("services.category.infrastructure"),
      state: redisShared ? "CONFIGURED" : "DEGRADED",
      detail: redisShared ? t("services.redisShared") : t("services.redisLocal"),
      truth: redisShared ? t("services.redisTruthShared") : t("services.redisTruthLocal"),
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
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
        />

        {/* Two panels rather than one seven-cell strip: the outbound queue and
            the inbound queue are different ledgers and were never one row. */}
        <div className="space-y-4">
          <div>
            <Eyebrow className="mb-2">{t("outbox.title")}</Eyebrow>
            <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
              <CountStat label={t("outbox.pending")} value={summary.outbox.pending} />
              <CountStat label={t("outbox.processing")} value={summary.outbox.processing} />
              <CountStat label={t("outbox.retry")} value={summary.outbox.retry} tone={summary.outbox.retry > 0 ? "warning" : "default"} />
              <CountStat label={t("outbox.dead")} value={summary.outbox.dead} tone={summary.outbox.dead > 0 ? "danger" : "default"} />
            </CellGrid>
          </div>
          <div>
            <Eyebrow className="mb-2">{t("registry.title")}</Eyebrow>
            <CellGrid cols={{ base: 1, sm: 3 }} density="compact">
              <CountStat label={t("registry.connections")} value={summary.connections.length} rank="section" />
              <CountStat label={t("registry.inboundRetry")} value={summary.inbox.retry ?? 0} tone={(summary.inbox.retry ?? 0) > 0 ? "warning" : "default"} />
              <CountStat label={t("registry.inboundDead")} value={summary.inbox.dead ?? 0} tone={(summary.inbox.dead ?? 0) > 0 ? "danger" : "default"} />
            </CellGrid>
          </div>
        </div>

        <section>
          <h2 className="u-h3 mb-3 inline-flex items-center gap-2 text-ink-1">
            <Plug className="h-4 w-4 text-ink-3" aria-hidden="true" /> {t("services.title")}
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
                    {stateLabel(service.state)}
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
            <h2 className="u-h3 text-ink-1">{t("register.title")}</h2>
            <Dateline className="mt-1">{t("register.dateline")}</Dateline>
            <form action={createIntegrationConnection} className="mt-4 grid gap-3">
              <label className="u-meta flex flex-col gap-1 text-ink-2">
                {t("register.system")}
                <select name="system" data-rung={1} className={CONTROL} defaultValue="D365">
                  <option>D365</option><option>SAP</option><option>ERP</option><option>WMS</option><option>PIM</option>
                </select>
              </label>
              <label className="u-meta flex flex-col gap-1 text-ink-2">
                {t("register.connectionKey")}
                <input name="connectionKey" data-rung={1} className={CONTROL} required placeholder="primary-ksa" pattern="[a-z0-9][a-z0-9_-]{1,48}" />
              </label>
              <label className="u-meta flex flex-col gap-1 text-ink-2">
                {t("register.name")}
                <input name="name" data-rung={1} className={CONTROL} required placeholder="Dynamics 365 — KSA Production" minLength={2} maxLength={120} />
              </label>
              <label className="u-meta flex flex-col gap-1 text-ink-2">
                {t("register.baseUrl")}
                <input name="baseUrl" data-rung={1} className={CONTROL} placeholder="https://erp.example.com" type="url" />
              </label>
              <label className="u-meta flex flex-col gap-1 text-ink-2">
                {t("register.credentialsRef")}
                <input name="credentialsRef" data-rung={1} className={CONTROL} placeholder="env:D365_CLIENT_SECRET" />
              </label>
              <Button type="submit" variant="secondary" size="md" className="justify-self-start">
                {t("register.submit")}
              </Button>
            </form>
          </Surface>

          <LedgerTable
            title={t("registryTable.title")}
            dateline={t("registryTable.dateline")}
            rows={summary.connections}
            getRowKey={(connection) => connection.id}
            density="compact"
            columns={[
              {
                key: "system",
                label: t("registryTable.columns.system"),
                render: (connection) => (
                  <div className="min-w-0 py-1">
                    <p className="font-medium text-ink-1">{connection.name}</p>
                    <p className="u-mono u-meta text-ink-3">{connection.system}/{connection.connectionKey}</p>
                  </div>
                ),
              },
              {
                key: "endpoint",
                label: t("registryTable.columns.endpoint"),
                hideOnMobile: true,
                render: (connection) => (
                  <div className="py-1">
                    <p className="u-meta max-w-[260px] truncate text-ink-2">{connection.baseUrl ?? t("registryTable.noEndpoint")}</p>
                    <p className="u-meta text-ink-3">{connection.credentialsRef ? t("registryTable.secretSet") : t("registryTable.noSecret")}</p>
                  </div>
                ),
              },
              {
                key: "evidence",
                label: t("registryTable.columns.evidence"),
                render: (connection) => {
                  const verified = Boolean(connection.lastSuccessAt && (!connection.lastFailureAt || connection.lastSuccessAt > connection.lastFailureAt));
                  return (
                    <div className="py-1">
                      <p className={`u-meta font-medium ${verified ? "text-success-ink" : "text-ink-3"}`}>
                        {verified ? t("registryTable.verified") : t("registryTable.notVerified")}
                      </p>
                      <p className="u-meta text-ink-3">{t("registryTable.success", { date: fmtDate(connection.lastSuccessAt) })}</p>
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
                label: t("registryTable.columns.state"),
                render: (connection) => <StatusPill tone={stateTone(connection.status)}>{stateLabel(connection.status)}</StatusPill>,
              },
              {
                key: "control",
                label: t("registryTable.columns.control"),
                width: "280px",
                render: (connection) => (
                  <div className="flex flex-col gap-2 py-1">
                    <div className="flex flex-wrap gap-1">
                      {connection.status !== "ACTIVE" && (
                        <form action={setIntegrationConnectionStatus.bind(null, connection.id, "ACTIVE")}>
                          <Button type="submit" variant="secondary" size="xs">{t("registryTable.activate")}</Button>
                        </form>
                      )}
                      {connection.status !== "DISABLED" && (
                        <form action={setIntegrationConnectionStatus.bind(null, connection.id, "DISABLED")}>
                          <Button type="submit" variant="ghost" size="xs">{t("registryTable.disable")}</Button>
                        </form>
                      )}
                    </div>
                    {["D365", "SAP", "ERP"].includes(connection.system) && (
                      <form action={configureCompanyOrderRoute.bind(null, connection.id)} className="flex max-w-[260px] gap-1">
                        <select
                          name="companyId"
                          data-rung={1}
                          className={`${CONTROL_SM} min-w-0 flex-1`}
                          aria-label={t("registryTable.routeCompanyLabel", { name: connection.name })}
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>{t("registryTable.routeCompanyPlaceholder")}</option>
                          {companies.map((company) => <option key={company.id} value={company.id}>{company.nameEn}</option>)}
                        </select>
                        <select
                          name="enabled"
                          data-rung={1}
                          className={`${CONTROL_SM} w-auto shrink-0`}
                          aria-label={t("registryTable.routeModeLabel", { name: connection.name })}
                          defaultValue="true"
                        >
                          <option value="true">{t("registryTable.assign")}</option>
                          <option value="false">{t("registryTable.remove")}</option>
                        </select>
                        <Button type="submit" variant="secondary" size="xs" className="shrink-0">{t("registryTable.apply")}</Button>
                      </form>
                    )}
                    <Eyebrow>
                      {t("registryTable.routes", {
                        count: routes.filter((route) => route.connectionId === connection.id).length,
                        value: String(routes.filter((route) => route.connectionId === connection.id).length),
                      })}
                    </Eyebrow>
                  </div>
                ),
              },
            ]}
            empty={
              <EmptyState
                eyebrow={t("registryTable.emptyEyebrow")}
                headline={t("registryTable.emptyHeadline")}
                body={t("registryTable.emptyBody")}
                icon={<ServerCog className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            }
          />
        </section>

        <LedgerTable
          title={t("outboundQueue.title")}
          dateline={t("outboundQueue.dateline")}
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
              label: t("outboundQueue.columns.event"),
              render: (message) => (
                <div className="min-w-0 py-1">
                  <p className="font-medium text-ink-1">{message.eventType}</p>
                  <p className="u-mono u-meta text-ink-3">{message.aggregateType}:{message.aggregateId}</p>
                </div>
              ),
            },
            { key: "destination", label: t("outboundQueue.columns.destination"), render: (message) => <span className="text-ink-2">{message.destination}</span> },
            { key: "attempts", label: t("outboundQueue.columns.attempts"), numeric: true, render: (message) => message.attempts },
            {
              key: "lastError",
              label: t("outboundQueue.columns.lastError"),
              render: (message) => (
                <span className="block max-w-[320px] truncate text-meta text-danger-ink" title={message.lastError ?? undefined}>
                  {message.lastError ?? "—"}
                </span>
              ),
            },
            { key: "status", label: t("outboundQueue.columns.state"), render: (message) => <StatusPill tone={stateTone(message.status)}>{stateLabel(message.status)}</StatusPill> },
            {
              key: "redrive",
              label: t("outboundQueue.columns.redrive"),
              align: "end",
              render: (message) => (
                <form action={redriveIntegrationMessage.bind(null, message.id)} className="flex justify-end">
                  <Button type="submit" variant="secondary" size="xs">{t("outboundQueue.redrive")}</Button>
                </form>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("outboundQueue.emptyEyebrow")}
              headline={t("outboundQueue.emptyHeadline")}
              body={t("outboundQueue.emptyBody")}
            />
          }
        />

        <LedgerTable
          title={t("inboundQueue.title")}
          dateline={t("inboundQueue.dateline")}
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
              label: t("outboundQueue.columns.event"),
              render: (message) => (
                <div className="min-w-0 py-1">
                  <p className="font-medium text-ink-1">{message.eventType}</p>
                  <p className="u-mono u-meta text-ink-3">{message.externalEventId}</p>
                </div>
              ),
            },
            { key: "source", label: t("inboundQueue.columns.source"), render: (message) => <span className="text-ink-2">{message.source}</span> },
            { key: "attempts", label: t("outboundQueue.columns.attempts"), numeric: true, render: (message) => message.attempts },
            {
              key: "lastError",
              label: t("outboundQueue.columns.lastError"),
              render: (message) => (
                <span className="block max-w-[320px] truncate text-meta text-danger-ink" title={message.lastError ?? undefined}>
                  {message.lastError ?? "—"}
                </span>
              ),
            },
            { key: "status", label: t("outboundQueue.columns.state"), render: (message) => <StatusPill tone={stateTone(message.status)}>{stateLabel(message.status)}</StatusPill> },
            {
              key: "redrive",
              label: t("outboundQueue.columns.redrive"),
              align: "end",
              render: (message) => (
                <form action={redriveInboundIntegrationMessage.bind(null, message.id)} className="flex justify-end">
                  <Button type="submit" variant="secondary" size="xs">{t("outboundQueue.redrive")}</Button>
                </form>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("outboundQueue.emptyEyebrow")}
              headline={t("inboundQueue.emptyHeadline")}
              body={t("inboundQueue.emptyBody")}
            />
          }
        />

        <Surface tone="warning" className="flex gap-2 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
          <p className="u-ui max-w-prose text-ink-1">
            <span className="font-medium">{t("notice.lead")}</span> {t("notice.body")}
          </p>
        </Surface>
      </div>
    </AdminLayout>
  );
}
