import { requireAdminSession } from "@/lib/auth";
import { getExecutiveDashboardData, db } from "@avenick/database";
import { DashboardView } from "./dashboard-view";

export const metadata = { title: "Executive Command Center" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminSession();

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
