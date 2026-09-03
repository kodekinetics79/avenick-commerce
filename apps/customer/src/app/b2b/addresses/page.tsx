import Link from "next/link";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Button, EmptyState, Eyebrow, Field, StatusPill, Surface } from "@avenick/ui";
import { SelectField, TextField } from "@/components/b2b/controls";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { getB2BT, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey } from "@/components/b2b/messages";
import { createAddress, setDefaultAddress, deleteAddress } from "./actions";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { MapPin, Plus, Star } from "lucide-react";

export async function generateMetadata() {
  return b2bMetadata("sites.title");
}

/**
 * The markets this platform ships in, as message keys. A country name is a
 * user-visible string like any other, and "Saudi Arabia" printed on an Arabic
 * delivery-site card is the same defect as an English column heading.
 */
const COUNTRY_LABEL: Record<string, B2BKey> = {
  AE: "sites.country.AE",
  SA: "sites.country.SA",
  QA: "sites.country.QA",
  KW: "sites.country.KW",
  OM: "sites.country.OM",
  BH: "sites.country.BH",
};

export default async function AddressesPage() {
  const t = await getB2BT();
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title={t("sites.title")}>
        <EmptyState
          variant="certificate"
          glyph={<MapPin />}
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

  const addresses = await db.address.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });
  const isAdmin = ctx.member.role === "COMPANY_ADMIN";
  const countryName = (code: string) => (COUNTRY_LABEL[code] ? t(COUNTRY_LABEL[code]!) : code);

  return (
    <B2BShell
      workspace={ctx.company.nameEn}
      eyebrow={t("sites.eyebrow")}
      title={t("sites.title")}
      description={t("sites.description")}
    >
      <div className="space-y-block">
        {isAdmin && (
          <ValidatedForm action={createAddress} rung={1} className="p-5">
            <Eyebrow className="mb-4 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("sites.add")}
            </Eyebrow>
            {/* Every control here used to be a placeholder with no label, so a
                half-filled form gave no way to tell which box was which. */}
            <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("sites.field.label")} htmlFor="site-label" required>
                <TextField id="site-label" name="label" required placeholder={t("sites.field.label.placeholder")} />
              </Field>
              <Field label={t("sites.field.line1")} htmlFor="site-line1" required>
                <TextField id="site-line1" name="line1" required autoComplete="address-line1" />
              </Field>
              <Field label={t("sites.field.line2")} htmlFor="site-line2" hint={t("sites.field.optional")}>
                <TextField id="site-line2" name="line2" autoComplete="address-line2" />
              </Field>
              <Field label={t("sites.field.city")} htmlFor="site-city" required>
                <TextField id="site-city" name="city" required autoComplete="address-level2" />
              </Field>
              <Field label={t("sites.field.country")} htmlFor="site-country">
                <SelectField id="site-country" name="country">
                  {Object.keys(COUNTRY_LABEL).map((code) => (
                    <option key={code} value={code}>{countryName(code)}</option>
                  ))}
                </SelectField>
              </Field>
              <Field label={t("sites.field.postal")} htmlFor="site-postal" hint={t("sites.field.optional")}>
                <TextField id="site-postal" name="postalCode" autoComplete="postal-code" />
              </Field>
            </div>
            <Button type="submit" variant="primary">{t("sites.submit")}</Button>
          </ValidatedForm>
        )}

        {addresses.length === 0 ? (
          // The one certificate on this page.
          <EmptyState
            variant="certificate"
            glyph={<MapPin />}
            eyebrow={t("sites.empty.eyebrow")}
            headline={t("sites.empty.headline")}
            body={t("sites.empty.body")}
            action={
              <Button asChild variant="secondary">
                <Link href="/b2b/company">{t("sites.empty.action")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              // A CARD, not a queue row. The three-pixel rule is the mark for a
              // row in a table, where the eye enters at the inline start; on a
              // card it would replace the card's own edge on that side with a
              // transparent gap. The default site is marked the way a card is
              // marked — a tone on its fill and edge, plus the pill that names
              // it in words, because colour is never the only channel.
              <Surface key={a.id} rung={2} tone={a.isDefault ? "accent" : "default"} className="p-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-neutral-soft text-ink-2">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="u-h3 truncate text-ink-1">{a.label}</h2>
                    <p className="u-meta text-ink-3">{countryName(a.country)}</p>
                  </div>
                  {a.isDefault && (
                    <StatusPill tone="accent" className="ms-auto shrink-0">
                      <Star className="h-3 w-3 fill-current" aria-hidden="true" /> {t("sites.default")}
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
                          {t("sites.setDefault")}
                        </Button>
                      </form>
                    )}
                    <form action={deleteAddress.bind(null, a.id)} className="ms-auto">
                      <Button type="submit" variant="ghost" size="xs" className="hover:text-danger-ink">
                        {t("common.remove")}
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
