import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Workflow, CircleOff } from "lucide-react";

export const metadata = { title: "Automation" };

/**
 * This page previously rendered ten invented automation rules, complete with
 * fabricated "last run" times and execution counts, against no engine and no
 * data source. An operator could not tell that nothing was running.
 *
 * No automation engine exists. Until rules are persisted, executed, and
 * auditable, the honest state is "not configured" — the same pattern used by
 * the AI advisor page. Never substitute invented operational metrics for a
 * capability that does not exist.
 */
export default async function AutomationPage() {
  await requireAdminSession();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Workflow className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Automation</h1>
            <p className="text-sm text-muted-foreground">Rule-based operational workflows</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <CircleOff className="h-3.5 w-3.5" /> Not configured
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Workflow className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold">No automation engine is configured</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Automation rules are not stored, scheduled, or executed by the platform. Nothing runs
            on a schedule today. Order, integration and approval events are handled by their own
            governed services and are visible in the audit log.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
