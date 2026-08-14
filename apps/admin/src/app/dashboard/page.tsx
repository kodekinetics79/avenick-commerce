import { DashboardView } from "./dashboard-view";
import { db, getExecutiveDashboardData } from "@avenick/database";
import { getCurrentAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Executive Command Center" };
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
