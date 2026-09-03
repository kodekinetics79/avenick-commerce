import Link from "next/link";
import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { platformName } from "@avenick/utils/portal-config";
import { MessageSquare, CircleOff } from "lucide-react";

export const metadata = { title: "Contact Admin" };

/**
 * Server component so the sidebar shows the signed-in seller's real identity.
 * This page used to be a client component that rendered `sellerName="Seller"
 * tier="VERIFIED"` — a fabricated identity — around a hidden, disabled form.
 * The form is gone: a control that cannot submit is a promise, not a feature.
 */
export default async function ContactAdminPage() {
  const { seller, membership } = await requireSellerPermission("support.view");

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Contact Admin</h1>
            <p className="text-sm text-muted-foreground">Send a message to the {platformName()} support team</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <CircleOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">Support messaging is unavailable</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Seller-to-admin ticket creation is not connected in this environment. Existing tickets remain visible in
            the support register; a form will appear here only when submissions are persisted and auditable.
          </p>
          <Link href="/support/tickets" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            View your support tickets
          </Link>
        </div>
      </div>
    </SellerLayout>
  );
}
