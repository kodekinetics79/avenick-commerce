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
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey } from "@/components/b2b/messages";
import { toneRule } from "@/components/b2b/rules";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { inviteMember, resendInvite, setMemberActive } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { CheckCircle2, Eye, Shield, ShoppingBag, CheckSquare, UserPlus, Users, XCircle } from "lucide-react";

export async function generateMetadata() {
  return b2bMetadata("team.title");
}

/**
 * What each role may do, and what it may not.
 *
 * Both sentences are read off the server's own gates rather than off an
 * intention, because an administrator picking a role from a dropdown is
 * granting authority and had nothing on this screen telling them what they were
 * granting:
 *
 *  - COMPANY_ADMIN is the only role admitted by inviteMember, updateMember and
 *    setMemberActive (./actions.ts), by createPolicy and togglePolicy
 *    (../approval-policies/actions.ts:14,37) and by createAddress,
 *    setDefaultAddress and deleteAddress (../addresses/actions.ts:13,43,57).
 *  - Approval is decided in api/b2b/purchase-orders/[id]/route.ts:44-52: an
 *    admin approves whatever the governing policy names, an approver approves
 *    where the policy names their role or where no policy governs the amount,
 *    and a buyer never approves at all.
 *  - The spend limit binds the person placing the order, and an approver is
 *    exempt from it (same file, :86-91).
 *  - Nobody approves their own purchase order while another approver exists —
 *    including an admin (:60-74). That is the one limit that binds all three,
 *    so it is stated against the role that would otherwise look unlimited.
 */
const ROLES: Record<
  string,
  { labelKey: B2BKey; descKey: B2BKey; cannotKey: B2BKey; tone: PillTone; icon: typeof Shield }
> = {
  COMPANY_ADMIN: {
    labelKey: "team.role.admin",
    descKey: "team.role.admin.desc",
    cannotKey: "team.role.admin.cannot",
    tone: "accent",
    icon: Shield,
  },
  COMPANY_APPROVER: {
    labelKey: "team.role.approver",
    descKey: "team.role.approver.desc",
    cannotKey: "team.role.approver.cannot",
    tone: "warning",
    icon: CheckSquare,
  },
  COMPANY_BUYER: {
    labelKey: "team.role.buyer",
    descKey: "team.role.buyer.desc",
    cannotKey: "team.role.buyer.cannot",
    tone: "primary",
    icon: ShoppingBag,
  },
};

/**
 * The outcomes `resendInvite` reports through the query string.
 *
 * A code, never a sentence: the action runs before the page and has no locale,
 * so the wording is chosen here. Only a code in this map renders anything —
 * `?invite=<anything you like>` would otherwise paint a stranger's text inside
 * this product's own receipt, which is a phishing surface wearing our chrome.
 */
const INVITE_OUTCOME: Record<string, { key: B2BKey; ok: boolean }> = {
  sent: { key: "team.resend.sent", ok: true },
  notSent: { key: "team.resend.notSent", ok: false },
  notOpen: { key: "team.resend.notOpen", ok: false },
  accepted: { key: "team.resend.accepted", ok: false },
  notPending: { key: "team.resend.notPending", ok: false },
  notFound: { key: "team.resend.notFound", ok: false },
  adminOnly: { key: "act.team.adminOnly", ok: false },
};

export default async function B2BTeamPage({
  searchParams,
}: {
  searchParams?: { invite?: string };
}) {
  const { t, f } = await getB2B();
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
    // status is what separates a colleague who is IN from one who was posted an
    // invitation and has never had a credential. passwordHash decides that fact
    // on the server (see resendInvite) and is deliberately not selected into a
    // rendered page.
    include: { user: { select: { firstName: true, lastName: true, email: true, status: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const isAdmin = ctx.member.role === "COMPANY_ADMIN";
  // CompanyMember.spendLimit has no currency column; like the credit limit it
  // is read in the company's jurisdiction currency.
  const currency = companyCurrencyForCountry(ctx.company.country);
  const outcome = searchParams?.invite ? INVITE_OUTCOME[searchParams.invite] : undefined;
  const pendingCount = members.filter((m) => m.user.status === "PENDING" && m.isActive).length;

  return (
    <B2BShell
      workspace={ctx.company.nameEn}
      eyebrow={t("team.eyebrow")}
      title={t("team.title")}
      description={t("team.description", { company: ctx.company.nameEn })}
      // The company's own record of this reader's authority, so the sidebar can
      // mark what they may read but not change rather than promising eleven
      // equally workable destinations.
      role={ctx.member.role}
    >
      <div className="space-y-block">
        {outcome && (
          /* The same commit gesture the purchase-order banner uses — a receipt,
             not a toast. It is rendered here rather than through
             <ActionBanner> because that component's code tables live in a file
             this change does not own, and a second source of truth for one
             screen's outcomes is worse than fifteen lines. */
          <Surface
            rung={2}
            role={outcome.ok ? "status" : "alert"}
            aria-live={outcome.ok ? "polite" : undefined}
            data-commit={outcome.ok ? "committed" : "failed"}
            className="u-commit u-pop flex items-start gap-3 overflow-hidden border-s-[3px] px-4 py-3"
          >
            {outcome.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
            )}
            <p className="u-ui text-ink-1">{t(outcome.key)}</p>
          </Surface>
        )}

        {/* A reader who cannot change anything on this page is told so once, at
            the top, instead of discovering it control by control. The gate
            itself is in ./actions.ts and stays there — this only reports it. */}
        {!isAdmin && (
          <Surface rung={1} tone="accent" className="flex items-start gap-2 p-3">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <p className="u-ui text-ink-1">{t("team.readOnly")}</p>
          </Surface>
        )}

        {/* Role legend. One panel divided by hairlines: three roles, three
            tones, and no fourth colour invented to fill a slot. Each cell now
            states what the role may NOT do as well, because an administrator
            assigning one was choosing between three words and a colour. */}
        <div className="space-y-3">
          <Eyebrow>{t("team.roles")}</Eyebrow>
          <CellGrid cols={{ base: 1, sm: 3 }}>
            {Object.values(ROLES).map((r) => (
              <div key={r.labelKey}>
                <StatusPill tone={r.tone}>
                  <r.icon className="h-3.5 w-3.5" aria-hidden="true" /> {t(r.labelKey)}
                </StatusPill>
                <p className="u-meta mt-2 text-ink-2">{t(r.descKey)}</p>
                <p className="u-meta mt-1.5 text-ink-3">{t(r.cannotKey)}</p>
              </div>
            ))}
          </CellGrid>
          <Dateline>{t("team.roles.basis")}</Dateline>
        </div>

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
          // Two facts, not one: what the money column means, and how many of
          // these rows are people who cannot sign in yet. An outstanding
          // invitation was previously indistinguishable from a colleague at
          // their desk — both rendered a green rule and a pill.
          dateline={
            pendingCount > 0
              ? `${t("team.members.basis", { currency })} · ${
                  pendingCount === 1
                    ? t("team.members.pending.one")
                    : t("team.members.pending.other", { count: pendingCount })
                }`
              : t("team.members.basis", { currency })
          }
          rows={members}
          getRowKey={(m) => m.id}
          // Whose access is live. The pill says it in words at the end of the
          // row; the rule says it at the start, where the eye enters — the same
          // three pixels as every other queue in the buyer suite. An invitation
          // is HELD rather than settled, so it carries the held rule, which is
          // the mark this suite already uses for a purchase order awaiting a
          // decision.
          rowProps={(m) => ({
            className: toneRule(
              !m.isActive || m.user.status === "SUSPENDED"
                ? "neutral"
                : m.user.status === "PENDING"
                  ? "warning"
                  : "success",
            ),
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
              key: "since",
              label: t("team.col.since"),
              hideOnMobile: true,
              // joinedAt is written when the CompanyMember row is created, which
              // for an invited colleague is the moment the invitation was
              // raised — so on a pending row it is the age of the invitation,
              // and saying how long ago it was is the whole point of showing it.
              render: (m) => (
                <div className="min-w-0">
                  <p className="text-ink-2">{f.date(m.joinedAt)}</p>
                  {m.user.status === "PENDING" && (
                    <p className="u-meta text-ink-3">{f.relative(m.joinedAt)}</p>
                  )}
                </div>
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
              // Four states, not two. "Invited" used to be painted with the
              // SUCCESS tone beside "Active", so an administrator reading down
              // the column could not tell who was at their desk from who had
              // never been able to sign in — and a revoked membership was
              // reported as "Suspended", which is a different fact about a
              // different record (User.status, set by the platform, not by this
              // company).
              render: (m) => {
                const revoked = !m.isActive;
                const suspended = m.user.status === "SUSPENDED";
                const pending = m.user.status === "PENDING";
                const tone: PillTone = revoked || suspended ? "neutral" : pending ? "warning" : "success";
                const label = revoked
                  ? t("team.status.revoked")
                  : suspended
                    ? t("team.status.suspended")
                    : pending
                      ? t("team.status.invited")
                      : t("team.status.active");
                return (
                  <div className="min-w-0">
                    <StatusPill tone={tone} dot>
                      {label}
                    </StatusPill>
                    {pending && !revoked && !suspended && (
                      <p className="u-meta mt-1 text-ink-3">{t("team.status.invited.hint")}</p>
                    )}
                  </div>
                );
              },
            },
            {
              key: "actions",
              label: t("team.col.access"),
              align: "end",
              render: (m) => {
                const revoked = !m.isActive;
                const suspended = m.user.status === "SUSPENDED";
                const active = !revoked && !suspended;
                // The permission gate is unchanged: only an admin sees this,
                // and never against their own membership.
                if (!isAdmin || m.userId === ctx.userId) return <span className="u-meta text-ink-3">{t("common.none")}</span>;
                // Resending is offered only where it can succeed, and the
                // action re-decides that for itself against the row as it is
                // when the form arrives — this page may be minutes old.
                const canResend = m.user.status === "PENDING" && !revoked;
                return (
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {canResend && (
                      <form action={resendInvite.bind(null, m.id)}>
                        <Button type="submit" variant="ghost" size="xs" className="text-primary-ink">
                          {t("team.resend")}
                        </Button>
                      </form>
                    )}
                    <form action={setMemberActive.bind(null, m.id, !active)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="xs"
                        className={active ? "hover:text-danger-ink" : "text-primary-ink"}
                      >
                        {active
                          ? m.user.status === "PENDING"
                            ? t("team.revoke")
                            : t("team.suspend")
                          : t("team.reactivate")}
                      </Button>
                    </form>
                  </div>
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
