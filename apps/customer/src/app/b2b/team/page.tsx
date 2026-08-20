import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { inviteMember, setMemberActive } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { Shield, ShoppingBag, CheckSquare, UserPlus, Building2 } from "lucide-react";
import { companyCurrencyForCountry } from "@/lib/company-currency";

export const metadata = { title: "Team & Roles — Avenick for Business" };

const ROLES: Record<string, { label: string; cls: string; icon: typeof Shield; desc: string }> = {
  COMPANY_ADMIN: { label: "Admin", cls: "bg-accent/15 text-accent", icon: Shield, desc: "Full access — manage team, billing, approvals & ordering." },
  COMPANY_APPROVER: { label: "Approver", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: CheckSquare, desc: "Reviews and approves orders above buyers' spend limits." },
  COMPANY_BUYER: { label: "Buyer", cls: "bg-primary/15 text-primary", icon: ShoppingBag, desc: "Creates RFQs and orders within an assigned spend limit." },
};

export default async function B2BTeamPage() {
  const ctx = await getB2BContext();

  if (!ctx) {
    return (
      <B2BShell title="Team & Roles">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No company account</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in with a company account to manage your team.</p>
        </div>
      </B2BShell>
    );
  }

  const members = await db.companyMember.findMany({
    where: { companyId: ctx.companyId },
    include: { user: { select: { firstName: true, lastName: true, email: true, status: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const isAdmin = ctx.member.role === "COMPANY_ADMIN";
  const currency = companyCurrencyForCountry(ctx.company.country);

  return (
    <B2BShell
      title="Team & Roles"
      description={`Manage who can buy on behalf of ${ctx.company.nameEn}.`}
    >
      {/* Role legend */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {Object.values(ROLES).map((r) => (
          <div key={r.label} className="rounded-2xl border border-border bg-card p-4">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full ${r.cls}`}>
              <r.icon className="h-3.5 w-3.5" /> {r.label}
            </span>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Invite form (admins only) */}
      {isAdmin && (
        <ValidatedForm action={inviteMember} className="rounded-2xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-4"><UserPlus className="h-4 w-4 text-primary" /> Invite a member</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <input name="name" required placeholder="Full name" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <input name="email" type="email" required placeholder="Email" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <select name="role" aria-label="Role" className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="COMPANY_BUYER">Buyer</option>
              <option value="COMPANY_APPROVER">Approver</option>
              <option value="COMPANY_ADMIN">Admin</option>
            </select>
            <input name="spendLimit" type="number" min="0" placeholder={`Spend limit (${currency})`} aria-label={`Spend limit in ${currency}`} className="h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <button type="submit" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">Send invite</button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Department is optional — invited members join with a pending status until they set a password.</p>
        </ValidatedForm>
      )}

      {/* Members table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                {["Member", "Role", "Department", "Spend limit", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const role = ROLES[m.role] ?? ROLES.COMPANY_BUYER!;
                const active = m.isActive && m.user.status !== "SUSPENDED";
                const name = `${m.user.firstName} ${m.user.lastName}`.trim();
                return (
                  <tr key={m.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary-500 to-accent-600 text-white text-xs font-bold shrink-0">
                          {name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${role.cls}`}>
                        <role.icon className="h-3 w-3" /> {role.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.department ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">{m.spendLimit ? formatCurrency(Number(m.spendLimit), currency) : <span className="text-muted-foreground">Unlimited</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${active ? "text-success" : "text-muted-foreground"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-success" : "bg-muted-foreground"}`} />
                        {m.user.status === "PENDING" ? "Invited" : active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      {isAdmin && m.userId !== ctx.userId && (
                        <form action={setMemberActive.bind(null, m.id, !active)}>
                          <button type="submit" className={`text-xs font-medium ${active ? "text-muted-foreground hover:text-danger" : "text-primary hover:underline"}`}>
                            {active ? "Suspend" : "Reactivate"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </B2BShell>
  );
}
