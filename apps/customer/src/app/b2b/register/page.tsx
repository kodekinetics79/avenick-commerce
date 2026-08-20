import Link from "next/link";
import { Building2, CheckCircle, Users, FileText, TrendingUp, ShieldCheck } from "lucide-react";
import { Button } from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";

const FEATURES = [
  { icon: TrendingUp, title: "Bulk & B2B Pricing", desc: "Access exclusive tiered pricing and volume discounts" },
  { icon: FileText, title: "Purchase Orders", desc: "Create and manage POs with approval workflows" },
  { icon: Users, title: "Team Management", desc: "Add buyers with role-based spend limits" },
  { icon: ShieldCheck, title: "Credit Terms", desc: "Net-30/60/90 payment terms for approved companies" },
];

export default function B2BRegisterPage() {
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm mb-4">
            <Building2 className="h-4 w-4" />
            B2B Marketplace — للشركات
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Grow Your Business with Avenick Commerce
            <span className="block text-2xl font-normal text-muted-foreground mt-2">طوّر أعمالك مع Avenick Commerce</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join thousands of businesses sourcing industrial supplies, safety equipment, and more from GCC suppliers — with B2B pricing, purchase orders, and approval workflows built in.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-border p-6 text-center">
              <f.icon className="h-8 w-8 mx-auto text-primary/100 mb-3" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-primary to-primary/100 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">Ready to get started?</h2>
          <p className="text-primary/20 mb-6">Create a business account in minutes. No commitment required.</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-primary/10">
              <Link href="/register">Register Business Account</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white border border-white/30 hover:bg-white/10">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
