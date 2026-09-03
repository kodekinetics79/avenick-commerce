import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { checkDatabaseHealth } from "@avenick/database";
import { VAT_RATES } from "@avenick/utils";
import {
  CellGrid, Dateline, EmptyState, LedgerTable, PageHeader, Stat, StatusPill,
} from "@avenick/ui";
import { Database, ShieldCheck, Globe, KeyRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

// generateMetadata rather than a static object: the tab title is user-visible
// copy and a module-scope constant has no translator in scope.
export async function generateMetadata() {
  const t = await getTranslations("adminShell.meta");
  return { title: t("settings") };
}
export const dynamic = "force-dynamic";

interface ServiceRow {
  /** Stable row identity, so a translated label never becomes the React key. */
  key: string;
  label: string;
  configured: boolean;
  detail: string;
  /** Overrides the presence badge where an env var cannot imply a working integration. */
  badge?: string;
}

export default async function SettingsPage() {
  await requireAdminSession();
  const t = await getTranslations("adminShell.settings");

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
    { key: "checkoutPayments", label: t("services.checkoutPayments.label"), configured: env("CHECKOUT_SECRET_KEY"), detail: t("services.checkoutPayments.detail") },
    { key: "checkoutWebhook", label: t("services.checkoutWebhook.label"), configured: env("CHECKOUT_WEBHOOK_SECRET"), detail: t("services.checkoutWebhook.detail") },
    { key: "anthropic", label: t("services.anthropic.label"), configured: env("ANTHROPIC_API_KEY"), detail: t("services.anthropic.detail") },
    { key: "resend", label: t("services.resend.label"), configured: env("RESEND_API_KEY"), detail: t("services.resend.detail") },
    { key: "twilio", label: t("services.twilio.label"), configured: env("TWILIO_AUTH_TOKEN"), detail: t("services.twilio.detail") },
    { key: "storage", label: t("services.storage.label"), configured: env("S3_ACCESS_KEY"), detail: t("services.storage.detail") },
    { key: "elasticsearch", label: t("services.elasticsearch.label"), configured: false, badge: t("services.notImplemented"), detail: t("services.elasticsearch.detail") },
    {
      key: "redis",
      label: t("services.redis.label"),
      configured: redisShared,
      badge: redisShared ? undefined : t("services.inMemoryFallback"),
      detail: redisShared
        ? t("services.redis.detailShared")
        : t("services.redis.detailFallback"),
    },
  ];

  const vatRows = Object.entries(VAT_RATES).map(([country, rate]) => ({ country, rate }));

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-section">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
          actions={<StatusPill>{t("readOnly")}</StatusPill>}
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <Stat
            label={t("stats.database")}
            value={dbHealth.ok ? dbHealth.latencyMs : "—"}
            unit={dbHealth.ok ? "ms" : undefined}
            icon={Database}
            chip={dbHealth.ok ? "success" : "danger"}
            note={dbHealth.ok ? t("stats.reachable") : t("stats.unreachable")}
          />
          <Stat
            // NODE_ENV is the environment's own identifier, not a label, so it
            // is reported verbatim rather than translated.
            label={t("stats.environment")}
            value={process.env.NODE_ENV ?? "development"}
            icon={Globe}
            chip="neutral"
          />
          <Stat
            label={t("stats.authSecret")}
            value={authSecret ? t("stats.authSecretSet") : t("stats.authSecretMissing")}
            icon={KeyRound}
            chip={authSecret ? "success" : "danger"}
            note={authSecret ? t("stats.authSecretPresent") : t("stats.authSecretAbsent")}
          />
          <Stat
            label={t("stats.sessionStrategy")}
            value="JWT"
            icon={ShieldCheck}
            chip="neutral"
            note={t("stats.sessionCookies")}
          />
        </CellGrid>

        <div>
          <LedgerTable
            title={t("services.title")}
            rows={services}
            getRowKey={(row) => row.key}
            density="compact"
            columns={[
              {
                key: "label",
                label: t("services.columnService"),
                render: (row) => (
                  <>
                    <span className="block font-medium text-ink-1">{row.label}</span>
                    <span className="u-meta block max-w-desc text-ink-2">{row.detail}</span>
                  </>
                ),
              },
              {
                key: "status",
                label: t("services.columnStatus"),
                align: "end",
                width: "160px",
                render: (row) => {
                  // A badge override always reads as unverified: presence must never render a
                  // success pill for a service this codebase does not actually integrate with.
                  const ok = row.configured && !row.badge;
                  return (
                    <StatusPill tone={ok ? "success" : "neutral"} dot={ok}>
                      {row.badge ?? (ok ? t("services.configured") : t("services.notConfigured"))}
                    </StatusPill>
                  );
                },
              },
            ]}
            empty={
              <EmptyState
                eyebrow={t("services.empty.eyebrow")}
                headline={t("services.empty.headline")}
              />
            }
          />
          <Dateline className="mt-2">{t("services.dateline")}</Dateline>
        </div>

        <LedgerTable
          title={t("vat.title")}
          dateline={t("vat.dateline")}
          rows={vatRows}
          getRowKey={(row) => row.country}
          density="compact"
          columns={[
            { key: "country", label: t("vat.columnCountry") },
            { key: "rate", label: t("vat.columnRate"), numeric: true, width: "96px", render: (row) => `${row.rate}%` },
          ]}
          empty={
            <EmptyState
              eyebrow={t("vat.empty.eyebrow")}
              headline={t("vat.empty.headline")}
              body={t("vat.empty.body")}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
