import { AdminLayout } from "@/components/layout/admin-layout";
import { requireAdminSession } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@avenick/ui";
import { CatalogImportClient } from "./catalog-import-client";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.catalogImport");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

export default async function CatalogImportPage() {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.catalogImport");
  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl space-y-block">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
        />
        <CatalogImportClient />
      </div>
    </AdminLayout>
  );
}
