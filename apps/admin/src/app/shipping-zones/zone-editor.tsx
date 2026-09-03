"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input, Surface } from "@avenick/ui";
import { createZoneAction } from "./actions";

/**
 * Add a zone. Deliberately small: the tariff is read far more often than it is
 * written, so the screen is a table first and a form second.
 *
 * The refusal is the interesting part. Creating a zone that claims a country
 * another active zone already covers is refused by the service, and the message
 * names every offending country and the zone holding it — so it is rendered
 * verbatim rather than replaced with a generic failure. An operator can act on
 * "AE is already covered by UAE_DOMESTIC"; they cannot act on "invalid input".
 */
/**
 * Field is a label/hint/error wrapper and Input is the control; pairing them at
 * every call site would bury the form's shape in boilerplate. The id is derived
 * from the name so the label's htmlFor always matches its control — a mismatch
 * is the commonest way a form ends up unlabelled for a screen reader.
 */
function Row({
  name, label, hint, required, ...input
}: { name: string; label: string; hint?: string; required?: boolean } & React.ComponentProps<typeof Input>) {
  const id = `zone-${name}`;
  return (
    <Field label={label} htmlFor={id} hint={hint} required={required}>
      <Input id={id} name={name} required={required} {...input} />
    </Field>
  );
}

export function ZoneEditor() {
  const t = useTranslations("adminCommerce");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    try {
      const result = await createZoneAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
    } catch {
      setError(t("actions.shipping.unreachable"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Surface rung={2} className="p-block">
      <h2 className="u-h3 mb-1 text-ink-1">{t("shipping.add.title")}</h2>
      <p className="u-meta mb-4 text-ink-2">{t("shipping.add.help")}</p>

      <form ref={formRef} action={submit} className="grid gap-3 sm:grid-cols-2">
        <Row name="code" label={t("shipping.field.code")} required placeholder="GCC_NEIGHBOURS" />
        <Row name="sortOrder" label={t("shipping.field.sortOrder")} type="number" defaultValue="0" />
        <Row name="nameEn" label={t("shipping.field.nameEn")} required />
        <Row name="nameAr" label={t("shipping.field.nameAr")} required dir="rtl" />
        <div className="sm:col-span-2">
          <Row
            name="countries"
            label={t("shipping.field.countries")}
            required
            placeholder="SA QA KW BH OM"
            hint={t("shipping.field.countriesHint")}
          />
        </div>
        <Row name="fallbackPrice" label={t("shipping.field.fallbackPrice")} type="number" step="0.01" defaultValue="0" hint={t("shipping.field.fallbackHint")} />
        <Row name="freeOverSubtotal" label={t("shipping.field.freeOver")} type="number" step="0.01" hint={t("shipping.field.freeOverHint")} />
        <Row name="etaMinDays" label={t("shipping.field.etaMin")} type="number" />
        <Row name="etaMaxDays" label={t("shipping.field.etaMax")} type="number" />

        <label className="u-ui flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="isActive" defaultChecked className="u-focus" />
          {t("shipping.field.isActive")}
        </label>

        {error && (
          <p role="alert" className="u-meta sm:col-span-2 rounded-nested border border-danger/30 bg-danger/10 px-3 py-2 text-danger-ink">
            {error}
          </p>
        )}

        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? t("shipping.add.saving") : t("shipping.add.submit")}
          </Button>
        </div>
      </form>
    </Surface>
  );
}
