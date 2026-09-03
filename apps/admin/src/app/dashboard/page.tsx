import { DashboardView } from "./dashboard-view";
import { db, getExecutiveDashboardData } from "@avenick/database";
import { getCurrentAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

// generateMetadata rather than a static object: the tab title is user-visible
// copy and a module-scope constant has no translator in scope.
export async function generateMetadata() {
  const t = await getTranslations("adminShell.meta");
  return { title: t("dashboard") };
}
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  if (!await getCurrentAdmin()) redirect("/login");
  const [{ exec, topCustomers }, pendingCount] = await Promise.all([
    getExecutiveDashboardData(),
    db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  // Pass only plain, serializable data across the server → client boundary.
  return (
    <DashboardView
      exec={exec}
      topCustomers={topCustomers}
      gmvMonth={exec.kpis.gmvMonth}
      activeCompanies={exec.kpis.activeCompanies}
      activeSuppliers={exec.kpis.activeSuppliers}
      pendingCount={pendingCount}
    />
  );
}
