import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_SEGMENTS } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { PieChart, Plus, ArrowLeft, TrendingUp, TrendingDown, Users, Megaphone, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Segments" };

const COLOR_MAP: Record<string, { bg: string; text: string; dot: string; ring: string }> = {
  purple: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", ring: "border-purple-200" },
  blue:   { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500",   ring: "border-blue-200" },
  red:    { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500",    ring: "border-red-200" },
  green:  { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500",  ring: "border-green-200" },
  amber:  { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500",  ring: "border-amber-200" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", ring: "border-orange-200" },
  slate:  { bg: "bg-slate-50",  text: "text-slate-700",  dot: "bg-slate-500",  ring: "border-slate-200" },
  cyan:   { bg: "bg-cyan-50",   text: "text-cyan-700",   dot: "bg-cyan-500",   ring: "border-cyan-200" },
};

export default async function SegmentsPage() {
  await requireAdminSession();

  const totalCustomers = MOCK_SEGMENTS.reduce((s, seg) => s + seg.count, 0);
  const growing = MOCK_SEGMENTS.filter(s => s.growth > 0).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/crm" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> CRM
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Segments</span>
            </div>
            <h1 className="text-2xl font-bold">Customer Segments</h1>
            <p className="text-sm text-muted-foreground">{MOCK_SEGMENTS.length} segments · {totalCustomers.toLocaleString()} customers grouped</p>
          </div>
          <button type="button" className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus className="h-3.5 w-3.5" /> Create Segment
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Segments", value: MOCK_SEGMENTS.length, color: "text-slate-800" },
            { label: "Customers Grouped", value: totalCustomers.toLocaleString(), color: "text-blue-600" },
            { label: "Growing Segments", value: growing, color: "text-green-600" },
            { label: "VIP Accounts", value: MOCK_SEGMENTS.find(s => s.id === "seg1")?.count ?? 0, color: "text-purple-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-border p-4">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Segment cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MOCK_SEGMENTS.map((seg) => {
            const c = COLOR_MAP[seg.color] ?? COLOR_MAP.slate;
            const isGrowing = seg.growth >= 0;
            return (
              <div key={seg.id} className={`bg-white rounded-2xl border ${c.ring} overflow-hidden`}>
                <div className={`px-5 py-4 ${c.bg} border-b ${c.ring}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                      <div>
                        <h3 className="font-semibold text-sm">{seg.name}</h3>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.bg} ${c.text}`}>{seg.type}</span>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="text-2xl font-bold">{seg.count.toLocaleString()}</p>
                      <p className={`text-xs flex items-center gap-0.5 justify-end font-medium ${isGrowing ? "text-green-600" : "text-red-600"}`}>
                        {isGrowing ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isGrowing ? "+" : ""}{seg.growth}%
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-muted-foreground mb-4">{seg.description}</p>
                  <div className="flex items-center justify-between">
                    {seg.avgSpend > 0 ? (
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Lifetime Value</p>
                        <p className="font-bold text-green-700">{formatCurrency(seg.avgSpend, "AED")}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-muted-foreground">Conversion opportunity</p>
                        <p className="font-bold text-amber-600">Not yet purchased</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button type="button" className="flex items-center gap-1 text-xs border border-border text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition-colors">
                        <Users className="h-3 w-3" /> View
                      </button>
                      <Link href="/campaigns" className="flex items-center gap-1 text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 font-medium transition-colors">
                        <Megaphone className="h-3 w-3" /> Target
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 flex items-center justify-between text-white">
          <div>
            <h3 className="font-bold mb-1">Turn segments into revenue</h3>
            <p className="text-slate-400 text-sm">Launch targeted campaigns to any segment with one click.</p>
          </div>
          <Link href="/campaigns" className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap">
            Create Campaign <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
