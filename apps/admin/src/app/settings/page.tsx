import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { checkDatabaseHealth } from "@avenick/database";
import { VAT_RATES } from "@avenick/utils";
import { Settings, Database, ShieldCheck, Globe, Percent, KeyRound, CheckCircle, XCircle } from "lucide-react";

export const metadata = { title: "Platform Settings" };
export const dynamic = "force-dynamic";

function ConfigRow({
  label,
  configured,
  detail,
  badge,
}: {
  label: string;
  configured: boolean;
  detail?: string;
  /** Overrides the presence badge where an env var cannot imply a working integration. */
  badge?: string;
}) {
  // A badge override always reads as unverified: presence must never render a green check
  // for a service this codebase does not actually integrate with.
  const ok = configured && !badge;
  return (
    <li className="px-5 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
          ok ? "bg-green-100 text-green-700" : "bg-slate-100 text-muted-foreground"
        }`}
      >
        {ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {badge ?? (ok ? "Configured" : "Not configured")}
      </span>
    </li>
  );
}

export default async function SettingsPage() {
  await requireAdminSession();

  const dbHealth = await checkDatabaseHealth();

  // Presence-only checks — values are never read into the page.
  const env = (key: string) => Boolean(process.env[key]);
  // The only variables the rate-limit and cache stores read, and together the
  // exact condition under which the shared store is installed at boot. Trimmed
  // to match those install functions, which read them with `?.trim()` — a
  // whitespace-only value installs nothing and must not report as configured.
  const envSet = (key: string) => Boolean(process.env[key]?.trim());
  const redisShared = envSet("UPSTASH_REDIS_REST_URL") && envSet("UPSTASH_REDIS_REST_TOKEN");

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground text-sm">
            Operational configuration as the platform actually sees it. Values are read from the environment; secrets are never displayed.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Database", value: dbHealth.ok ? `Healthy · ${dbHealth.latencyMs}ms` : "Unreachable", icon: Database, color: dbHealth.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600" },
            { label: "Environment", value: process.env.NODE_ENV ?? "development", icon: Globe, color: "bg-white border-border text-muted-foreground" },
            { label: "Auth secret", value: env("AUTH_SECRET") || env("NEXTAUTH_SECRET") ? "Set" : "Missing", icon: KeyRound, color: env("AUTH_SECRET") || env("NEXTAUTH_SECRET") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600" },
            { label: "Session strategy", value: "JWT (per-portal cookies)", icon: ShieldCheck, color: "bg-white border-border text-muted-foreground" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`rounded-2xl border p-4 ${s.color.split(" ").slice(0, 2).join(" ")}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <Icon className={`h-4 w-4 ${s.color.split(" ")[2]}`} />
                </div>
                <p className="text-base font-bold mt-1">{s.value}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Service configuration</h2>
          </div>
          <ul className="divide-y divide-border">
            <ConfigRow label="Checkout.com payments" configured={env("CHECKOUT_SECRET_KEY")} detail="Card / mada / Apple Pay processing on the customer portal" />
            <ConfigRow label="Checkout.com webhook secret" configured={env("CHECKOUT_WEBHOOK_SECRET")} detail="HMAC verification for payment status webhooks (fails closed when missing)" />
            <ConfigRow label="Anthropic AI drafts" configured={env("ANTHROPIC_API_KEY")} detail="Seller portal RFQ/listing draft generation (falls back to templates)" />
            <ConfigRow label="Resend email" configured={env("RESEND_API_KEY")} detail="Transactional email delivery" />
            <ConfigRow label="Twilio SMS/WhatsApp" configured={env("TWILIO_AUTH_TOKEN")} detail="SMS and WhatsApp notifications" />
            <ConfigRow label="S3 / MinIO object storage" configured={env("S3_ACCESS_KEY")} detail="Product images and seller documents" />
            <ConfigRow label="Elasticsearch" configured={false} badge="Not implemented" detail="No Elasticsearch integration exists in this codebase; catalog search is served by PostgreSQL" />
            <ConfigRow
              label="Redis (Upstash REST)"
              configured={redisShared}
              badge={redisShared ? undefined : "In-memory fallback"}
              detail={
                redisShared
                  ? "UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN present — the shared rate-limit and read-cache store is installed at boot; Redis reachability is not probed here"
                  : "Not set, so rate limiting and caching run in per-process memory: not shared across instances and reset on restart. REDIS_URL is read by no code and configures nothing"
              }
            />
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">VAT rates by jurisdiction</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground uppercase">Country</th>
                  <th className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground uppercase">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(VAT_RATES).map(([country, rate]) => (
                  <tr key={country}>
                    <td className="px-4 py-2.5 font-medium">{country}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
