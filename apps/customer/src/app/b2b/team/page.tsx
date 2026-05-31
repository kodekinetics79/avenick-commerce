import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { UserPlus, Shield, ShoppingBag, CheckSquare, MoreHorizontal, Mail } from "lucide-react";

export const metadata = { title: "Team & Roles — Avenick for Business" };

const MEMBERS = [
  { id: "u1", name: "Ahmed Al-Rashidi", email: "ahmed@gulfindustrial.ae", role: "ADMIN", department: "Management", spendLimit: null, status: "ACTIVE", lastActive: "Now" },
  { id: "u2", name: "Fatima Hassan", email: "fatima@gulfindustrial.ae", role: "BUYER", department: "Medical", spendLimit: 25000, status: "ACTIVE", lastActive: "2h ago" },
  { id: "u3", name: "Khalid Omar", email: "khalid@gulfindustrial.ae", role: "BUYER", department: "Operations", spendLimit: 50000, status: "ACTIVE", lastActive: "Yesterday" },
  { id: "u4", name: "Nora Al-Sayed", email: "nora@gulfindustrial.ae", role: "APPROVER", department: "Finance", spendLimit: null, status: "ACTIVE", lastActive: "3d ago" },
  { id: "u5", name: "Yousef Idris", email: "yousef@gulfindustrial.ae", role: "BUYER", department: "Facilities", spendLimit: 10000, status: "SUSPENDED", lastActive: "2w ago" },
];

const PENDING = [
  { email: "maryam@gulfindustrial.ae", role: "BUYER", invitedAgo: "1 day ago" },
];

const ROLES: Record<string, { label: string; cls: string; icon: typeof Shield; desc: string }> = {
  ADMIN: { label: "Admin", cls: "bg-accent/15 text-accent", icon: Shield, desc: "Full access — manage team, billing, approvals & ordering." },
  APPROVER: { label: "Approver", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: CheckSquare, desc: "Reviews and approves orders above buyers' spend limits." },
  BUYER: { label: "Buyer", cls: "bg-primary/15 text-primary", icon: ShoppingBag, desc: "Creates RFQs and orders within an assigned spend limit." },
};

export default function B2BTeamPage() {
  return (
    <B2BShell
      title="Team & Roles"
      description="Manage who can buy on behalf of your company, their roles and spend limits."
      actions={
        <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">
          <UserPlus className="h-4 w-4" /> Invite member
        </button>
      }
    >
      {/* Role legend */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {Object.entries(ROLES).map(([key, r]) => (
          <div key={key} className="rounded-2xl border border-border bg-card p-4">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full ${r.cls}`}>
              <r.icon className="h-3.5 w-3.5" /> {r.label}
            </span>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {PENDING.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-border text-sm font-semibold">Pending invites</div>
          {PENDING.map((p) => (
            <div key={p.email} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground"><Mail className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.email}</p>
                  <p className="text-xs text-muted-foreground">Invited {p.invitedAgo} · {ROLES[p.role]?.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs font-medium text-primary hover:underline">Resend</button>
                <button className="text-xs font-medium text-muted-foreground hover:text-danger">Revoke</button>
              </div>
            </div>
          ))}
        </div>
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
              {MEMBERS.map((m) => {
                const role = ROLES[m.role]!;
                return (
                  <tr key={m.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary-500 to-accent-600 text-white text-xs font-bold shrink-0">
                          {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{m.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${role.cls}`}>
                        <role.icon className="h-3 w-3" /> {role.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.department}</td>
                    <td className="px-4 py-3 font-mono">{m.spendLimit ? formatCurrency(m.spendLimit, "AED") : <span className="text-muted-foreground">Unlimited</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${m.status === "ACTIVE" ? "text-success" : "text-muted-foreground"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${m.status === "ACTIVE" ? "bg-success" : "bg-muted-foreground"}`} />
                        {m.status === "ACTIVE" ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" aria-label="Member actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
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
