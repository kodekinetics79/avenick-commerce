import { B2BShell } from "@/components/b2b/b2b-shell";
import { Button, EmptyState, Eyebrow, Field, StatusPill, Surface } from "@avenick/ui";
import { SelectField, TextField } from "@/components/b2b/controls";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { createAddress, setDefaultAddress, deleteAddress } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { MapPin, Plus, Star } from "lucide-react";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = { title: `Delivery Sites — ${platformName()} for Business` };

const COUNTRY_LABEL: Record<string, string> = { AE: "UAE", SA: "Saudi Arabia", QA: "Qatar", KW: "Kuwait", OM: "Oman", BH: "Bahrain" };

export default async function AddressesPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Delivery Sites">
        <Surface rung={2}>
          <EmptyState
            eyebrow="No company context"
            headline="This session is not attached to a company account."
            body="Delivery sites are recorded against a company. Sign in with a company account to manage them."
          />
        </Surface>
      </B2BShell>
    );
  }

  const addresses = await db.address.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });
  const isAdmin = ctx.member.role === "COMPANY_ADMIN";

  return (
    <B2BShell
      eyebrow="Administration"
      title="Delivery Sites"
      description="Manage the locations orders can be shipped to across your organization."
    >
      <div className="space-y-block">
        {isAdmin && (
          <ValidatedForm action={createAddress} rung={1} className="p-5">
            <Eyebrow className="mb-4 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add a site
            </Eyebrow>
            {/* Every control here used to be a placeholder with no label, so a
                half-filled form gave no way to tell which box was which. */}
            <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Site name" htmlFor="site-label" required>
                <TextField id="site-label" name="label" required placeholder="e.g. Main warehouse" />
              </Field>
              <Field label="Address line 1" htmlFor="site-line1" required>
                <TextField id="site-line1" name="line1" required autoComplete="address-line1" />
              </Field>
              <Field label="Address line 2" htmlFor="site-line2" hint="Optional.">
                <TextField id="site-line2" name="line2" autoComplete="address-line2" />
              </Field>
              <Field label="City" htmlFor="site-city" required>
                <TextField id="site-city" name="city" required autoComplete="address-level2" />
              </Field>
              <Field label="Country" htmlFor="site-country">
                <SelectField id="site-country" name="country">
                  {Object.entries(COUNTRY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </SelectField>
              </Field>
              <Field label="Postal code" htmlFor="site-postal" hint="Optional.">
                <TextField id="site-postal" name="postalCode" autoComplete="postal-code" />
              </Field>
            </div>
            <Button type="submit" variant="primary">Add site</Button>
          </ValidatedForm>
        )}

        {addresses.length === 0 ? (
          <Surface rung={2}>
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No delivery site has been added for this company."
              body="An order ships to a recorded site, so at least one is needed before an order can be placed."
            />
          </Surface>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <Surface key={a.id} rung={2} tone={a.isDefault ? "accent" : "default"} className="p-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-neutral-soft text-ink-2">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="u-h3 truncate text-ink-1">{a.label}</h2>
                    <p className="u-meta text-ink-3">{COUNTRY_LABEL[a.country] ?? a.country}</p>
                  </div>
                  {a.isDefault && (
                    <StatusPill tone="accent" className="ms-auto shrink-0">
                      <Star className="h-3 w-3 fill-current" aria-hidden="true" /> Default
                    </StatusPill>
                  )}
                </div>
                <p className="u-ui mt-3 text-ink-2">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}
                  <br />
                  {a.city}
                  {a.postalCode ? ` ${a.postalCode}` : ""}
                </p>
                {isAdmin && (
                  <div className="mt-4 flex items-center gap-2 border-t border-hairline pt-3">
                    {!a.isDefault && (
                      <form action={setDefaultAddress.bind(null, a.id)}>
                        <Button type="submit" variant="ghost" size="xs" className="text-primary-ink hover:text-primary-ink">
                          Set as default
                        </Button>
                      </form>
                    )}
                    <form action={deleteAddress.bind(null, a.id)} className="ms-auto">
                      <Button type="submit" variant="ghost" size="xs" className="hover:text-danger-ink">
                        Remove
                      </Button>
                    </form>
                  </div>
                )}
              </Surface>
            ))}
          </div>
        )}
      </div>
    </B2BShell>
  );
}
