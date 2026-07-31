import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Boxes } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CompanyStatus, db } from "@avenick/database";
import { MainLayout } from "@/components/layout/main-layout";
import { getB2BContext } from "@/lib/b2b";
import { getSpatialCommerceRuntime } from "@/lib/spatial-commerce-flag";
import { SpatialCommerceShell } from "@/features/spatial-commerce/components/spatial-commerce-shell";
import { getDevelopmentMechanicalFixture } from "@/features/spatial-commerce/fixtures/development-mechanical-skus";
import { hasLiveSpatialCommerceRole } from "@/lib/spatial-commerce-access";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("spatialCommerce");
  return {
    title: t("metadataTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function SpatialCommercePage() {
  const runtime = getSpatialCommerceRuntime();
  if (!runtime.enabled) notFound();

  const context = await getB2BContext();
  if (!context) redirect("/b2b/register");
  const currentUser = await db.user.findUnique({
    where: { id: context.userId },
    select: { role: true, status: true, deletedAt: true },
  });
  if (
    !hasLiveSpatialCommerceRole(currentUser, context.member)
    || context.company.status !== CompanyStatus.ACTIVE
    || context.company.deletedAt
  ) notFound();

  const t = await getTranslations("spatialCommerce");
  const fixture = runtime.fixtureMode ? getDevelopmentMechanicalFixture() : null;

  return (
    <MainLayout>
      <div className="relative min-h-screen overflow-hidden bg-background">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-grid mask-fade-b opacity-40" />
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 start-1/4 h-80 w-80 rounded-full bg-primary/10 blur-[100px]" />
        <div className="relative mx-auto max-w-[96rem] px-4 py-6 sm:py-8">
          <Link href="/b2b" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            {t("back")}
          </Link>
          <header className="my-5 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary rtl:normal-case rtl:tracking-normal">
                <Boxes aria-hidden="true" className="h-4 w-4" /> {t("eyebrow")}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{t("description")}</p>
            </div>
            <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">{t("phase")}</span>
          </header>
          {runtime.fixtureMode && fixture ? (
            <SpatialCommerceShell fixtureMode items={fixture.skus} bindings={fixture.bindings} />
          ) : (
            <SpatialCommerceShell items={[]} bindings={[]} />
          )}
        </div>
      </div>
    </MainLayout>
  );
}
