import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Tag, ArrowRight } from "lucide-react";

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
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Tag className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Deals</h1>
            <p className="text-sm text-muted-foreground">Promotional pricing and campaigns</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Tag className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold">Promotions are managed in Campaigns</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Governed promotions, coupons and their redemption rules live in the campaigns
            workspace, backed by the promotions engine. This page held no data of its own.
          </p>
          <Link
            href="/campaigns"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Go to Campaigns <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
