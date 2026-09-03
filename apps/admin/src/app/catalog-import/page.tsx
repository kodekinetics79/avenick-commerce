import { AdminLayout } from "@/components/layout/admin-layout";
import { requireAdminSession } from "@/lib/auth";
import { PageHeader } from "@avenick/ui";
import { CatalogImportClient } from "./catalog-import-client";

export const metadata = { title: "Pilot Catalog Import" };
export const dynamic = "force-dynamic";

export default async function CatalogImportPage() {
  await requireAdminSession();
  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl space-y-block">
        <PageHeader
          eyebrow="Pilot"
          title="Catalog import"
          description="Validate and load client-supplied industrial catalog data without placing commercial source files in Git history."
          dateline="Every figure below describes the file you just submitted, not the catalogue as a whole"
        />
        <CatalogImportClient />
      </div>
    </AdminLayout>
  );
}
