import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Tag, ArrowRight } from "lucide-react";
import { PageHeader, Surface, EmptyState, Button } from "@avenick/ui";

export const metadata = { title: "Deals" };

/**
 * This page previously rendered five invented promotions with fabricated
 * revenue figures against no data source — while a real, database-backed
 * promotions engine already exists at /campaigns. An operator browsing the nav
 * would find the fake screen first and the real one second.
 *
 * Rather than duplicate the concept, this now points at the governed surface.
 */
export default async function DealsPage() {
  await requireAdminSession();

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Commerce"
          title="Deals"
          description="Promotional pricing and campaigns."
        />

        <Surface>
          <EmptyState
            eyebrow="Moved"
            headline="Promotions are managed in Campaigns."
            body="Governed promotions, coupons and their redemption rules live in the campaigns workspace, backed by the promotions engine. This page holds no data of its own."
            icon={<Tag className="h-3.5 w-3.5" aria-hidden="true" />}
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/campaigns">
                  Go to Campaigns <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        </Surface>
      </div>
    </AdminLayout>
  );
}
