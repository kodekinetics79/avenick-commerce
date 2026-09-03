import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Brain } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, PageHeader, StatusPill } from "@avenick/ui";

export const metadata = { title: "AI Insights" };

/**
 * AI recommendations are intentionally unavailable until a configured model,
 * auditable source signals, freshness metadata, and persisted recommendations
 * exist. Never substitute invented operational metrics for those controls.
 *
 * Which makes this page the purest test of law F in the whole console: it has
 * nothing to show and it must never be filled. So the emptiness is the designed
 * object — the Certificate plate, with a brass rule across its top edge, the
 * mark cropped off its outer corner, the refusal set in the provenance voice,
 * and exactly one real thing to do instead. Round one rendered it as a centred
 * grey apology inside a 2019 card, which is precisely the surface an owner
 * looks at and calls unimpressive.
 */
export default async function AIInsightsPage() {
  await requireAdminSession();

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Command center"
          title="AI Commerce Advisor"
          description="Decision support and operational recommendations."
          // The availability contract stays visible in the chrome of the page,
          // not only in the sidebar: an operator must never have to infer that a
          // screen is switched off from the fact that it is blank.
          actions={<StatusPill tone="danger" dot>Not configured</StatusPill>}
          dateline="Registered in ops/release/frontend-availability.json as unavailable · no certified AI pipeline is configured for this environment"
        />

        <EmptyState
          variant="certificate"
          glyph={<Brain />}
          eyebrow="Not configured"
          headline="No certified model or recommendation pipeline is configured for this environment."
          body="This page stays disabled until recommendations carry traceable source data, a freshness stamp and audit evidence. Live marketplace facts remain available in the dashboard and in every operational register — nothing is being withheld here, there is simply nothing modelled to show."
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/dashboard">Read the live figures</Link>
            </Button>
          }
        />
      </div>
    </AdminLayout>
  );
}
