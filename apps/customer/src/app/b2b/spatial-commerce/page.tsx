import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CompanyStatus, db } from "@avenick/database";
import { Button, PageHeader, StatusPill } from "@avenick/ui";
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
      {/*
        The page-local grid wash and the 320px indigo blur orb that used to sit
        here are gone. The ambient field is mounted EXACTLY ONCE, in the root
        layout: a second translucent field stacked on one route doubles the
        ambient alpha on that route alone, which is the visible-orb failure the
        single field exists to avoid, and it silently breaks every contrast
        ceiling the field's alphas are derived from. DESIGN_SYSTEM.md §9.
      */}
      <div className="mx-auto max-w-[96rem] px-4 py-6 sm:py-8">
        <Button asChild variant="ghost" size="sm" className="-ms-2">
          <Link href="/b2b">
            {/* rtl:rotate-180 — a direction-implying icon must flip. */}
            <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            {t("back")}
          </Link>
        </Button>
        <PageHeader
          className="mt-4"
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          actions={<StatusPill>{t("phase")}</StatusPill>}
          linkComponent={Link}
        />
        {runtime.fixtureMode && fixture ? (
          <SpatialCommerceShell fixtureMode items={fixture.skus} bindings={fixture.bindings} />
        ) : (
          <SpatialCommerceShell items={[]} bindings={[]} />
        )}
      </div>
    </MainLayout>
  );
}
