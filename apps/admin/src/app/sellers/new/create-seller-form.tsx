"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, Building2, CheckCircle2, KeyRound, Percent, UserRound } from "lucide-react";
import { Button, Dateline, Divider, Eyebrow, Field, Input, SectionHeader, Surface, Textarea } from "@avenick/ui";
import { COUNTRY_VALUES, LANGUAGE_VALUES, SELLER_TIER_VALUES } from "@avenick/types/schemas";
import { getCountryName } from "@avenick/utils";
import { createSellerAction, type CreateSellerState } from "../actions";

/**
 * The @avenick/types SUBPATH, never the barrel: the barrel re-exports runtime
 * Prisma enums through @avenick/database, which reaches @vercel/otel and node
 * `module`, and a "use client" component that imports it fails the build.
 */
const SELLER_TYPE_VALUES = ["MANUFACTURER", "DISTRIBUTOR", "IMPORTER", "RETAILER"] as const;

/** Endonyms — a language name is written in its own language. Never translated. */
const LANGUAGE_LABELS: Record<(typeof LANGUAGE_VALUES)[number], string> = { AR: "العربية", EN: "English" };

const LABEL = "u-ui mb-1.5 block font-medium text-ink-1";
const FIELD_ERROR = "u-meta mt-1 text-danger-ink";
/** Native <select>, styled as the recessed rung-1 control Input renders. */
const CONTROL = [
  "u-focus w-full border border-input px-3 text-ui text-ink-1 h-control-md",
  "outline-none transition-[border-color,box-shadow] duration-press ease-standard",
].join(" ");

type Values = {
  businessNameEn: string;
  businessNameAr: string;
  crNumber: string;
  vatNumber: string;
  type: string;
  country: string;
  city: string;
  description: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  language: string;
  status: string;
  tier: string;
  commissionRate: string;
};

const EMPTY: Values = {
  businessNameEn: "",
  businessNameAr: "",
  crNumber: "",
  vatNumber: "",
  type: "DISTRIBUTOR",
  country: "AE",
  city: "",
  description: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  language: "EN",
  status: "PENDING_REVIEW",
  tier: "STANDARD",
  commissionRate: "5",
};

export interface CreateSellerFormProps {
  /** Only a SUPER_ADMIN may open an account that skips the review queue. */
  canOpenActive: boolean;
}

export function CreateSellerForm({ canOpenActive }: CreateSellerFormProps) {
  const t = useTranslations("adminReview");
  const router = useRouter();
  const [values, setValues] = React.useState<Values>(EMPTY);
  const [state, setState] = React.useState<CreateSellerState | null>(null);
  const [pending, startTransition] = React.useTransition();
  const noticeRef = React.useRef<HTMLDivElement>(null);

  const set = (key: keyof Values, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const fieldError = (name: string) =>
    state && !state.ok && state.field === name ? state.error : undefined;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(null);
    startTransition(async () => {
      const result = await createSellerAction({
        ...values,
        // Blank optionals are dropped by the schema's own preprocessing; the
        // numeric field is coerced there rather than parsed here.
        commissionRate: values.commissionRate,
      });
      setState(result);
      // A refusal must be announced where the caller is looking, not left at
      // the top of a form they have scrolled past.
      queueMicrotask(() => noticeRef.current?.focus());
      if (result.ok) router.refresh();
    });
  }

  if (state?.ok) {
    return (
      <Surface rung={2} className="space-y-4 p-6" role="status">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-nested bg-success-soft text-success-ink">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="u-ui space-y-2 text-ink-2">
            <h2 className="u-h3 text-ink-1">{t("newSeller.created.title")}</h2>
            <p>
              {state.status === "ACTIVE"
                ? t("newSeller.created.bodyActive", { email: state.email })
                : t("newSeller.created.bodyPending", { email: state.email })}
            </p>
            {/* The password is NOT echoed back. It was typed by the person
                reading this screen, and reprinting a live credential into a
                page that may be shared or screenshot adds a way to leak it and
                no way to learn it. */}
            <p>{t("newSeller.created.deliverCredentials")}</p>
          </div>
        </div>
        <Divider />
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/sellers/${state.sellerId}`}>{t("newSeller.created.openRecord")}</Link>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setValues(EMPTY); setState(null); }}>
            {t("newSeller.created.addAnother")}
          </Button>
        </div>
      </Surface>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-block" noValidate>
      {state && !state.ok && (
        <div ref={noticeRef} tabIndex={-1} role="alert" className="u-focus rounded-nested">
          <p className="u-ui flex items-start gap-1.5 text-danger-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {state.error}
          </p>
        </div>
      )}

      {/* ── The business ─────────────────────────────────────────────────── */}
      <Surface as="section" rung={2} className="space-y-4 p-5">
        <SectionHeader
          icon={Building2}
          eyebrow={t("newSeller.business.eyebrow")}
          title={t("newSeller.business.title")}
          description={t("newSeller.business.description")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("newSeller.fields.businessNameEn")}
            value={values.businessNameEn}
            onChange={(e) => set("businessNameEn", e.target.value)}
            error={fieldError("businessNameEn")}
            maxLength={100}
            autoComplete="organization"
            required
          />
          <Input
            label={t("newSeller.fields.businessNameAr")}
            dir="rtl"
            lang="ar"
            value={values.businessNameAr}
            onChange={(e) => set("businessNameAr", e.target.value)}
            error={fieldError("businessNameAr")}
            maxLength={100}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("newSeller.fields.crNumber")}
            value={values.crNumber}
            onChange={(e) => set("crNumber", e.target.value)}
            error={fieldError("crNumber")}
            hint={t("newSeller.fields.crNumberHint")}
            className="u-mono"
            maxLength={30}
            required
          />
          <Input
            label={t("newSeller.fields.vatNumber")}
            value={values.vatNumber}
            onChange={(e) => set("vatNumber", e.target.value)}
            error={fieldError("vatNumber")}
            className="u-mono"
            maxLength={30}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={LABEL} htmlFor="seller-type">{t("newSeller.fields.type")}</label>
            <select
              id="seller-type"
              data-rung={1}
              className={CONTROL}
              value={values.type}
              onChange={(e) => set("type", e.target.value)}
            >
              {SELLER_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>{t(`sellerType.${value}`)}</option>
              ))}
            </select>
            {fieldError("type") && <p className={FIELD_ERROR}>{fieldError("type")}</p>}
          </div>
          <div>
            <label className={LABEL} htmlFor="seller-country">{t("newSeller.fields.country")}</label>
            <select
              id="seller-country"
              data-rung={1}
              className={CONTROL}
              value={values.country}
              onChange={(e) => set("country", e.target.value)}
            >
              {COUNTRY_VALUES.map((value) => (
                <option key={value} value={value}>{getCountryName(value)}</option>
              ))}
            </select>
          </div>
          <Input
            label={t("newSeller.fields.city")}
            value={values.city}
            onChange={(e) => set("city", e.target.value)}
            error={fieldError("city")}
            maxLength={50}
            autoComplete="address-level2"
            required
          />
        </div>
        <Field label={t("newSeller.fields.description")} htmlFor="seller-description">
          <Textarea
            id="seller-description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t("newSeller.fields.descriptionPlaceholder")}
          />
        </Field>
      </Surface>

      {/* ── The owner login ──────────────────────────────────────────────── */}
      <Surface as="section" rung={2} className="space-y-4 p-5">
        <SectionHeader
          icon={UserRound}
          eyebrow={t("newSeller.owner.eyebrow")}
          title={t("newSeller.owner.title")}
          description={t("newSeller.owner.description")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("newSeller.fields.firstName")}
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            error={fieldError("firstName")}
            maxLength={50}
            required
          />
          <Input
            label={t("newSeller.fields.lastName")}
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            error={fieldError("lastName")}
            maxLength={50}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("newSeller.fields.email")}
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            error={fieldError("email")}
            hint={t("newSeller.fields.emailHint")}
            maxLength={254}
            required
          />
          <Input
            label={t("newSeller.fields.phone")}
            type="tel"
            dir="ltr"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            error={fieldError("phone")}
            placeholder="+9715xxxxxxx"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("newSeller.fields.password")}
            type="password"
            value={values.password}
            onChange={(e) => set("password", e.target.value)}
            error={fieldError("password")}
            hint={t("newSeller.fields.passwordHint")}
            autoComplete="new-password"
            maxLength={128}
            required
          />
          <div>
            <label className={LABEL} htmlFor="seller-language">{t("newSeller.fields.language")}</label>
            <select
              id="seller-language"
              data-rung={1}
              className={CONTROL}
              value={values.language}
              onChange={(e) => set("language", e.target.value)}
            >
              {LANGUAGE_VALUES.map((value) => (
                <option key={value} value={value}>{LANGUAGE_LABELS[value]}</option>
              ))}
            </select>
          </div>
        </div>
        <Dateline>
          <KeyRound className="me-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {t("newSeller.owner.credentialNote")}
        </Dateline>
      </Surface>

      {/* ── Platform terms ───────────────────────────────────────────────── */}
      <Surface as="section" rung={2} className="space-y-4 p-5">
        <SectionHeader
          icon={Percent}
          eyebrow={t("newSeller.terms.eyebrow")}
          title={t("newSeller.terms.title")}
          description={t("newSeller.terms.description")}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={LABEL} htmlFor="seller-status">{t("newSeller.fields.status")}</label>
            <select
              id="seller-status"
              data-rung={1}
              className={CONTROL}
              value={values.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="PENDING_REVIEW">{t("newSeller.statusOption.PENDING_REVIEW")}</option>
              {/* Rendered only for a SUPER_ADMIN. The service refuses it for
                  anyone else regardless, so hiding it here removes a control
                  that would only ever produce a refusal — it is not the
                  enforcement. */}
              {canOpenActive && <option value="ACTIVE">{t("newSeller.statusOption.ACTIVE")}</option>}
            </select>
            {fieldError("status") && <p className={FIELD_ERROR}>{fieldError("status")}</p>}
            <p className="u-meta mt-1 text-ink-3">
              {canOpenActive ? t("newSeller.fields.statusHintSuper") : t("newSeller.fields.statusHintAdmin")}
            </p>
          </div>
          <div>
            <label className={LABEL} htmlFor="seller-tier">{t("newSeller.fields.tier")}</label>
            <select
              id="seller-tier"
              data-rung={1}
              className={CONTROL}
              value={values.tier}
              onChange={(e) => set("tier", e.target.value)}
            >
              {SELLER_TIER_VALUES.map((value) => (
                <option key={value} value={value}>{t(`sellerTier.${value}`)}</option>
              ))}
            </select>
          </div>
          <Input
            label={t("newSeller.fields.commissionRate")}
            type="number"
            min={0}
            max={100}
            step={0.01}
            inputMode="decimal"
            value={values.commissionRate}
            onChange={(e) => set("commissionRate", e.target.value)}
            error={fieldError("commissionRate")}
            hint={t("newSeller.fields.commissionRateHint")}
            required
          />
        </div>
      </Surface>

      <Surface rung={4} className="sticky bottom-4 z-sticky flex flex-wrap items-center gap-3 p-3">
        <Eyebrow>{t("newSeller.commitEyebrow")}</Eyebrow>
        <div className="ms-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sellers">{t("newSeller.cancel")}</Link>
          </Button>
          <Button type="submit" size="sm" loading={pending}>
            {t("newSeller.submit")}
          </Button>
        </div>
      </Surface>
    </form>
  );
}
