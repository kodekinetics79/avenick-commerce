import Link from "next/link";
import Image from "next/image";
import { requireSellerSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { AlertTriangle, XCircle, AlertCircle, Info, ArrowRight } from "lucide-react";

const SEVERITY_CONFIG = {
  ERROR: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", label: "Error" },
  WARNING: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", label: "Warning" },
  INFO: { icon: Info, color: "text-primary", bg: "bg-blue-50 border-blue-200", label: "Info" },
};

const ISSUE_ACTION_MAP: Record<string, { label: string; path: string }> = {
  MISSING_IMAGES: { label: "Add Images", path: "edit" },
  MISSING_ARABIC_TITLE: { label: "Edit Product", path: "edit" },
  MISSING_ARABIC_DESCRIPTION: { label: "Edit Product", path: "edit" },
  NO_PRICE: { label: "Set Pricing", path: "edit" },
  NO_STOCK: { label: "Update Inventory", path: "inventory" },
  MISSING_COMPLIANCE: { label: "Upload Documents", path: "compliance" },
  REJECTED_BY_ADMIN: { label: "Edit & Resubmit", path: "edit" },
  SUPPRESSED: { label: "Fix Issues", path: "edit" },
};

export default async function IssuesPage() {
  const { seller } = await requireSellerSession();

  const issuesWithProducts = await db.productIssue.findMany({
    where: { product: { sellerId: seller.id }, resolvedAt: null },
    include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
  });

  const errorCount = issuesWithProducts.filter((i) => i.severity === "ERROR").length;
  const warningCount = issuesWithProducts.filter((i) => i.severity === "WARNING").length;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} issueCount={issuesWithProducts.length}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Fix Your Products — إصلاح منتجاتك
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Resolve issues to improve your listing health and sales performance</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{errorCount}</p>
            <p className="text-sm text-red-600 font-medium">Errors</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{warningCount}</p>
            <p className="text-sm text-yellow-600 font-medium">Warnings</p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold">{issuesWithProducts.length}</p>
            <p className="text-sm text-muted-foreground font-medium">Total Issues</p>
          </div>
        </div>

        {issuesWithProducts.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <p className="text-green-700 font-semibold text-lg">All products are healthy!</p>
            <p className="text-green-600 text-sm mt-1">جميع منتجاتك في حالة جيدة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {issuesWithProducts.map((issue) => {
              const cfg = SEVERITY_CONFIG[issue.severity as keyof typeof SEVERITY_CONFIG];
              const action = ISSUE_ACTION_MAP[issue.issueType];
              const p = issue.product;
              const actionPath = action?.path === "edit" ? `/products/${p.id}/edit` :
                                 action?.path === "inventory" ? `/inventory?product=${p.id}` :
                                 `/compliance?product=${p.id}`;
              return (
                <div key={issue.id} className={`rounded-2xl border p-4 ${cfg.bg}`}>
                  <div className="flex items-start gap-3">
                    {p.images[0] ? (
                      <Image src={p.images[0].url} alt={p.nameEn} width={48} height={48} className="rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-lg shrink-0 flex items-center justify-center text-xs text-muted-foreground">No img</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <cfg.icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                        <span className={`text-xs font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-muted-foreground">· {issue.issueType.replace(/_/g, " ")}</span>
                      </div>
                      <Link href={`/products/${p.id}/edit`} className="font-semibold text-sm hover:underline block">{p.nameEn}</Link>
                      <p className="text-xs text-muted-foreground">{p.nameAr} · SKU: {p.sku}</p>
                      <p className="text-sm mt-1">{issue.message}</p>
                      {issue.messageAr && <p className="text-sm text-right" dir="rtl">{issue.messageAr}</p>}
                    </div>
                    {action && (
                      <Link href={actionPath} className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg ${cfg.color} border ${cfg.bg} hover:opacity-80 transition-opacity`}>
                        {action.label} <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
