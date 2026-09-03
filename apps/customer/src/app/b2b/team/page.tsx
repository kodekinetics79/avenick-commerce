import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { SelectField, TextField } from "@/components/b2b/controls";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  Field,
  LedgerTable,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { platformName } from "@avenick/utils/portal-config";
import { inviteMember, setMemberActive } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { Shield, ShoppingBag, CheckSquare, UserPlus } from "lucide-react";

export const metadata = { title: `Team & Roles — ${platformName()} for Business` };

const ROLES: Record<string, { label: string; tone: PillTone; icon: typeof Shield; desc: string }> = {
  COMPANY_ADMIN: { label: "Admin", tone: "accent", icon: Shield, desc: "Full access — manage team, billing, approvals & ordering." },
  COMPANY_APPROVER: { label: "Approver", tone: "warning", icon: CheckSquare, desc: "Reviews and approves orders above buyers' spend limits." },
  COMPANY_BUYER: { label: "Buyer", tone: "primary", icon: ShoppingBag, desc: "Creates RFQs and orders within an assigned spend limit." },
};

export default async function B2BTeamPage() {
  const ctx = await getB2BContext();

  if (!ctx) {
    return (
      <B2BShell title="Team & Roles">
        <Surface rung={2}>
          <EmptyState
            eyebrow="No company context"
            headline="This session is not attached to a company account."
            body="Team membership and spend limits belong to a company. Sign in with a company account to manage them."
          />
        </Surface>
      </B2BShell>
    );
  }

  const members = await db.companyMember.findMany({
    where: { companyId: ctx.companyId },
    include: { user: { select: { firstName: true, lastName: true, email: true, status: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const isAdmin = ctx.member.role === "COMPANY_ADMIN";
  // CompanyMember.spendLimit has no currency column; like the credit limit it
  // is read in the company's jurisdiction currency.
  const currency = companyCurrencyForCountry(ctx.company.country);

  return (
    <B2BShell
      eyebrow="Administration"
      title="Team & Roles"
      description={`Manage who can buy on behalf of ${ctx.company.nameEn}.`}
    >
      <div className="space-y-block">
        {/* Role legend. One panel divided by hairlines: three roles, three
            tones, and no fourth colour invented to fill a slot. */}
        <CellGrid cols={{ base: 1, sm: 3 }}>
          {Object.values(ROLES).map((r) => (
            <div key={r.label}>
              <StatusPill tone={r.tone}>
                <r.icon className="h-3.5 w-3.5" aria-hidden="true" /> {r.label}
              </StatusPill>
              <p className="u-meta mt-2 text-ink-2">{r.desc}</p>
            </div>
          ))}
        </CellGrid>

        {/* Invite form (admins only). Recessed, because a form is the canonical
            recessed thing, with the one commit action raised on top of it.
            Every control now has a real associated label; before this they had
            placeholders only, which vanish the moment a value is typed. */}
        {isAdmin && (
          <ValidatedForm action={inviteMember} rung={1} className="p-5">
            <Eyebrow className="mb-4 flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Invite a member
            </Eyebrow>
            <div className="grid items-start gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Full name" htmlFor="invite-name" required>
                <TextField id="invite-name" name="name" required autoComplete="name" />
              </Field>
              <Field label="Work email" htmlFor="invite-email" required>
                <TextField id="invite-email" name="email" type="email" required autoComplete="email" />
              </Field>
              <Field label="Role" htmlFor="invite-role">
                <SelectField id="invite-role" name="role" defaultValue="COMPANY_BUYER">
                  <option value="COMPANY_BUYER">Buyer</option>
                  <option value="COMPANY_APPROVER">Approver</option>
                  <option value="COMPANY_ADMIN">Admin</option>
                </SelectField>
              </Field>
              <Field label={`Spend limit (${currency})`} htmlFor="invite-spend-limit" hint="Blank means unlimited.">
                <TextField id="invite-spend-limit" name="spendLimit" type="number" min="0" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Dateline>
                Department is optional · an invited member joins with a pending status until they set a password
              </Dateline>
              <Button type="submit" variant="primary">Send invite</Button>
            </div>
          </ValidatedForm>
        )}

        <LedgerTable
          title="Members"
          dateline={`Spend limits are recorded without a currency and read as ${currency}, your company's jurisdiction currency`}
          rows={members}
          getRowKey={(m) => m.id}
          columns={[
            {
              key: "member",
              label: "Member",
              render: (m) => {
                const name = `${m.user.firstName} ${m.user.lastName}`.trim();
                return (
                  <div className="flex min-w-0 items-center gap-3 py-1">
                    {/* Initials on a neutral plate. The indigo→verdigris
                        gradient disc this replaces was the only gradient on the
                        page and said nothing about the person. */}
                    <span className="u-meta grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-neutral-soft font-medium text-ink-2">
                      {name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-1">
                        {name}
                        {m.userId === ctx.userId && <span className="u-meta ms-1.5 text-ink-3">(you)</span>}
                      </p>
                      <p className="u-meta truncate text-ink-3">{m.user.email}</p>
                    </div>
                  </div>
                );
              },
            },
            {
              key: "role",
              label: "Role",
              render: (m) => {
                const role = ROLES[m.role] ?? ROLES.COMPANY_BUYER!;
                return (
                  <StatusPill tone={role.tone} className="whitespace-nowrap">
                    <role.icon className="h-3 w-3" aria-hidden="true" /> {role.label}
                  </StatusPill>
                );
              },
            },
            {
              key: "department",
              label: "Department",
              hideOnMobile: true,
              render: (m) => <span className="text-ink-2">{m.department ?? "Unassigned"}</span>,
            },
            {
              key: "spendLimit",
              label: "Spend limit",
              numeric: true,
              render: (m) =>
                m.spendLimit ? (
                  <Money amount={Number(m.spendLimit)} currency={currency} />
                ) : (
                  <span className="u-meta text-ink-3">Unlimited</span>
                ),
            },
            {
              key: "status",
              label: "Status",
              render: (m) => {
                const active = m.isActive && m.user.status !== "SUSPENDED";
                return (
                  <StatusPill tone={active ? "success" : "neutral"} dot>
                    {m.user.status === "PENDING" ? "Invited" : active ? "Active" : "Suspended"}
                  </StatusPill>
                );
              },
            },
            {
              key: "actions",
              label: "Access",
              align: "end",
              render: (m) => {
                const active = m.isActive && m.user.status !== "SUSPENDED";
                // The permission gate is unchanged: only an admin sees this,
                // and never against their own membership.
                if (!isAdmin || m.userId === ctx.userId) return <span className="u-meta text-ink-3">—</span>;
                return (
                  <form action={setMemberActive.bind(null, m.id, !active)} className="flex justify-end">
                    <Button
                      type="submit"
                      variant="ghost"
                      size="xs"
                      className={active ? "hover:text-danger-ink" : "text-primary-ink"}
                    >
                      {active ? "Suspend" : "Reactivate"}
                    </Button>
                  </form>
                );
              },
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="This company has no members yet."
              body="Invite a colleague above; they join with a pending status until they set a password."
            />
          }
        />
      </div>
    </B2BShell>
  );
}
