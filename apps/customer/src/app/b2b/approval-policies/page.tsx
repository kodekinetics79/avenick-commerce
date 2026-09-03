import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { SelectField, TextField } from "@/components/b2b/controls";
import { Button, Dateline, EmptyState, Eyebrow, Field, StatusPill, Surface } from "@avenick/ui";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { createPolicy, togglePolicy } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { ShieldCheck } from "lucide-react";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = { title: `Approval Policies — ${platformName()} for Business` };

const ROLE_LABEL: Record<string, string> = {
  COMPANY_ADMIN: "Admin",
  COMPANY_APPROVER: "Approver",
};

export default async function ApprovalPoliciesPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Approval Policies">
        <Surface rung={2}>
          <EmptyState
            eyebrow="No company context"
            headline="This session is not attached to a company account."
            body="Approval thresholds are configured per company. Sign in with a company account to change them."
          />
        </Surface>
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
      eyebrow="Administration"
      title="Approval Policies"
      description="Require sign-off when an order exceeds a spend threshold."
    >
      <div className="space-y-block">
        {isAdmin && (
          <ValidatedForm action={createPolicy} rung={1} className="p-5">
            <Eyebrow className="mb-4 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> New policy
            </Eyebrow>
            <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Policy name" htmlFor="policy-name" required className="lg:col-span-2">
                <TextField id="policy-name" name="name" required placeholder="e.g. High-value orders" />
              </Field>
              <Field label={`Threshold (${companyCurrency})`} htmlFor="policy-threshold" required>
                <TextField id="policy-threshold" name="threshold" type="number" required min="0" />
              </Field>
              <Field label="Who signs off" htmlFor="policy-approver">
                <SelectField id="policy-approver" name="approverRole" defaultValue="COMPANY_APPROVER">
                  <option value="COMPANY_APPROVER">Approver signs off</option>
                  <option value="COMPANY_ADMIN">Admin signs off</option>
                </SelectField>
              </Field>
            </div>
            <Button type="submit" variant="primary">Add policy</Button>
          </ValidatedForm>
        )}

        {policies.length === 0 ? (
          <Surface rung={2}>
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No approval policy is configured for this company."
              body="Until a threshold exists, every purchase order this company raises can be placed without a second pair of eyes."
            />
          </Surface>
        ) : (
          <Surface rung={2} className="overflow-hidden">
            <ul>
              {policies.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-neutral-soft text-ink-2">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="u-ui truncate font-medium text-ink-1">{p.name}</p>
                      {/* The threshold is a figure, so it gets a figure's own
                          baseline rather than being dropped inline into a 12px
                          sentence, where a 20px numeral breaks the line box and
                          outweighs the policy it belongs to. */}
                      <p className="u-meta text-ink-2">
                        {ROLE_LABEL[p.approverRole] ?? "Approver"} approval required above
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Money amount={Number(p.thresholdAmount)} currency={p.currency} />
                    <StatusPill tone={p.isActive ? "success" : "neutral"} dot>
                      {p.isActive ? "Active" : "Off"}
                    </StatusPill>
                    {isAdmin && (
                      <form action={togglePolicy.bind(null, p.id, !p.isActive)}>
                        <Button type="submit" variant="ghost" size="xs" className="text-primary-ink hover:text-primary-ink">
                          {p.isActive ? "Disable" : "Enable"}
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Surface>
        )}
        <Dateline>
          Thresholds are recorded in the currency each policy stores · a PO is routed by the policy whose threshold it
          crosses
        </Dateline>
      </div>
    </B2BShell>
  );
}
