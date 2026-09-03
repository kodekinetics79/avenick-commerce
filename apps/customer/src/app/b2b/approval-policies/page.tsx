import Link from "next/link";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { SelectField, TextField } from "@/components/b2b/controls";
import { Button, Dateline, EmptyState, Eyebrow, Field, StatusPill, Surface } from "@avenick/ui";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { getB2BT, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey } from "@/components/b2b/messages";
import { toneRule } from "@/components/b2b/rules";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { createPolicy, togglePolicy } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { ShieldCheck } from "lucide-react";

export async function generateMetadata() {
  return b2bMetadata("policies.title");
}

const ROLE_LABEL: Record<string, B2BKey> = {
  COMPANY_ADMIN: "policies.role.admin",
  COMPANY_APPROVER: "policies.role.approver",
};

export default async function ApprovalPoliciesPage() {
  const t = await getB2BT();
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title={t("policies.title")}>
        <EmptyState
          variant="certificate"
          glyph={<ShieldCheck />}
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

  const policies = await db.approvalPolicy.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { thresholdAmount: "asc" },
  });
  const isAdmin = ctx.member.role === "COMPANY_ADMIN";
  const companyCurrency = companyCurrencyForCountry(ctx.company.country);

  return (
    <B2BShell
      workspace={ctx.company.nameEn}
      eyebrow={t("policies.eyebrow")}
      title={t("policies.title")}
      description={t("policies.description")}
    >
      <div className="space-y-block">
        {isAdmin && (
          <ValidatedForm action={createPolicy} rung={1} className="p-5">
            <Eyebrow className="mb-4 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t("policies.new")}
            </Eyebrow>
            <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t("policies.field.name")} htmlFor="policy-name" required className="lg:col-span-2">
                <TextField id="policy-name" name="name" required placeholder={t("policies.field.name.placeholder")} />
              </Field>
              <Field
                label={t("policies.field.threshold", { currency: companyCurrency })}
                htmlFor="policy-threshold"
                required
              >
                <TextField id="policy-threshold" name="threshold" type="number" required min="0" />
              </Field>
              <Field label={t("policies.field.approver")} htmlFor="policy-approver">
                <SelectField id="policy-approver" name="approverRole" defaultValue="COMPANY_APPROVER">
                  <option value="COMPANY_APPROVER">{t("policies.approver.approver")}</option>
                  <option value="COMPANY_ADMIN">{t("policies.approver.admin")}</option>
                </SelectField>
              </Field>
            </div>
            <Button type="submit" variant="primary">{t("policies.submit")}</Button>
          </ValidatedForm>
        )}

        {policies.length === 0 ? (
          // The one certificate on this page — and the sentence it carries is
          // the whole reason the page exists: with no threshold on file, every
          // purchase order this company raises can be placed unreviewed.
          <EmptyState
            variant="certificate"
            glyph={<ShieldCheck />}
            eyebrow={t("policies.empty.eyebrow")}
            headline={t("policies.empty.headline")}
            body={t("policies.empty.body")}
            action={
              <Button asChild variant="secondary">
                <Link href="/b2b/team">{t("policies.empty.action")}</Link>
              </Button>
            }
          />
        ) : (
          /* THE LADDER. Ordered by threshold ascending, so it reads bottom-up
             the way a procurement manager describes it: "anything over X goes
             to an approver, anything over Y goes to an admin." The threshold is
             a FIGURE and gets a figure's rank rather than being dropped inline
             into a 12px sentence, where a 20px numeral breaks the line box and
             outweighs the policy it belongs to. */
          <Surface rung={2} className="overflow-hidden">
            <ul>
              {policies.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 last:border-b-0 ${toneRule(p.isActive ? "success" : "neutral")}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-neutral-soft text-ink-2">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="u-ui truncate font-medium text-ink-1">{p.name}</p>
                      <p className="u-meta text-ink-2">
                        {t("policies.requiredAbove", {
                          role: ROLE_LABEL[p.approverRole] ? t(ROLE_LABEL[p.approverRole]!) : t("policies.role.approver"),
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <Money amount={Number(p.thresholdAmount)} currency={p.currency} rank="card" />
                    <StatusPill tone={p.isActive ? "success" : "neutral"} dot>
                      {p.isActive ? t("policies.active") : t("policies.off")}
                    </StatusPill>
                    {isAdmin && (
                      <form action={togglePolicy.bind(null, p.id, !p.isActive)}>
                        <Button type="submit" variant="ghost" size="xs" className="text-primary-ink hover:text-primary-ink">
                          {p.isActive ? t("policies.disable") : t("policies.enable")}
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Surface>
        )}
        <Dateline>{t("policies.basis")}</Dateline>
      </div>
    </B2BShell>
  );
}
