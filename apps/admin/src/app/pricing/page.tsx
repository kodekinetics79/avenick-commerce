import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_PRICING_PRODUCTS, MOCK_BULK_TIERS, MOCK_CONTRACT_PRICING, MOCK_COMMISSION_RULES } from "@manzil/database";
import { formatCurrency } from "@manzil/utils";
import { Coins, Layers, FileText, Percent, TrendingUp, Plus, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export const metadata = { title: "Pricing & Commission" };

function margin(b2c: number, cost: number, commissionRate: number, handling: number) {
  const commission = b2c * (commissionRate / 100);
  const grossMargin = b2c - cost - commission - handling;
  const marginPct = b2c > 0 ? Math.round((grossMargin / b2c) * 100) : 0;
  return { commission, grossMargin, marginPct };
}

const marginColor = (pct: number) => pct >= 35 ? "text-green-600" : pct >= 20 ? "text-amber-600" : "text-red-600";

export default async function PricingPage() {
  await requireAdminSession();

  const avgMargin = Math.round(
    MOCK_PRICING_PRODUCTS.reduce((s, p) => s + margin(p.b2cPrice, p.supplierCost, p.commissionRate, p.handlingFee).marginPct, 0) / MOCK_PRICING_PRODUCTS.length
  );
  const activeContracts = MOCK_CONTRACT_PRICING.filter(c => c.status === "ACTIVE").length;
  const activeRules = MOCK_COMMISSION_RULES.filter(r => r.status === "ACTIVE").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pricing &amp; Commission</h1>
            <p className="text-muted-foreground text-sm">Price tiers, contract pricing, commission rules, and margin analysis</p>
          </div>
          <button type="button" className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Rule
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Avg Gross Margin", value: `${avgMargin}%`, color: marginColor(avgMargin), bg: "bg-white border-border", icon: TrendingUp },
            { label: "Active Contracts", value: activeContracts, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: FileText },
            { label: "Commission Rules", value: activeRules, color: "text-purple-600", bg: "bg-purple-50 border-purple-200", icon: Percent },
            { label: "Bulk Tiers", value: MOCK_BULK_TIERS.length, color: "text-green-600", bg: "bg-green-50 border-green-200", icon: Layers },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <Icon className={`h-4 w-4 ${color} mb-2`} />
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Margin analysis table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Coins className="h-4 w-4 text-green-600" />
            <h2 className="font-semibold">Price &amp; Margin Analysis</h2>
            <span className="ms-auto text-xs text-muted-foreground">B2C selling price basis</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Product","Supplier Cost","B2C Price","B2B Price","Commission","Handling","VAT","Gross Margin"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_PRICING_PRODUCTS.map((p) => {
                  const { commission, grossMargin, marginPct } = margin(p.b2cPrice, p.supplierCost, p.commissionRate, p.handlingFee);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.sku} · {p.seller}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatCurrency(p.supplierCost, "AED")}</td>
                      <td className="px-4 py-3 font-bold">{formatCurrency(p.b2cPrice, "AED")}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(p.b2bPrice, "AED")}</td>
                      <td className="px-4 py-3 text-red-600">−{formatCurrency(commission, "AED")} <span className="text-xs text-muted-foreground">({p.commissionRate}%)</span></td>
                      <td className="px-4 py-3 text-red-600">−{formatCurrency(p.handlingFee, "AED")}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.vatRate}%</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${marginColor(marginPct)}`}>{formatCurrency(grossMargin, "AED")}</span>
                        <span className={`text-xs ms-1 ${marginColor(marginPct)}`}>({marginPct}%)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-xs text-muted-foreground">Gross Margin = B2C Price − Supplier Cost − Commission − Handling Fee (VAT excluded, passed through)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bulk pricing tiers */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-500" />
              <h2 className="font-semibold">Bulk Pricing Tiers</h2>
              <span className="ms-auto text-xs text-muted-foreground">Example: SH-X200</span>
            </div>
            <div className="divide-y divide-border">
              {MOCK_BULK_TIERS.map((tier, i) => {
                const baseTier = MOCK_BULK_TIERS[0].price;
                const savings = Math.round(((baseTier - tier.price) / baseTier) * 100);
                return (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="font-medium text-sm">{tier.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {tier.minQty}{tier.maxQty ? `–${tier.maxQty}` : "+"} units
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-green-700">{formatCurrency(tier.price, "AED")}</p>
                      {savings > 0 && <p className="text-xs text-green-600">−{savings}% vs base</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commission rules */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Percent className="h-4 w-4 text-purple-500" />
              <h2 className="font-semibold">Commission Rules</h2>
              <button type="button" className="ms-auto text-xs text-blue-600 hover:underline font-medium">+ Add Rule</button>
            </div>
            <div className="divide-y divide-border">
              {MOCK_COMMISSION_RULES.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{rule.name}</p>
                      {rule.status === "ACTIVE"
                        ? <span className="flex items-center gap-0.5 text-xs text-green-600"><CheckCircle className="h-3 w-3" /></span>
                        : <span className="flex items-center gap-0.5 text-xs text-amber-600"><Clock className="h-3 w-3" /> Scheduled</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{rule.scope}</p>
                  </div>
                  <p className="font-bold text-purple-700 shrink-0">{rule.rate}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contract pricing */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <h2 className="font-semibold">Contract Pricing (Customer-Specific)</h2>
            <span className="ms-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{MOCK_CONTRACT_PRICING.length} agreements</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Company","Product","Contract Price","Standard Price","Discount","Valid Until","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_CONTRACT_PRICING.map((c) => (
                  <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${c.status === "EXPIRING" ? "bg-amber-50/30" : ""}`}>
                    <td className="px-4 py-3 font-medium text-sm">{c.company}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{c.product}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.sku}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(c.contractPrice, "AED")}</td>
                    <td className="px-4 py-3 text-muted-foreground line-through">{formatCurrency(c.standardPrice, "AED")}</td>
                    <td className="px-4 py-3"><span className="text-green-600 font-medium">−{c.discount}%</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.validUntil}</td>
                    <td className="px-4 py-3">
                      {c.status === "ACTIVE"
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" /> Active</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><AlertTriangle className="h-3 w-3" /> Expiring</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" className="text-xs text-blue-600 hover:underline font-medium">{c.status === "EXPIRING" ? "Renew" : "Edit"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
