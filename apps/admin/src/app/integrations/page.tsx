import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { checkDatabaseHealth, db, getIntegrationOperationalSummary } from "@avenick/database";
import { AlertTriangle, CheckCircle, Database, Plug, RefreshCcw, ServerCog, XCircle } from "lucide-react";
import { configureCompanyOrderRoute, createIntegrationConnection, redriveInboundIntegrationMessage, redriveIntegrationMessage, setIntegrationConnectionStatus } from "./actions";

export const metadata = { title: "Integration Hub" };
export const dynamic = "force-dynamic";

const field = "h-10 rounded-xl border border-input bg-background px-3 text-sm";

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
      state: env("ELASTICSEARCH_URL") ? "CONFIGURED" : "FALLBACK",
      detail: env("ELASTICSEARCH_URL") ? "Endpoint configured" : "Database search fallback",
      truth: "The public catalog remains functional without it; provider health is not inferred from a URL.",
    },
    {
      name: "Redis",
      category: "Infrastructure",
      state: env("REDIS_URL") ? "CONFIGURED" : "FALLBACK",
      detail: env("REDIS_URL") ? "Endpoint configured" : "In-memory fallback",
      truth: "A multi-instance production rollout requires shared Redis; in-memory fallback is single-instance only.",
    },
  ];

  const stateClass = (state: string) => {
    if (["LIVE", "ACTIVE", "PROCESSED"].includes(state)) return "bg-green-100 text-green-700";
    if (["DOWN", "DEAD"].includes(state)) return "bg-red-100 text-red-700";
    if (["INCOMPLETE", "DEGRADED", "RETRY"].includes(state)) return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-600";
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Integration Hub</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configuration, health evidence, durable queue state and ERP acceptance truth are shown separately. A credential being present is never presented as a successful integration.
          </p>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            ["ERP connections", summary.connections.length],
            ["Pending", summary.outbox.pending],
            ["Processing", summary.outbox.processing],
            ["Retry", summary.outbox.retry],
            ["Dead-letter", summary.outbox.dead],
            ["Inbound retry", summary.inbox.retry ?? 0],
            ["Inbound dead", summary.inbox.dead ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2"><Plug className="h-5 w-5 text-primary" /><h2 className="font-semibold">Runtime services</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {runtimeServices.map((service) => (
              <div key={service.name} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">{service.name === "PostgreSQL" ? <Database className="h-5 w-5" /> : <ServerCog className="h-5 w-5" />}</div>
                    <div><p className="font-semibold text-sm">{service.name}</p><p className="text-xs text-muted-foreground">{service.category}</p></div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${stateClass(service.state)}`}>{service.state.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-3 text-xs font-medium">{service.detail}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{service.truth}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
          <form action={createIntegrationConnection} className="rounded-2xl border border-border bg-white p-5 space-y-4">
            <div><h2 className="font-semibold">Register ERP / operational system</h2><p className="mt-1 text-xs text-muted-foreground">Only secret-manager references are stored. Editing a connection always returns it to Disabled until an admin explicitly activates it.</p></div>
            <div className="grid gap-3">
              <select name="system" className={field} defaultValue="D365"><option>D365</option><option>SAP</option><option>ERP</option><option>WMS</option><option>PIM</option></select>
              <input name="connectionKey" className={field} required placeholder="primary-ksa" pattern="[a-z0-9][a-z0-9_-]{1,48}" />
              <input name="name" className={field} required placeholder="Dynamics 365 — KSA Production" minLength={2} maxLength={120} />
              <input name="baseUrl" className={field} placeholder="https://erp.example.com" type="url" />
              <input name="credentialsRef" className={field} placeholder="env:D365_CLIENT_SECRET" />
              <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white">Save disabled connection</button>
            </div>
          </form>

          <div className="rounded-2xl border border-border bg-white overflow-hidden">
            <div className="border-b p-5"><h2 className="font-semibold">ERP / system registry</h2><p className="mt-1 text-xs text-muted-foreground">ACTIVE means administratively enabled. “Verified” requires an actual recorded successful health/transaction event.</p></div>
            {summary.connections.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No ERP/WMS/PIM connection has been registered yet.</div>
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-3">System</th><th className="p-3">Endpoint / secret ref</th><th className="p-3">Evidence</th><th className="p-3">State</th><th className="p-3">Control</th></tr></thead><tbody>
                {summary.connections.map((connection) => {
                  const verified = Boolean(connection.lastSuccessAt && (!connection.lastFailureAt || connection.lastSuccessAt > connection.lastFailureAt));
                  return <tr key={connection.id} className="border-t align-top">
                    <td className="p-3"><p className="font-medium">{connection.name}</p><p className="text-xs font-mono text-muted-foreground">{connection.system}/{connection.connectionKey}</p></td>
                    <td className="p-3 text-xs text-muted-foreground"><p className="max-w-[260px] truncate">{connection.baseUrl ?? "No endpoint"}</p><p>{connection.credentialsRef ? "Secret reference set" : "No secret reference"}</p></td>
                    <td className="p-3 text-xs"><p className={verified ? "text-green-700" : "text-muted-foreground"}>{verified ? "Last result: verified success" : "No verified success"}</p><p className="text-muted-foreground">Success: {fmtDate(connection.lastSuccessAt)}</p>{connection.lastError && <p className="mt-1 max-w-[260px] truncate text-danger">{connection.lastError}</p>}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${stateClass(connection.status)}`}>{connection.status}</span></td>
                    <td className="p-3"><div className="flex flex-col gap-2"><div className="flex flex-wrap gap-1">{connection.status !== "ACTIVE" && <form action={setIntegrationConnectionStatus.bind(null, connection.id, "ACTIVE")}><button className="rounded-lg border px-2 py-1 text-xs" type="submit">Activate</button></form>}{connection.status !== "DISABLED" && <form action={setIntegrationConnectionStatus.bind(null, connection.id, "DISABLED")}><button className="rounded-lg border px-2 py-1 text-xs" type="submit">Disable</button></form>}</div>{["D365", "SAP", "ERP"].includes(connection.system) && <form action={configureCompanyOrderRoute.bind(null, connection.id)} className="flex max-w-[260px] gap-1"><select name="companyId" className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs" required defaultValue=""><option value="" disabled>Route company…</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.nameEn}</option>)}</select><select name="enabled" className="rounded-lg border px-1 py-1 text-xs" defaultValue="true"><option value="true">Assign</option><option value="false">Remove</option></select><button className="rounded-lg border px-2 py-1 text-xs" type="submit">Apply</button></form>}<p className="text-[10px] text-muted-foreground">{routes.filter((route) => route.connectionId === connection.id).length} company route(s)</p></div></td>
                  </tr>;
                })}
              </tbody></table></div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b p-5"><div><h2 className="font-semibold">Outbound retry / dead-letter queue</h2><p className="mt-1 text-xs text-muted-foreground">Manual redrive is explicit and audited; processed messages cannot be replayed from this control.</p></div><RefreshCcw className="h-5 w-5 text-muted-foreground" /></div>
          {failedMessages.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No retry or dead-letter integration messages.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-3">Event</th><th className="p-3">Destination</th><th className="p-3">Attempts</th><th className="p-3">Last error</th><th className="p-3">State</th><th className="p-3"></th></tr></thead><tbody>{failedMessages.map((message) => <tr key={message.id} className="border-t"><td className="p-3"><p className="font-medium">{message.eventType}</p><p className="text-xs font-mono text-muted-foreground">{message.aggregateType}:{message.aggregateId}</p></td><td className="p-3">{message.destination}</td><td className="p-3 font-mono">{message.attempts}</td><td className="p-3 max-w-[320px] truncate text-xs text-danger">{message.lastError ?? "—"}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${stateClass(message.status)}`}>{message.status}</span></td><td className="p-3"><form action={redriveIntegrationMessage.bind(null, message.id)}><button type="submit" className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-muted">Redrive</button></form></td></tr>)}</tbody></table></div>}
        </section>

        <section className="rounded-2xl border border-border bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b p-5"><div><h2 className="font-semibold">Inbound retry / dead-letter queue</h2><p className="mt-1 text-xs text-muted-foreground">Provider deliveries retain source identity, attempt history and audited manual redrive.</p></div><RefreshCcw className="h-5 w-5 text-muted-foreground" /></div>
          {failedInboundMessages.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No inbound retry or dead-letter integration messages.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-3">Event</th><th className="p-3">Source</th><th className="p-3">Attempts</th><th className="p-3">Last error</th><th className="p-3">State</th><th className="p-3"></th></tr></thead><tbody>{failedInboundMessages.map((message) => <tr key={message.id} className="border-t"><td className="p-3"><p className="font-medium">{message.eventType}</p><p className="text-xs font-mono text-muted-foreground">{message.externalEventId}</p></td><td className="p-3">{message.source}</td><td className="p-3 font-mono">{message.attempts}</td><td className="p-3 max-w-[320px] truncate text-xs text-danger">{message.lastError ?? "—"}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${stateClass(message.status)}`}>{message.status}</span></td><td className="p-3"><form action={redriveInboundIntegrationMessage.bind(null, message.id)}><button type="submit" className="rounded-lg border px-2 py-1 text-xs font-medium hover:bg-muted">Redrive</button></form></td></tr>)}</tbody></table></div>}
        </section>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
          <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Activation is not certification.</strong> A connection can be administratively active while health is unverified. Production-pilot certification requires a successful provider/ERP handshake plus an accepted and rejected transaction scenario with evidence.</p></div>
        </div>
      </div>
    </AdminLayout>
  );
}
