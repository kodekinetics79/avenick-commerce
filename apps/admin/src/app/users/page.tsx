import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { UserCog, Plus, Search, Shield, Store, ShoppingBag, User } from "lucide-react";

export const metadata = { title: "User Management" };

type UserRole = "ADMIN" | "SELLER" | "BUYER" | "CONSUMER";
type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

const MOCK_USERS: Array<{
  id: string;
  name: string;
  email: string;
  role: UserRole;
  portal: string;
  status: UserStatus;
  lastActive: string;
  createdAt: string;
}> = [
  { id: "u001", name: "Admin User", email: "admin@avenick.com", role: "ADMIN", portal: "Admin", status: "ACTIVE", lastActive: "Just now", createdAt: "Jan 1, 2024" },
  { id: "u002", name: "Sara Ahmed", email: "sara.ahmed@avenick.com", role: "ADMIN", portal: "Admin", status: "ACTIVE", lastActive: "2 hours ago", createdAt: "Jan 1, 2024" },
  { id: "u003", name: "Gulf Industrial LLC", email: "procurement@gulf-industrial.ae", role: "SELLER", portal: "Seller", status: "ACTIVE", lastActive: "1 hour ago", createdAt: "Mar 12, 2024" },
  { id: "u004", name: "Mohammed Al Sayed", email: "m.alsayed@safeguard.ae", role: "SELLER", portal: "Seller", status: "ACTIVE", lastActive: "3 hours ago", createdAt: "Feb 18, 2024" },
  { id: "u005", name: "Ali Hassan (Al Noor)", email: "ali@alnoor-trading.sa", role: "BUYER", portal: "Customer B2B", status: "ACTIVE", lastActive: "4 hours ago", createdAt: "Apr 5, 2024" },
  { id: "u006", name: "Ahmad Khalil", email: "ahmad.k@apexprocure.ae", role: "BUYER", portal: "Customer B2B", status: "ACTIVE", lastActive: "2 days ago", createdAt: "May 20, 2024" },
  { id: "u007", name: "Fatima Al Zahraa", email: "fatima.z@gmail.com", role: "CONSUMER", portal: "Customer B2C", status: "ACTIVE", lastActive: "1 day ago", createdAt: "Jun 10, 2024" },
  { id: "u008", name: "Khalid Mohammed", email: "khalid.m@hotmail.com", role: "CONSUMER", portal: "Customer B2C", status: "ACTIVE", lastActive: "5 hours ago", createdAt: "Jul 3, 2024" },
  { id: "u009", name: "Rania Saad", email: "rania@cleanedge.ae", role: "SELLER", portal: "Seller", status: "INACTIVE", lastActive: "2 weeks ago", createdAt: "Aug 15, 2024" },
  { id: "u010", name: "Omar Yusuf", email: "omar.y@sharjah-safety.ae", role: "BUYER", portal: "Customer B2B", status: "SUSPENDED", lastActive: "1 month ago", createdAt: "Sep 1, 2024" },
];

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: typeof Shield }> = {
  ADMIN: { label: "Admin", color: "bg-red-100 text-red-700", icon: Shield },
  SELLER: { label: "Seller", color: "bg-orange-100 text-orange-700", icon: Store },
  BUYER: { label: "B2B Buyer", color: "bg-blue-100 text-primary", icon: ShoppingBag },
  CONSUMER: { label: "Consumer", color: "bg-green-100 text-green-700", icon: User },
};

const STATUS_CONFIG: Record<UserStatus, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700" },
  INACTIVE: { label: "Inactive", color: "bg-slate-100 text-muted-foreground" },
  SUSPENDED: { label: "Suspended", color: "bg-red-100 text-red-600" },
};

const ROLE_TABS = ["All", "Admin", "Seller", "B2B Buyer", "Consumer"] as const;

export default async function UsersPage() {
  await requireAdminSession();

  const roleCounts = {
    All: MOCK_USERS.length,
    Admin: MOCK_USERS.filter((u) => u.role === "ADMIN").length,
    Seller: MOCK_USERS.filter((u) => u.role === "SELLER").length,
    "B2B Buyer": MOCK_USERS.filter((u) => u.role === "BUYER").length,
    Consumer: MOCK_USERS.filter((u) => u.role === "CONSUMER").length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground text-sm">Manage platform users, roles, and access permissions</p>
          </div>
          <button type="button" className="flex items-center gap-2 bg-primary hover:bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            <Plus className="h-4 w-4" /> Invite User
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Admins", value: roleCounts.Admin, icon: Shield, color: "text-red-600", bg: "bg-red-50 border-red-200" },
            { label: "Sellers", value: roleCounts.Seller, icon: Store, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
            { label: "B2B Buyers", value: roleCounts["B2B Buyer"], icon: ShoppingBag, color: "text-primary", bg: "bg-blue-50 border-blue-200" },
            { label: "Consumers", value: roleCounts.Consumer, icon: User, color: "text-green-600", bg: "bg-green-50 border-green-200" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`rounded-2xl border p-4 ${stat.bg}`}>
                <Icon className={`h-4 w-4 mb-2 ${stat.color}`} />
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Search and filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-1.5 flex-1">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input type="text" placeholder="Search by name, email, or role..." className="flex-1 text-sm text-muted-foreground placeholder:text-muted-foreground outline-none" />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${tab === "All" ? "bg-slate-700 text-white" : "bg-white border border-border text-muted-foreground hover:border-slate-400"}`}
              >
                {tab} <span className="text-[10px]">({roleCounts[tab as keyof typeof roleCounts]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Users table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="text-start px-5 py-3">User</th>
                  <th className="text-start px-5 py-3">Role</th>
                  <th className="text-start px-5 py-3 hidden sm:table-cell">Portal</th>
                  <th className="text-start px-5 py-3">Status</th>
                  <th className="text-start px-5 py-3 hidden md:table-cell">Last Active</th>
                  <th className="text-start px-5 py-3 hidden lg:table-cell">Joined</th>
                  <th className="text-start px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_USERS.map((user) => {
                  const roleCfg = ROLE_CONFIG[user.role];
                  const statusCfg = STATUS_CONFIG[user.status];
                  const RoleIcon = roleCfg.icon;
                  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                            {initials}
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${roleCfg.color}`}>
                          <RoleIcon className="h-2.5 w-2.5" />
                          {roleCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell text-xs text-muted-foreground">{user.portal}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell text-xs text-muted-foreground">{user.lastActive}</td>
                      <td className="px-5 py-3 hidden lg:table-cell text-xs text-muted-foreground">{user.createdAt}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" className="text-xs text-primary hover:underline">Edit</button>
                          {user.status === "ACTIVE" && user.role !== "ADMIN" && (
                            <button type="button" className="text-xs text-red-500 hover:underline">Suspend</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 px-5 py-3 border-t border-border">
            <UserCog className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{MOCK_USERS.length} users · {MOCK_USERS.filter((u) => u.status === "ACTIVE").length} active</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
