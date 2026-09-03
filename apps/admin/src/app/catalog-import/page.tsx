import { AdminLayout } from "@/components/layout/admin-layout";
import { requireAdminSession } from "@/lib/auth";
import { CatalogImportClient } from "./catalog-import-client";

export const metadata = { title: "Pilot Catalog Import" };
export const dynamic = "force-dynamic";

export default async function CatalogImportPage() {
  await requireAdminSession();
  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pilot Catalog Import</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Validate and load client-supplied industrial catalog data without placing commercial source files in Git history.
          </p>
        </div>
        <CatalogImportClient />
      </div>
    </AdminLayout>
  );
}
