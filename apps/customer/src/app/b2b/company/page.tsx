import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, MapPin, Users, CreditCard, FileText, ShieldCheck } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { getB2BContext } from "@/lib/b2b";
import { format } from "date-fns";
import { companyCurrencyForCountry } from "@/lib/company-currency";

export const metadata = { title: "Company Profile" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Verified & Active", color: "bg-green-100 text-green-700" },
  PENDING_VERIFICATION: { label: "Pending Verification", color: "bg-amber-100 text-amber-700" },
  SUSPENDED: { label: "Suspended", color: "bg-red-100 text-red-700" },
};

const ROLE_LABEL: Record<string, string> = {
  COMPANY_ADMIN: "Admin",
  COMPANY_BUYER: "Buyer",
  COMPANY_APPROVER: "Approver",
};

export default async function CompanyPage() {
  const ctx = await getB2BContext();
  if (!ctx) redirect("/b2b/register");

  const [company, orderAgg] = await Promise.all([
    db.company.findUnique({
      where: { id: ctx.companyId },
      include: {
        members: { orderBy: { joinedAt: "asc" } },
        addresses: true,
        _count: { select: { orders: true, purchaseOrders: true, rfqRequests: true } },
      },
    }),
    db.order.aggregate({
      where: { companyId: ctx.companyId, paymentStatus: "PAID", currency: companyCurrencyForCountry(ctx.company.country) },
      _sum: { total: true },
    }),
  ]);
  if (!company) redirect("/b2b/register");

  const memberUsers = await db.user.findMany({
    where: { id: { in: company.members.map((m) => m.userId) } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const userOf = (id: string) => memberUsers.find((u) => u.id === id);

  const statusCfg = STATUS_CONFIG[company.status] ?? STATUS_CONFIG["PENDING_VERIFICATION"]!;
  const currency = companyCurrencyForCountry(company.country);

  return (
    <B2BShell title="Company Profile" description="Your organization's registration, credit, and team.">
      <div className="space-y-5">
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Building2 className="h-7 w-7 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{company.nameEn}</h1>
                {company.nameAr && <p className="text-sm text-muted-foreground">{company.nameAr}</p>}
                <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {company.city}, {company.country} · member since {format(company.createdAt, "MMM yyyy")}
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusCfg.color}`}>
              <ShieldCheck className="h-3 w-3" /> {statusCfg.label}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: "CR number", value: company.crNumber ?? "—" },
              { label: "VAT number", value: company.vatNumber ?? "—" },
              { label: "Industry", value: company.industry.replace(/_/g, " ") },
              { label: "Company size", value: company.size.replace(/_/g, " ") },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm font-semibold mt-0.5 font-mono">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Credit limit", value: company.creditLimit ? formatCurrency(Number(company.creditLimit), currency) : "Not set", icon: CreditCard },
            { label: "Payment terms", value: company.paymentTerms > 0 ? `Net ${company.paymentTerms} days` : "Prepaid", icon: FileText },
            { label: "Lifetime spend", value: formatCurrency(Number(orderAgg._sum.total ?? 0), currency), icon: CreditCard },
            { label: "Orders / POs / RFQs", value: `${company._count.orders} / ${company._count.purchaseOrders} / ${company._count.rfqRequests}`, icon: FileText },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card rounded-2xl border border-border p-4">
                <Icon className="h-4 w-4 text-muted-foreground mb-2" />
                <p className="text-base font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Team ({company.members.length})
            </h2>
            <Link href="/b2b/team" className="text-xs text-primary hover:underline">Manage team →</Link>
          </div>
          <ul className="divide-y divide-border">
            {company.members.map((m) => {
              const u = userOf(m.userId);
              return (
                <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {u ? `${u.firstName} ${u.lastName}` : "Unknown member"}
                      {m.userId === ctx.userId && <span className="ms-1.5 text-[10px] text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u?.email ?? ""}{m.department ? ` · ${m.department}` : ""}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-muted-foreground shrink-0">
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {company.addresses.length > 0 && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" /> Addresses ({company.addresses.length})
              </h2>
              <Link href="/b2b/addresses" className="text-xs text-primary hover:underline">Manage addresses →</Link>
            </div>
            <ul className="divide-y divide-border">
              {company.addresses.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.country}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </B2BShell>
  );
}
