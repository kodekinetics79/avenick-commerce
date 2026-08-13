import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Brain, CircleOff } from "lucide-react";

export const metadata = { title: "AI Insights" };

/**
 * AI recommendations are intentionally unavailable until a configured model,
 * auditable source signals, freshness metadata, and persisted recommendations
 * exist. Never substitute invented operational metrics for those controls.
 */
export default async function AIInsightsPage() {
  await requireAdminSession();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Brain className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Commerce Advisor</h1>
            <p className="text-sm text-muted-foreground">Decision support and operational recommendations</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <CircleOff className="h-3.5 w-3.5" /> Not configured
          </span>
        </div>

        <section className="rounded-2xl border border-border bg-card p-8 text-center">
          <Brain className="mx-auto h-9 w-9 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">AI recommendations are unavailable</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            No certified AI model or recommendation pipeline is configured for this environment. Live marketplace
            facts remain available in the dashboard and operational registers; this page will stay disabled until
            recommendations have traceable source data, freshness, and audit evidence.
          </p>
        </section>
      </div>
    </AdminLayout>
  );
}
