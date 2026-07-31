import Link from "next/link";
import { ArrowRight, Tag } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("deals");
  return { title: t("title"), description: t("description") };
}

export default async function DealsPage() {
  const t = await getTranslations("deals");
  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Tag aria-hidden="true" className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {t("description")}
        </p>
        <Link
          href="/products"
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("browseProducts")} <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
    </MainLayout>
  );
}
