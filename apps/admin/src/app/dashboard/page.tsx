import { requireAdminSession } from "@/lib/auth";
import { getAdminDashboard, db, MOCK_EXECUTIVE, MOCK_TOP_CUSTOMERS } from "@manzil/database";
import { DashboardView } from "./dashboard-view";

export const metadata = { title: "Executive Command Center" };

export default async function AdminDashboardPage() {
  await requireAdminSession();
  const dash = await getAdminDashboard();
  const pendingCount = await db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } });

  // Prefer live GMV when paid orders exist; otherwise fall back to executive mock for demo.
  const liveGmvMonth = Number(dash.gmvMonth);
  const gmvMonth = liveGmvMonth > 0 ? liveGmvMonth : MOCK_EXECUTIVE.kpis.gmvMonth;

  // Pass only plain, serializable data across the server → client boundary.
  return (
    <DashboardView
      exec={MOCK_EXECUTIVE}
      topCustomers={MOCK_TOP_CUSTOMERS}
      gmvMonth={gmvMonth}
      activeCompanies={dash.activeCompanies}
      activeSuppliers={dash.activeSellers}
      pendingCount={pendingCount}
    />
  );
}
