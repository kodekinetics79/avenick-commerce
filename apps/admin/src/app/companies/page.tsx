import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Building2, TrendingUp, CreditCard, Users, Search, Plus, ExternalLink } from "lucide-react";

export const metadata = { title: "B2B Companies" };

type CompanyStatus = "ACTIVE" | "SUSPENDED" | "PENDING_REVIEW" | "CREDIT_HOLD";
type HealthLevel = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

const MOCK_COMPANIES: Array<{
  id: string;
  name: string;
  nameAr: string;
  crNumber: string;
  city: string;
  country: string;
  type: string;
  gmv: number;
  creditLimit: number;
  creditUsed: number;
  status: CompanyStatus;
  lastActivity: string;
  health: HealthLevel;
  accountManager: string;
}> = [
  { id: "c001", name: "Gulf Industrial Supplies LLC", nameAr: "الخليج للمستلزمات الصناعية", crNumber: "AE-7721034", city: "Dubai", country: "AE", type: "B2B", gmv: 284000, creditLimit: 150000, creditUsed: 82000, status: "ACTIVE", lastActivity: "2 hours ago", health: "EXCELLENT", accountManager: "Sara Ahmed" },
  { id: "c002", name: "Al Noor Trading Co", nameAr: "شركة النور للتجارة", crNumber: "SA-1234567", city: "Riyadh", country: "SA", type: "B2B", gmv: 192000, creditLimit: 100000, creditUsed: 91000, status: "ACTIVE", lastActivity: "1 day ago", health: "GOOD", accountManager: "Ali Hassan" },
  { id: "c003", name: "Apex Procurement FZCO", nameAr: "أبيكس للمشتريات", crNumber: "AE-9934201", city: "Abu Dhabi", country: "AE", type: "B2B", gmv: 148000, creditLimit: 75000, creditUsed: 12000, status: "ACTIVE", lastActivity: "3 days ago", health: "EXCELLENT", accountManager: "Sara Ahmed" },
  { id: "c004", name: "Doha Facilities Management", nameAr: "دوحة لإدارة المرافق", crNumber: "QA-5512398", city: "Doha", country: "QA", type: "B2B", gmv: 97400, creditLimit: 60000, creditUsed: 55000, status: "CREDIT_HOLD", lastActivity: "5 days ago", health: "FAIR", accountManager: "Mohammed Al Sayed" },
  { id: "c005", name: "Muscat Construction Supply", nameAr: "مسقط لمواد البناء", crNumber: "OM-2281047", city: "Muscat", country: "OM", type: "B2B", gmv: 83200, creditLimit: 50000, creditUsed: 18000, status: "ACTIVE", lastActivity: "1 hour ago", health: "GOOD", accountManager: "Ali Hassan" },
  { id: "c006", name: "Kuwait Office Solutions", nameAr: "الكويت لحلول المكاتب", crNumber: "KW-8834120", city: "Kuwait City", country: "KW", type: "B2B", gmv: 61800, creditLimit: 40000, creditUsed: 9000, status: "ACTIVE", lastActivity: "2 days ago", health: "EXCELLENT", accountManager: "Sara Ahmed" },
  { id: "c007", name: "Sharjah Safety Systems", nameAr: "الشارقة لأنظمة السلامة", crNumber: "AE-4421008", city: "Sharjah", country: "AE", type: "B2B", gmv: 44100, creditLimit: 30000, creditUsed: 27000, status: "ACTIVE", lastActivity: "4 hours ago", health: "GOOD", accountManager: "Mohammed Al Sayed" },
  { id: "c008", name: "Riyadh Tech Procurement", nameAr: "الرياض لمشتريات التقنية", crNumber: "SA-9921345", city: "Riyadh", country: "SA", type: "B2B", gmv: 28900, creditLimit: 25000, creditUsed: 2000, status: "PENDING_REVIEW", lastActivity: "1 week ago", health: "FAIR", accountManager: "Ali Hassan" },
];

const STATUS_CONFIG: Record<CompanyStatus, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700" },
  SUSPENDED: { label: "Suspended", color: "bg-red-100 text-red-700" },
  PENDING_REVIEW: { label: "Pending Review", color: "bg-amber-100 text-amber-700" },
  CREDIT_HOLD: { label: "Credit Hold", color: "bg-orange-100 text-orange-700" },
};

const HEALTH_CONFIG: Record<HealthLevel, { color: string; dot: string }> = {
  EXCELLENT: { color: "text-green-600", dot: "bg-green-500" },
  GOOD: { color: "text-blue-600", dot: "bg-blue-500" },
  FAIR: { color: "text-amber-600", dot: "bg-amber-500" },
  POOR: { color: "text-red-600", dot: "bg-red-500" },
};

export default async function CompaniesPage() {
  await requireAdminSession();

  const totalGMV = MOCK_COMPANIES.reduce((s, c) => s + c.gmv, 0);
  const totalCredit = MOCK_COMPANIES.reduce((s, c) => s + c.creditLimit, 0);
  const activeCount = MOCK_COMPANIES.filter((c) => c.status === "ACTIVE").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">B2B Companies</h1>
            <p className="text-muted-foreground text-sm">Manage enterprise accounts, credit limits, and account health</p>
          </div>
          <button type="button" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            <Plus className="h-4 w-4" /> Add Company
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Accounts</p>
            </div>
            <p className="text-2xl font-bold">{MOCK_COMPANIES.length}</p>
            <p className="text-xs text-green-600 mt-1">+18 this month</p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-green-500" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Ordered this month</p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total GMV</p>
            </div>
            <p className="text-2xl font-bold">AED {(totalGMV / 1000).toFixed(0)}k</p>
            <p className="text-xs text-green-600 mt-1">+24% vs last month</p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-purple-500" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Credit Issued</p>
            </div>
            <p className="text-2xl font-bold">AED {(totalCredit / 1000).toFixed(0)}k</p>
            <p className="text-xs text-muted-foreground mt-1">Across all accounts</p>
          </div>
        </div>

        {/* Search and filter bar */}
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-border p-3">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input type="text" placeholder="Search by company name, CR number, city..." className="flex-1 text-sm text-slate-600 placeholder:text-slate-400 outline-none" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["All", "Active", "Credit Hold", "Pending"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${f === "All" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Companies table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="text-start px-5 py-3">Company</th>
                  <th className="text-start px-5 py-3 hidden sm:table-cell">Location</th>
                  <th className="text-start px-5 py-3">GMV</th>
                  <th className="text-start px-5 py-3 hidden md:table-cell">Credit Limit</th>
                  <th className="text-start px-5 py-3 hidden lg:table-cell">Credit Used</th>
                  <th className="text-start px-5 py-3">Status</th>
                  <th className="text-start px-5 py-3 hidden lg:table-cell">Account Health</th>
                  <th className="text-start px-5 py-3 hidden sm:table-cell">Last Activity</th>
                  <th className="text-start px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_COMPANIES.map((company) => {
                  const statusCfg = STATUS_CONFIG[company.status];
                  const healthCfg = HEALTH_CONFIG[company.health];
                  const creditPct = Math.round((company.creditUsed / company.creditLimit) * 100);
                  return (
                    <tr key={company.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-medium">{company.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{company.crNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell text-muted-foreground text-xs">{company.city}, {company.country}</td>
                      <td className="px-5 py-3 font-semibold">AED {(company.gmv / 1000).toFixed(0)}k</td>
                      <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">AED {(company.creditLimit / 1000).toFixed(0)}k</td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <div>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className={creditPct > 85 ? "text-amber-600 font-semibold" : "text-muted-foreground"}>
                              AED {(company.creditUsed / 1000).toFixed(0)}k
                            </span>
                            <span className={creditPct > 85 ? "text-amber-600 font-semibold" : "text-muted-foreground"}>{creditPct}%</span>
                          </div>
                          <div className="flex gap-0.5 w-24 h-1.5">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <div key={i} className={`flex-1 rounded-full ${i < Math.floor(creditPct / 10) ? (creditPct > 85 ? "bg-amber-500" : creditPct > 60 ? "bg-blue-500" : "bg-green-500") : "bg-gray-100"}`} />
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${healthCfg.dot}`} />
                          <span className={`text-xs font-medium ${healthCfg.color}`}>{company.health}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell text-xs text-muted-foreground">{company.lastActivity}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
