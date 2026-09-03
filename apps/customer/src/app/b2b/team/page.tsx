import Link from "next/link";
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
import { getB2BT, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey } from "@/components/b2b/messages";
import { toneRule } from "@/components/b2b/rules";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { inviteMember, setMemberActive } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { Shield, ShoppingBag, CheckSquare, UserPlus, Users } from "lucide-react";

export async function generateMetadata() {
  return b2bMetadata("team.title");
}

const ROLES: Record<string, { labelKey: B2BKey; descKey: B2BKey; tone: PillTone; icon: typeof Shield }> = {
  COMPANY_ADMIN: { labelKey: "team.role.admin", descKey: "team.role.admin.desc", tone: "accent", icon: Shield },
  COMPANY_APPROVER: { labelKey: "team.role.approver", descKey: "team.role.approver.desc", tone: "warning", icon: CheckSquare },
  COMPANY_BUYER: { labelKey: "team.role.buyer", descKey: "team.role.buyer.desc", tone: "primary", icon: ShoppingBag },
};

export default async function B2BTeamPage() {
  const t = await getB2BT();
  const ctx = await getB2BContext();

  if (!ctx) {
    return (
      <B2BShell title={t("team.title")}>
        <EmptyState
          variant="certificate"
          glyph={<Users />}
          eyebrow={t("common.noCompany.eyebrow")}
          headline={t("common.noCompany.headline")}
          body={t("common.noCompany.body")}
          action={
            <Button asChild variant="primary">
              <Link href="/b2b/register">{t("common.noCompany.action")}</Link>
            </Button>
          }
        />
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
      workspace={ctx.company.nameEn}
      eyebrow={t("team.eyebrow")}
      title={t("team.title")}
      description={t("team.description", { company: ctx.company.nameEn })}
    >
      <div className="space-y-block">
        {/* Role legend. One panel divided by hairlines: three roles, three
            tones, and no fourth colour invented to fill a slot. */}
        <CellGrid cols={{ base: 1, sm: 3 }}>
          {Object.values(ROLES).map((r) => (
            <div key={r.labelKey}>
              <StatusPill tone={r.tone}>
                <r.icon className="h-3.5 w-3.5" aria-hidden="true" /> {t(r.labelKey)}
              </StatusPill>
              <p className="u-meta mt-2 text-ink-2">{t(r.descKey)}</p>
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
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> {t("team.invite")}
            </Eyebrow>
            <div className="grid items-start gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t("team.invite.name")} htmlFor="invite-name" required>
                <TextField id="invite-name" name="name" required autoComplete="name" />
              </Field>
              <Field label={t("team.invite.email")} htmlFor="invite-email" required>
                <TextField id="invite-email" name="email" type="email" required autoComplete="email" />
              </Field>
              <Field label={t("team.invite.role")} htmlFor="invite-role">
                <SelectField id="invite-role" name="role" defaultValue="COMPANY_BUYER">
                  <option value="COMPANY_BUYER">{t("team.role.buyer")}</option>
                  <option value="COMPANY_APPROVER">{t("team.role.approver")}</option>
                  <option value="COMPANY_ADMIN">{t("team.role.admin")}</option>
                </SelectField>
              </Field>
              <Field
                label={t("team.invite.spendLimit", { currency })}
                htmlFor="invite-spend-limit"
                hint={t("team.invite.spendLimit.hint")}
              >
                <TextField id="invite-spend-limit" name="spendLimit" type="number" min="0" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Dateline>{t("team.invite.basis")}</Dateline>
              <Button type="submit" variant="primary">{t("team.invite.submit")}</Button>
            </div>
          </ValidatedForm>
        )}

        <LedgerTable
          title={t("team.members")}
          dateline={t("team.members.basis", { currency })}
          rows={members}
          getRowKey={(m) => m.id}
          // Whose access is live. The pill says it in words at the end of the
          // row; the rule says it at the start, where the eye enters — the same
          // three pixels as every other queue in the buyer suite.
          rowProps={(m) => ({
            className: toneRule(m.isActive && m.user.status !== "SUSPENDED" ? "success" : "neutral"),
          })}
          columns={[
            {
              key: "member",
              label: t("team.col.member"),
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
                        {m.userId === ctx.userId && <span className="u-meta ms-1.5 text-ink-3">{t("common.you")}</span>}
                      </p>
                      <p className="u-meta truncate text-ink-3">{m.user.email}</p>
                    </div>
                  </div>
                );
              },
            },
            {
              key: "role",
              label: t("team.col.role"),
              render: (m) => {
                const role = ROLES[m.role] ?? ROLES.COMPANY_BUYER!;
                return (
                  <StatusPill tone={role.tone} className="whitespace-nowrap">
                    <role.icon className="h-3 w-3" aria-hidden="true" /> {t(role.labelKey)}
                  </StatusPill>
                );
              },
            },
            {
              key: "department",
              label: t("common.department"),
              hideOnMobile: true,
              render: (m) => (
                <span className={m.department ? "text-ink-2" : "u-meta text-ink-3"}>
                  {m.department ?? t("common.unassigned")}
                </span>
              ),
            },
            {
              key: "spendLimit",
              label: t("team.col.spendLimit"),
              numeric: true,
              render: (m) =>
                m.spendLimit ? (
                  <Money amount={Number(m.spendLimit)} currency={currency} />
                ) : (
                  <span className="u-meta text-ink-3">{t("common.unlimited")}</span>
                ),
            },
            {
              key: "status",
              label: t("common.status"),
              render: (m) => {
                const active = m.isActive && m.user.status !== "SUSPENDED";
                return (
                  <StatusPill tone={active ? "success" : "neutral"} dot>
                    {m.user.status === "PENDING"
                      ? t("team.status.invited")
                      : active
                        ? t("team.status.active")
                        : t("team.status.suspended")}
                  </StatusPill>
                );
              },
            },
            {
              key: "actions",
              label: t("team.col.access"),
              align: "end",
              render: (m) => {
                const active = m.isActive && m.user.status !== "SUSPENDED";
                // The permission gate is unchanged: only an admin sees this,
                // and never against their own membership.
                if (!isAdmin || m.userId === ctx.userId) return <span className="u-meta text-ink-3">{t("common.none")}</span>;
                return (
                  <form action={setMemberActive.bind(null, m.id, !active)} className="flex justify-end">
                    <Button
                      type="submit"
                      variant="ghost"
                      size="xs"
                      className={active ? "hover:text-danger-ink" : "text-primary-ink"}
                    >
                      {active ? t("team.suspend") : t("team.reactivate")}
                    </Button>
                  </form>
                );
              },
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("team.empty.eyebrow")}
              headline={t("team.empty.headline")}
              body={t("team.empty.body")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/b2b/approval-policies">{t("team.empty.action")}</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </B2BShell>
  );
}
