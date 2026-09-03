import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Workflow } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, PageHeader, StatusPill } from "@avenick/ui";

export const metadata = { title: "Automation" };

/**
 * This page previously rendered ten invented automation rules, complete with
 * fabricated "last run" times and execution counts, against no engine and no
 * data source. An operator could not tell that nothing was running.
 *
 * No automation engine exists. Until rules are persisted, executed, and
 * auditable, the honest state is "not configured" — the same Certificate plate
 * the AI advisor page carries, because they are the same fact and a console
 * that says one fact two ways has two dialects.
 */
export default async function AutomationPage() {
  await requireAdminSession();

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Command center"
          title="Automation"
          description="Rule-based operational workflows."
          actions={<StatusPill tone="warning" dot>Not configured</StatusPill>}
          dateline="Registered in ops/release/frontend-availability.json · no rule is stored, scheduled or executed by the platform"
        />

        <EmptyState
          variant="certificate"
          glyph={<Workflow />}
          eyebrow="Nothing runs on a schedule"
          headline="No automation engine is configured, so nothing is executing behind this screen."
          body="Order, integration and approval events are handled by their own governed services, and every one of those transitions is written to the audit stream. That register is the true record of what the platform did without a person asking it to."
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/audit">Open the audit trail</Link>
            </Button>
          }
        />
      </div>
    </AdminLayout>
  );
}
