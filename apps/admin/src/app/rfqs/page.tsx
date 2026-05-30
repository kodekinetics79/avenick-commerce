import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { FileQuestion, Plus, Search, ExternalLink } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "RFQ Management" };

type RFQStatus = "OPEN" | "QUOTED" | "ACCEPTED" | "CLOSED" | "EXPIRED";

const MOCK_RFQS: Array<{
  id: string;
  rfqNumber: string;
  buyer: string;
  buyerType: string;
  description: string;
  quantity: number;
  unit: string;
  targetPrice: number;
  currency: string;
  quotesReceived: number;
  status: RFQStatus;
  createdAt: string;
  requiredBy: string;
}> = [
  { id: "rfq_001", rfqNumber: "RFQ-2024-00241", buyer: "Gulf Industrial Supplies LLC", buyerType: "B2B", description: "Safety Helmets EN397 Standard, Various Sizes", quantity: 500, unit: "pcs", targetPrice: 75, currency: "AED", quotesReceived: 3, status: "QUOTED", createdAt: "Nov 22, 2024", requiredBy: "Dec 5, 2024" },
  { id: "rfq_002", rfqNumber: "RFQ-2024-00238", buyer: "Al Noor Trading Co", buyerType: "B2B", description: "Nitrile Examination Gloves, Large, Box of 100", quantity: 200, unit: "boxes", targetPrice: 40, currency: "AED", quotesReceived: 5, status: "ACCEPTED", createdAt: "Nov 20, 2024", requiredBy: "Dec 1, 2024" },
  { id: "rfq_003", rfqNumber: "RFQ-2024-00244", buyer: "Apex Procurement FZCO", buyerType: "B2B", description: "Industrial Drill Sets 18V, Including accessories", quantity: 50, unit: "sets", targetPrice: 380, currency: "AED", quotesReceived: 0, status: "OPEN", createdAt: "Nov 24, 2024", requiredBy: "Dec 10, 2024" },
  { id: "rfq_004", rfqNumber: "RFQ-2024-00230", buyer: "Doha Facilities Management", buyerType: "B2B", description: "CO2 Fire Extinguishers 5kg, Certified", quantity: 100, unit: "units", targetPrice: 160, currency: "AED", quotesReceived: 2, status: "QUOTED", createdAt: "Nov 18, 2024", requiredBy: "Nov 30, 2024" },
  { id: "rfq_005", rfqNumber: "RFQ-2024-00247", buyer: "Muscat Construction Supply", buyerType: "B2B", description: "Portland Cement 50kg Bags, Grade 42.5", quantity: 1000, unit: "bags", targetPrice: 25, currency: "AED", quotesReceived: 4, status: "OPEN", createdAt: "Nov 25, 2024", requiredBy: "Dec 15, 2024" },
  { id: "rfq_006", rfqNumber: "RFQ-2024-00219", buyer: "Kuwait Office Solutions", buyerType: "B2B", description: "Ergonomic Office Chairs, Mesh Back, Adjustable", quantity: 30, unit: "units", targetPrice: 700, currency: "AED", quotesReceived: 3, status: "CLOSED", createdAt: "Nov 10, 2024", requiredBy: "Nov 25, 2024" },
  { id: "rfq_007", rfqNumber: "RFQ-2024-00248", buyer: "Riyadh Tech Procurement", buyerType: "B2B", description: "Adjustable Laptop Stands, Premium Quality", quantity: 100, unit: "pcs", targetPrice: 85, currency: "AED", quotesReceived: 0, status: "OPEN", createdAt: "Nov 26, 2024", requiredBy: "Dec 12, 2024" },
  { id: "rfq_008", rfqNumber: "RFQ-2024-00212", buyer: "Sharjah Safety Systems", buyerType: "B2B", description: "Industrial Safety Vests, High Visibility, Various Sizes", quantity: 250, unit: "pcs", targetPrice: 35, currency: "AED", quotesReceived: 6, status: "ACCEPTED", createdAt: "Nov 8, 2024", requiredBy: "Nov 22, 2024" },
];

const STATUS_CONFIG: Record<RFQStatus, { label: string; color: string }> = {
  OPEN: { label: "Open", color: "bg-blue-100 text-blue-700" },
  QUOTED: { label: "Quoted", color: "bg-purple-100 text-purple-700" },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-700" },
  CLOSED: { label: "Closed", color: "bg-slate-100 text-slate-500" },
  EXPIRED: { label: "Expired", color: "bg-red-100 text-red-600" },
};

const STATUS_TABS = ["All", "Open", "Quoted", "Accepted", "Closed"] as const;

export default async function RFQsPage() {
  await requireAdminSession();

  const countByStatus = {
    All: MOCK_RFQS.length,
    Open: MOCK_RFQS.filter((r) => r.status === "OPEN").length,
    Quoted: MOCK_RFQS.filter((r) => r.status === "QUOTED").length,
    Accepted: MOCK_RFQS.filter((r) => r.status === "ACCEPTED").length,
    Closed: MOCK_RFQS.filter((r) => r.status === "CLOSED").length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">RFQ Management</h1>
            <p className="text-muted-foreground text-sm">Track requests for quotes from B2B buyers across suppliers</p>
          </div>
          <button type="button" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            <Plus className="h-4 w-4" /> Create RFQ
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open RFQs", value: countByStatus.Open, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
            { label: "Awaiting Response", value: MOCK_RFQS.filter((r) => r.status === "OPEN" && r.quotesReceived === 0).length, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Accepted", value: countByStatus.Accepted, color: "text-green-600", bg: "bg-green-50 border-green-200" },
            { label: "Conversion Rate", value: "34%", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl border p-4 ${stat.bg}`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search and filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-1.5 flex-1">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input type="text" placeholder="Search RFQ number, buyer, or product..." className="flex-1 text-sm text-slate-600 placeholder:text-slate-400 outline-none" />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${tab === "All" ? "bg-slate-700 text-white" : "bg-white border border-border text-slate-500 hover:border-slate-400"}`}
              >
                {tab}
                <span className="text-[10px] font-bold">{countByStatus[tab as keyof typeof countByStatus]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* RFQ table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="text-start px-5 py-3">RFQ Number</th>
                  <th className="text-start px-5 py-3">Buyer</th>
                  <th className="text-start px-5 py-3 hidden md:table-cell">Product / Service</th>
                  <th className="text-start px-5 py-3 hidden sm:table-cell">Qty</th>
                  <th className="text-start px-5 py-3 hidden lg:table-cell">Target Price</th>
                  <th className="text-start px-5 py-3">Status</th>
                  <th className="text-start px-5 py-3 hidden sm:table-cell">Quotes</th>
                  <th className="text-start px-5 py-3 hidden lg:table-cell">Required By</th>
                  <th className="text-start px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_RFQS.map((rfq) => {
                  const cfg = STATUS_CONFIG[rfq.status];
                  const noResponse = rfq.quotesReceived === 0 && rfq.status === "OPEN";
                  return (
                    <tr key={rfq.id} className={`hover:bg-muted/20 transition-colors ${noResponse ? "bg-amber-50/40" : ""}`}>
                      <td className="px-5 py-3">
                        <p className="font-mono text-xs font-semibold text-slate-600">{rfq.rfqNumber}</p>
                        <p className="text-xs text-muted-foreground">{rfq.createdAt}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{rfq.buyer}</p>
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold">{rfq.buyerType}</span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <p className="text-sm max-w-[180px] line-clamp-2">{rfq.description}</p>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell font-medium">{rfq.quantity} {rfq.unit}</td>
                      <td className="px-5 py-3 hidden lg:table-cell font-medium">{rfq.currency} {rfq.targetPrice}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        {noResponse ? (
                          <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            0 — Needs attention
                          </span>
                        ) : (
                          <span className="font-semibold">{rfq.quotesReceived}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell text-xs text-muted-foreground">{rfq.requiredBy}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button type="button" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                            <ExternalLink className="h-3 w-3" /> View
                          </button>
                          {noResponse && (
                            <button type="button" className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-2 py-0.5 rounded-lg font-medium transition-colors">
                              + Assign Supplier
                            </button>
                          )}
                          {rfq.status === "QUOTED" && (
                            <button type="button" className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-0.5 rounded-lg font-medium transition-colors">
                              Compare Quotes
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{MOCK_RFQS.length} RFQs total — showing most recent</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
