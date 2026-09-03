import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Tag, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader, Surface, EmptyState, Button } from "@avenick/ui";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.deals");
  return { title: t("meta.title") };
}

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
  const t = await getTranslations("adminCommerce.deals");

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <Surface>
          <EmptyState
            eyebrow={t("empty.eyebrow")}
            headline={t("empty.headline")}
            body={t("empty.body")}
            icon={<Tag className="h-3.5 w-3.5" aria-hidden="true" />}
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/campaigns">
                  {t("empty.action")} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        </Surface>
      </div>
    </AdminLayout>
  );
}
