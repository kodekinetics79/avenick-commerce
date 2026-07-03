import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { checkDatabaseHealth } from "@avenick/database";
import { Plug, CheckCircle, XCircle, Database } from "lucide-react";

export const metadata = { title: "Integration Hub" };
export const dynamic = "force-dynamic";

interface Integration {
  name: string;
  purpose: string;
  category: string;
  connected: boolean;
  detail: string;
  iconBg: string;
  iconColor: string;
  icon: string;
}

export default async function IntegrationsPage() {
  await requireAdminSession();

  const dbHealth = await checkDatabaseHealth();
  const env = (key: string) => Boolean(process.env[key]);

  // Status reflects the environment this deployment is actually running with.
  const integrations: Integration[] = [
    { name: "PostgreSQL", purpose: "Primary data store for all portals", category: "Database", connected: dbHealth.ok, detail: dbHealth.ok ? `Live · ${dbHealth.latencyMs}ms` : dbHealth.error ?? "Unreachable", iconBg: "bg-indigo-100", iconColor: "text-indigo-600", icon: "SQL" },
    { name: "Checkout.com", purpose: "Card, mada, and Apple Pay processing with signed webhooks", category: "Payments", connected: env("CHECKOUT_SECRET_KEY"), detail: env("CHECKOUT_WEBHOOK_SECRET") ? "Keys + webhook secret set" : "Webhook secret missing", iconBg: "bg-violet-100", iconColor: "text-violet-600", icon: "PAY" },
    { name: "Anthropic Claude", purpose: "AI draft generation for seller RFQ replies and listings", category: "AI", connected: env("ANTHROPIC_API_KEY"), detail: env("ANTHROPIC_API_KEY") ? "API key set" : "Template fallback active", iconBg: "bg-amber-100", iconColor: "text-amber-600", icon: "AI" },
    { name: "Resend", purpose: "Transactional email (order confirmations, approvals)", category: "Messaging", connected: env("RESEND_API_KEY"), detail: env("RESEND_API_KEY") ? "API key set" : "Emails disabled", iconBg: "bg-sky-100", iconColor: "text-sky-600", icon: "EML" },
    { name: "Twilio", purpose: "SMS and WhatsApp buyer notifications", category: "Messaging", connected: env("TWILIO_AUTH_TOKEN"), detail: env("TWILIO_AUTH_TOKEN") ? "Credentials set" : "SMS disabled", iconBg: "bg-red-100", iconColor: "text-red-600", icon: "SMS" },
    { name: "S3 / MinIO", purpose: "Product images and compliance document storage", category: "Storage", connected: env("S3_ACCESS_KEY"), detail: env("S3_ENDPOINT") ? "Endpoint configured" : "Uploads disabled", iconBg: "bg-orange-100", iconColor: "text-orange-600", icon: "S3" },
    { name: "Elasticsearch", purpose: "Catalog search and faceting", category: "Search", connected: env("ELASTICSEARCH_URL"), detail: env("ELASTICSEARCH_URL") ? "URL configured" : "DB search fallback", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", icon: "ES" },
    { name: "Redis", purpose: "Shared rate limiting and caching across instances", category: "Infrastructure", connected: env("REDIS_URL"), detail: env("REDIS_URL") ? "URL configured" : "In-memory fallback", iconBg: "bg-rose-100", iconColor: "text-rose-600", icon: "RDS" },
  ];

  const connectedCount = integrations.filter((i) => i.connected).length;
  const categories = [...new Set(integrations.map((i) => i.category))];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Integration Hub</h1>
          <p className="text-muted-foreground text-sm">
            Real status of every external service this deployment is wired to — read from the runtime environment, never from a static list.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Connected", value: connectedCount, color: "bg-green-50 border-green-200" },
            { label: "Not configured", value: integrations.length - connectedCount, color: "bg-slate-50 border-border" },
            { label: "Categories", value: categories.length, color: "bg-white border-border" },
            { label: "Database latency", value: dbHealth.ok ? `${dbHealth.latencyMs}ms` : "—", color: dbHealth.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {integrations.map((i) => (
            <div key={i.name} className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold ${i.iconBg} ${i.iconColor}`}>
                  {i.icon === "SQL" ? <Database className="h-5 w-5" /> : i.icon}
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                    i.connected ? "bg-green-100 text-green-700" : "bg-slate-100 text-muted-foreground"
                  }`}
                >
                  {i.connected ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {i.connected ? "Connected" : "Not configured"}
                </span>
              </div>
              <p className="font-semibold text-sm">{i.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{i.purpose}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-muted-foreground">{i.category}</span>
                <span className="text-[11px] text-muted-foreground">{i.detail}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Plug className="h-3.5 w-3.5" />
          Connection status is presence-based (environment variables); secret values are never read into this page.
        </p>
      </div>
    </AdminLayout>
  );
}
