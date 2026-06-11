import Link from "next/link";
import { ArrowLeft, Building2, MapPin, Phone, Mail, Globe, Users, CreditCard, FileText, Edit } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { MOCK_B2B_COMPANY } from "@avenick/database";
import { Button } from "@avenick/ui";

export const metadata = { title: "Company Profile — Avenick Commerce" };

const COMPANY_USERS = [
  { id: "u1", name: "Ahmed Al-Rashidi", email: "ahmed@gulfindustrial.ae", role: "COMPANY_ADMIN", department: "Management", status: "ACTIVE" },
  { id: "u2", name: "Fatima Hassan", email: "fatima@gulfindustrial.ae", role: "COMPANY_BUYER", department: "Medical", status: "ACTIVE" },
  { id: "u3", name: "Khalid Omar", email: "khalid@gulfindustrial.ae", role: "COMPANY_BUYER", department: "Operations", status: "ACTIVE" },
  { id: "u4", name: "Nora Al-Sayed", email: "nora@gulfindustrial.ae", role: "COMPANY_APPROVER", department: "Finance", status: "ACTIVE" },
];

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  COMPANY_ADMIN:    { label: "Admin",    color: "bg-purple-500/15 text-purple-500 dark:text-purple-400" },
  COMPANY_BUYER:    { label: "Buyer",    color: "bg-primary/15 text-primary" },
  COMPANY_APPROVER: { label: "Approver", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
};

export default function CompanyProfilePage() {
  const c = MOCK_B2B_COMPANY;

  return (
    <B2BShell>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/b2b" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to B2B Dashboard
        </Link>

        {/* Header */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-xl font-bold">{c.nameEn}</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary">{c.status}</span>
                </div>
                <p className="text-muted-foreground text-sm" dir="rtl">{c.nameAr}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.city}, {c.country}</span>
                  <span>CR: {c.crNumber}</span>
                  <span>VAT: {c.vatNumber}</span>
                  <span className="capitalize">{c.industry.replace(/_/g, " ").toLowerCase()} · {c.size}</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0">
              <Edit className="h-3.5 w-3.5 me-1.5" /> Edit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: details */}
          <div className="lg:col-span-2 space-y-5">
            {/* Contact */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="font-semibold mb-4 text-foreground">Contact Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  { icon: Mail, label: "Email", value: "procurement@gulfindustrial.ae" },
                  { icon: Phone, label: "Phone", value: "+971 4 234 5678" },
                  { icon: Globe, label: "Website", value: "www.gulfindustrial.ae" },
                  { icon: MapPin, label: "Address", value: "Al Quoz Industrial Area, Dubai, UAE" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="font-medium text-foreground">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-foreground">Team Members</h2>
                  <span className="text-xs text-muted-foreground">({COMPANY_USERS.length})</span>
                </div>
                <button type="button" className="text-xs text-primary hover:underline font-medium">+ Invite User</button>
              </div>
              <div className="divide-y divide-border">
                {COMPANY_USERS.map((user) => {
                  const rc = ROLE_CONFIG[user.role] ?? { label: user.role, color: "bg-muted text-muted-foreground" };
                  return (
                    <div key={user.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email} · {user.department}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rc.color}`}>{rc.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: financial */}
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Credit & Payments</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit Limit</span>
                  <span className="font-bold">AED {c.creditLimit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Terms</span>
                  <span className="font-bold">Net {c.paymentTerms} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-bold">AED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overdue Balance</span>
                  <span className="font-bold text-primary">None</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Trade Documents</h3>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { name: "Commercial Registration", status: "Valid" },
                  { name: "VAT Certificate", status: "Valid" },
                  { name: "Trade License", status: "Expiring Soon" },
                ].map((doc) => (
                  <div key={doc.name} className="flex justify-between">
                    <span className="text-muted-foreground text-xs">{doc.name}</span>
                    <span className={`text-xs font-medium ${doc.status === "Valid" ? "text-primary" : "text-amber-600"}`}>{doc.status}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-3 text-xs text-primary hover:underline w-full text-center font-medium">Manage Documents →</button>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-sm text-foreground">
              <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1">Account Manager</p>
              <p className="text-muted-foreground font-medium">Sara Al-Ahmed</p>
              <p className="text-muted-foreground text-xs">sara@avenick.com</p>
              <p className="text-muted-foreground text-xs">+971 50 123 4567</p>
            </div>
          </div>
        </div>
      </div>
    </B2BShell>
  );
}
