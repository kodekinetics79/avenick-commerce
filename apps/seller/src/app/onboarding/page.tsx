import Link from "next/link";
import { CheckCircle2, Circle, Clock, FileText, Package, ShieldCheck, Store } from "lucide-react";
import { db } from "@avenick/database";
import { requireSellerAnyPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";

export const metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const { seller, membership } = await requireSellerAnyPermission(["documents.view", "documents.manage"]);
  const [documents, productCounts] = await Promise.all([
    db.sellerDocument.findMany({
      where: { sellerId: seller.id },
      select: { id: true, type: true, fileName: true, status: true, rejectionReason: true },
      orderBy: { uploadedAt: "desc" },
    }),
    db.product.groupBy({ by: ["status"], where: { sellerId: seller.id, deletedAt: null }, _count: { _all: true } }),
  ]);

  const count = (status: string) => productCounts.find((row) => row.status === status)?._count._all ?? 0;
  const totalProducts = productCounts.reduce((sum, row) => sum + row._count._all, 0);
  const approvedDocuments = documents.filter((document) => document.status === "APPROVED").length;
  const profileComplete = Boolean(seller.businessNameEn && seller.crNumber && seller.country && seller.city);
  const documentsComplete = approvedDocuments > 0 && documents.every((document) => !["REJECTED", "EXPIRED"].includes(document.status));
  const productsComplete = count("ACTIVE") >= 5;
  const reviewComplete = seller.status === "ACTIVE";
  const steps = [
    { label: "Business profile", detail: profileComplete ? "Required identity fields are present." : "Business identity is incomplete.", done: profileComplete, href: "/settings", icon: Store },
    { label: "Compliance documents", detail: `${approvedDocuments} approved · ${documents.filter((document) => document.status === "PENDING_REVIEW").length} under review`, done: documentsComplete, href: "/documents", icon: FileText },
    { label: "Product catalog", detail: `${count("ACTIVE")} active · ${count("PENDING_REVIEW")} under review · ${count("REJECTED")} rejected`, done: productsComplete, href: "/products", icon: Package },
    { label: "Seller review", detail: `Account status: ${seller.status.replace(/_/g, " ")}`, done: reviewComplete, href: "/compliance", icon: ShieldCheck },
  ];
  const completed = steps.filter((step) => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Onboarding</h1>
          <p className="text-sm text-muted-foreground">Read-only progress calculated from current seller, document and product records.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Overall progress</p><span className="font-bold text-primary">{progress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">{completed} of {steps.length} evidence gates currently pass.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
          {steps.map((step) => (
            <Link key={step.label} href={step.href} className="flex items-start gap-4 p-5 hover:bg-secondary/40">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${step.done ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
                {step.done ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{step.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p></div>
              {step.done ? <span className="text-xs font-semibold text-success">Complete</span> : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />Open</span>}
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Submitted documents</h2><p className="text-xs text-muted-foreground">Review results shown exactly as stored.</p></div>
          {documents.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground"><Circle className="mx-auto mb-2 h-7 w-7" />No seller documents have been submitted.</div>
          ) : (
            <div className="divide-y divide-border">{documents.map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{document.fileName}</p><p className="text-xs text-muted-foreground">{document.type.replace(/_/g, " ")}{document.rejectionReason ? ` · ${document.rejectionReason}` : ""}</p></div>
                <span className="shrink-0 text-xs font-semibold">{document.status.replace(/_/g, " ")}</span>
              </div>
            ))}</div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">Catalog evidence: {totalProducts} total listing{totalProducts === 1 ? "" : "s"}. A submitted listing remains under review until governed admin approval.</p>
      </div>
    </SellerLayout>
  );
}
