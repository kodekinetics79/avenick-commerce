import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { createPolicy, togglePolicy } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { CheckSquare, ShieldCheck, Building2 } from "lucide-react";

export const metadata = { title: "Approval Policies — Avenick for Business" };

const ROLE_LABEL: Record<string, string> = {
  COMPANY_ADMIN: "Admin",
  COMPANY_APPROVER: "Approver",
};

export default async function ApprovalPoliciesPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Approval Policies">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No company account</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in with a company account to configure approvals.</p>
        </div>
      </B2BShell>
    );
  }

  const policies = await db.approvalPolicy.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { thresholdAmount: "asc" },
  });
  const isAdmin = ctx.member.role === "COMPANY_ADMIN";
  const companyCurrency = companyCurrencyForCountry(ctx.company.country);

  return (
    <B2BShell
      title="Approval Policies"
      description="Require sign-off when an order exceeds a spend threshold."
    >
      {isAdmin && (
        <ValidatedForm action={createPolicy} className="rounded-2xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-4"><ShieldCheck className="h-4 w-4 text-primary" /> New policy</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <input name="name" required placeholder="Policy name (e.g. High-value orders)" className="lg:col-span-2 h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <input name="threshold" type="number" required placeholder={`Threshold (${companyCurrency})`} className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <div className="flex gap-2">
              <select name="approverRole" aria-label="Approver role" className="flex-1 h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="COMPANY_APPROVER">Approver signs off</option>
                <option value="COMPANY_ADMIN">Admin signs off</option>
              </select>
              <button type="submit" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">Add</button>
            </div>
          </div>
        </ValidatedForm>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {policies.length === 0 ? (
          <div className="p-10 text-center">
            <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No approval policies yet</p>
            <p className="text-sm text-muted-foreground mt-1">Orders won&apos;t require sign-off until you add a threshold.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {policies.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0"><ShieldCheck className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Orders over <span className="font-mono font-medium text-foreground">{formatCurrency(Number(p.thresholdAmount), p.currency)}</span> · {ROLE_LABEL[p.approverRole] ?? "Approver"} approval
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-semibold ${p.isActive ? "text-success" : "text-muted-foreground"}`}>{p.isActive ? "Active" : "Off"}</span>
                  {isAdmin && (
                    <form action={togglePolicy.bind(null, p.id, !p.isActive)}>
                      <button type="submit" className="text-xs font-medium text-primary hover:underline">{p.isActive ? "Disable" : "Enable"}</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </B2BShell>
  );
}
