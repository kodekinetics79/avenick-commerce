import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { CheckCircle, Circle, Clock, Upload, User, Package, ShieldCheck, Star } from "lucide-react";

export const metadata = { title: "Onboarding" };

const STEPS = [
  {
    id: 1,
    label: "Profile",
    icon: User,
    status: "COMPLETE" as const,
    desc: "Business name, address, and contact information",
  },
  {
    id: 2,
    label: "Documents",
    icon: ShieldCheck,
    status: "COMPLETE" as const,
    desc: "CR, VAT certificate, and trade license uploaded",
  },
  {
    id: 3,
    label: "Products",
    icon: Package,
    status: "IN_PROGRESS" as const,
    desc: "Add at least 5 active product listings",
  },
  {
    id: 4,
    label: "Review",
    icon: Clock,
    status: "PENDING" as const,
    desc: "Avenick Commerce team reviews your account",
  },
  {
    id: 5,
    label: "Approved",
    icon: Star,
    status: "PENDING" as const,
    desc: "Start selling to B2B and B2C buyers across GCC",
  },
];

const REQUIRED_DOCS = [
  { name: "Commercial Registration (CR)", status: "UPLOADED", hint: "Required for all sellers" },
  { name: "VAT Certificate", status: "UPLOADED", hint: "Required if VAT registered" },
  { name: "Trade License", status: "UPLOADED", hint: "Valid trade license from issuing authority" },
  { name: "Bank Account Details", status: "PENDING", hint: "For payout settlements" },
];

export default async function OnboardingPage() {
  const { seller } = await requireSellerSession();

  const completedSteps = STEPS.filter((s) => s.status === "COMPLETE").length;
  const progress = Math.round((completedSteps / STEPS.length) * 100);

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Onboarding</h1>
          <p className="text-muted-foreground text-sm">Complete these steps to activate your seller account.</p>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">Overall Progress</p>
            <span className="text-sm font-bold text-orange-600">{progress}%</span>
          </div>
          <div className="flex gap-1 w-full h-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`flex-1 rounded-full transition-colors ${i < Math.floor(progress / 10) ? "bg-green-500" : "bg-gray-100"}`} />
            ))}
          </div>
        </div>

        {/* Step list */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {STEPS.map((step, idx) => {
            const isLast = idx === STEPS.length - 1;
            const Icon = step.icon;
            return (
              <div key={step.id} className={`flex items-start gap-4 p-5 ${!isLast ? "border-b border-border" : ""}`}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  step.status === "COMPLETE" ? "bg-green-100" :
                  step.status === "IN_PROGRESS" ? "bg-orange-100" :
                  "bg-gray-100"
                }`}>
                  {step.status === "COMPLETE" ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : step.status === "IN_PROGRESS" ? (
                    <Icon className="h-5 w-5 text-orange-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{step.label}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      step.status === "COMPLETE" ? "bg-green-100 text-green-700" :
                      step.status === "IN_PROGRESS" ? "bg-orange-100 text-orange-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {step.status === "COMPLETE" ? "Complete" : step.status === "IN_PROGRESS" ? "In Progress" : "Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Document upload checklist */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Required Documents</h2>
          </div>
          <div className="divide-y divide-border">
            {REQUIRED_DOCS.map((doc) => (
              <div key={doc.name} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.hint}</p>
                </div>
                <div className="flex items-center gap-2">
                  {doc.status === "UPLOADED" ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                      <CheckCircle className="h-3.5 w-3.5" /> Uploaded
                    </span>
                  ) : (
                    <button type="button" className="flex items-center gap-1 text-xs bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors">
                      <Upload className="h-3.5 w-3.5" /> Upload
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
