import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { checkDatabaseHealth } from "@avenick/database";
import { VAT_RATES } from "@avenick/utils";
import {
  CellGrid, Dateline, EmptyState, LedgerTable, PageHeader, Stat, StatusPill,
} from "@avenick/ui";
import { Database, ShieldCheck, Globe, KeyRound } from "lucide-react";

export const metadata = { title: "Platform Settings" };
export const dynamic = "force-dynamic";

interface ServiceRow {
  label: string;
  configured: boolean;
  detail: string;
  /** Overrides the presence badge where an env var cannot imply a working integration. */
  badge?: string;
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
  const authSecret = env("AUTH_SECRET") || env("NEXTAUTH_SECRET");

  const services: ServiceRow[] = [
    { label: "Checkout.com payments", configured: env("CHECKOUT_SECRET_KEY"), detail: "Card / mada / Apple Pay processing on the customer portal" },
    { label: "Checkout.com webhook secret", configured: env("CHECKOUT_WEBHOOK_SECRET"), detail: "HMAC verification for payment status webhooks (fails closed when missing)" },
    { label: "Anthropic AI drafts", configured: env("ANTHROPIC_API_KEY"), detail: "Seller portal RFQ/listing draft generation (falls back to templates)" },
    { label: "Resend email", configured: env("RESEND_API_KEY"), detail: "Transactional email delivery" },
    { label: "Twilio SMS/WhatsApp", configured: env("TWILIO_AUTH_TOKEN"), detail: "SMS and WhatsApp notifications" },
    { label: "S3 / MinIO object storage", configured: env("S3_ACCESS_KEY"), detail: "Product images and seller documents" },
    { label: "Elasticsearch", configured: false, badge: "Not implemented", detail: "No Elasticsearch integration exists in this codebase; catalog search is served by PostgreSQL" },
    {
      label: "Redis (Upstash REST)",
      configured: redisShared,
      badge: redisShared ? undefined : "In-memory fallback",
      detail: redisShared
        ? "UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN present — the shared rate-limit and read-cache store is installed at boot; Redis reachability is not probed here"
        : "Not set, so rate limiting and caching run in per-process memory: not shared across instances and reset on restart. REDIS_URL is read by no code and configures nothing",
    },
  ];

  const vatRows = Object.entries(VAT_RATES).map(([country, rate]) => ({ country, rate }));

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-section">
        <PageHeader
          eyebrow="Console"
          title="Platform Settings"
          description="Operational configuration as the platform actually sees it. Values are read from the environment; secrets are never displayed."
          dateline="This screen reports configuration and reads nothing back: there is no setting on it that can be changed from here."
          actions={<StatusPill>Read only</StatusPill>}
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <Stat
            label="Database"
            value={dbHealth.ok ? dbHealth.latencyMs : "—"}
            unit={dbHealth.ok ? "ms" : undefined}
            icon={Database}
            chip={dbHealth.ok ? "success" : "danger"}
            note={dbHealth.ok ? "Reachable" : "Unreachable"}
          />
          <Stat
            label="Environment"
            value={process.env.NODE_ENV ?? "development"}
            icon={Globe}
            chip="neutral"
          />
          <Stat
            label="Auth secret"
            value={authSecret ? "Set" : "Missing"}
            icon={KeyRound}
            chip={authSecret ? "success" : "danger"}
            note={authSecret ? "AUTH_SECRET or NEXTAUTH_SECRET is present" : "Sessions cannot be signed"}
          />
          <Stat
            label="Session strategy"
            value="JWT"
            icon={ShieldCheck}
            chip="neutral"
            note="Per-portal cookies"
          />
        </CellGrid>

        <div>
          <LedgerTable
            title="Service configuration"
            rows={services}
            getRowKey={(row) => row.label}
            density="compact"
            columns={[
              {
                key: "label",
                label: "Service",
                render: (row) => (
                  <>
                    <span className="block font-medium text-ink-1">{row.label}</span>
                    <span className="u-meta block max-w-desc text-ink-2">{row.detail}</span>
                  </>
                ),
              },
              {
                key: "status",
                label: "Status",
                align: "end",
                width: "160px",
                render: (row) => {
                  // A badge override always reads as unverified: presence must never render a
                  // success pill for a service this codebase does not actually integrate with.
                  const ok = row.configured && !row.badge;
                  return (
                    <StatusPill tone={ok ? "success" : "neutral"} dot={ok}>
                      {row.badge ?? (ok ? "Configured" : "Not configured")}
                    </StatusPill>
                  );
                },
              },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing to report"
                headline="No external service is wired into this deployment."
              />
            }
          />
          <Dateline className="mt-2">
            Presence of an environment variable only. A variable being set is not proof that the service is reachable,
            and nothing on this screen probes one.
          </Dateline>
        </div>

        <LedgerTable
          title="VAT rates by jurisdiction"
          dateline="The statutory rates this platform applies, by country code."
          rows={vatRows}
          getRowKey={(row) => row.country}
          density="compact"
          columns={[
            { key: "country", label: "Country" },
            { key: "rate", label: "Rate", numeric: true, width: "96px", render: (row) => `${row.rate}%` },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing configured"
              headline="No VAT jurisdiction is configured."
              body="Rates come from the platform's shared tax configuration; an empty table means none is loaded."
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
