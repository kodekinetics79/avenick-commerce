import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { Settings, User, Building2, CreditCard, Bell, Globe, Shield } from "lucide-react";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { seller } = await requireSellerSession();

  const sections = [
    {
      icon: Building2,
      title: "Business Information",
      desc: "Update your business name, address, and contact details",
      items: [
        { label: "Business Name (EN)", value: seller.businessNameEn },
        { label: "Business Name (AR)", value: seller.businessNameAr ?? "—" },
        { label: "CR Number", value: seller.crNumber },
        { label: "VAT Number", value: seller.vatNumber ?? "—" },
        { label: "Country", value: seller.country },
        { label: "City", value: seller.city },
      ],
    },
    {
      icon: CreditCard,
      title: "Banking & Payouts",
      desc: "Manage your bank account details for payouts",
      items: [
        { label: "Commission Rate", value: `${Number(seller.commissionRate)}%` },
        { label: "Bank Details", value: seller.bankDetails ? "Configured" : "Not configured" },
      ],
    },
    {
      icon: Globe,
      title: "Store Settings",
      desc: "Configure your store visibility and preferences",
      items: [
        { label: "Seller Type", value: seller.type.replace(/_/g, " ") },
        { label: "Tier", value: seller.tier },
        { label: "Status", value: seller.status.replace(/_/g, " ") },
      ],
    },
    {
      icon: Bell,
      title: "Notifications",
      desc: "Configure email, SMS, and push notification preferences",
      items: [
        { label: "Order updates", value: "Enabled" },
        { label: "Payment alerts", value: "Enabled" },
        { label: "RFQ notifications", value: "Enabled" },
      ],
    },
    {
      icon: Shield,
      title: "Security",
      desc: "Manage your password and two-factor authentication",
      items: [
        { label: "Password", value: "••••••••" },
        { label: "Two-factor auth", value: "Disabled" },
      ],
    },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your store configuration and preferences</p>
          </div>
        </div>

        {/* Profile summary */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-white font-bold text-xl shrink-0">
              {seller.businessNameEn.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-lg truncate">{seller.businessNameEn}</p>
              <p className="text-sm text-muted-foreground">{seller.businessNameAr}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">{seller.tier}</span>
                <span className="text-xs text-muted-foreground">ID: {seller.id.slice(0, 8)}…</span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings sections */}
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.title} className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                <section.icon className="h-4 w-4 text-primary" />
                <div>
                  <h2 className="font-semibold text-sm">{section.title}</h2>
                  <p className="text-xs text-muted-foreground">{section.desc}</p>
                </div>
              </div>
              <div className="divide-y divide-border">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SellerLayout>
  );
}
