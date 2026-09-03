import Link from "next/link";
import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { platformName } from "@avenick/utils/portal-config";
import { Button, EmptyState, PageHeader } from "@avenick/ui";
import { MessageSquare } from "lucide-react";

export const metadata = { title: "Contact admin" };

/**
 * Server component so the sidebar shows the signed-in seller's real identity.
 * This page used to be a client component that rendered `sellerName="Seller"
 * tier="VERIFIED"` — a fabricated identity — around a hidden, disabled form.
 * The form is gone: a control that cannot submit is a promise, not a feature.
 *
 * What is left is a page whose entire content is an absence, which is exactly
 * what the certificate exists for. It used to be a grey icon centred over two
 * apologetic sentences in a `rounded-2xl border bg-card` box — the "centred grey
 * apology" the system names as a failure mode. It is now a composed plate: a
 * brass hairline, ruled ground, a cropped mark bleeding off the outer corner,
 * the reason stated plainly, and the one real thing there is to do next.
 */
export default async function ContactAdminPage() {
  const { seller, membership } = await requireSellerPermission("support.view");

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="max-w-3xl space-y-block">
        <PageHeader
          className="mb-0"
          eyebrow="Support"
          title="Contact admin"
          description={`How messages reach the ${platformName()} platform team from this account.`}
        />

        <EmptyState
          variant="certificate"
          glyph={<MessageSquare />}
          eyebrow="Not connected"
          headline="Seller-to-admin messaging is not connected in this environment."
          // Precisely why, in the codebase's own voice: the reason is a decision,
          // not an outage, and stating it is what stops a supplier waiting for a
          // reply that was never going to come.
          body="A form here would accept a message and drop it. Submissions have to be persisted and auditable before this page can offer one, so nothing is shown that cannot be honoured. Tickets already raised against your account remain readable in the support register."
          action={
            <Button variant="primary" size="sm" asChild>
              <Link href="/support/tickets">View your support tickets</Link>
            </Button>
          }
        />
      </div>
    </SellerLayout>
  );
}
