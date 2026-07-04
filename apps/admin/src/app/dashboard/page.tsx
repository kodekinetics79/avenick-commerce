import { DashboardView } from "./dashboard-view";
import { fetchAdminBackend } from "@/lib/backend";

export const metadata = { title: "Executive Command Center" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { exec, topCustomers, pendingCount } = await fetchAdminBackend<{
    exec: Parameters<typeof DashboardView>[0]["exec"];
    topCustomers: Parameters<typeof DashboardView>[0]["topCustomers"];
    pendingCount: number;
  }>("/api/admin/dashboard");

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
