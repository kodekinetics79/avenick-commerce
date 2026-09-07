import { getTranslations } from "next-intl/server";
import { db } from "@avenick/database";
import { PageHeader } from "@avenick/ui";
import { AdminLayout } from "@/components/layout/admin-layout";
import { requireAdminSession } from "@/lib/auth";
import { CreateSellerForm } from "./create-seller-form";

export async function generateMetadata() {
  const t = await getTranslations("adminReview");
  return { title: t("newSeller.metaTitle") };
}

// The form writes; nothing here may be served from a cache.
export const dynamic = "force-dynamic";

/**
 * Opening a seller account from the platform side.
 *
 * Until this page existed a SellerProfile could only come into being by the
 * supplier registering themselves — so a distributor signed in a meeting had to
 * be talked through the public form before anyone here could approve them. The
 * admin Sellers list could judge accounts it had no way to create.
 */
export default async function NewSellerPage() {
  const { role } = await requireAdminSession();
  const t = await getTranslations("adminReview");
  const pendingCount = await db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } });

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div className="max-w-3xl space-y-block">
        <PageHeader
          eyebrow={t("newSeller.eyebrow")}
          title={t("newSeller.title")}
          description={t("newSeller.description")}
          dateline={t("newSeller.dateline")}
        />
        {/* The role decides only whether the "open for trading now" option is
            offered. createSellerAccount re-resolves the actor inside its own
            transaction and refuses that status for anyone below SUPER_ADMIN, so
            this is presentation, not the gate. */}
        <CreateSellerForm canOpenActive={role === "SUPER_ADMIN"} />
      </div>
    </AdminLayout>
  );
}
