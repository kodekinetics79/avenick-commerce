"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ZodIssue } from "zod";
import { Building2, UserRound } from "lucide-react";
import { Button, Divider, Eyebrow, Field, Input, Textarea } from "@avenick/ui";
import { COUNTRY_VALUES, LANGUAGE_VALUES, RegisterSellerSchema } from "@avenick/types/schemas";
import { getCountryName } from "@avenick/utils";

/** Enum → label. The values are the Prisma `SellerType` enum, via the schema. */
const SELLER_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "DISTRIBUTOR", label: "Distributor" },
  { value: "IMPORTER", label: "Importer" },
  { value: "RETAILER", label: "Retailer" },
];

const LANGUAGE_LABELS: Record<(typeof LANGUAGE_VALUES)[number], string> = { AR: "العربية", EN: "English" };

const FIELD_LABELS: Record<string, string> = {
  businessNameEn: "Business name (English)",
  businessNameAr: "Business name (Arabic)",
  crNumber: "Commercial registration number",
  vatNumber: "VAT number",
  type: "Business type",
  country: "Country",
  city: "City",
  description: "Description",
  firstName: "First name",
  lastName: "Last name",
  email: "Email address",
  phone: "Phone number",
  password: "Password",
  language: "Preferred language",
  acceptTerms: "Terms of service",
};

type FormValues = {
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
};

const EMPTY: FormValues = {
  businessNameEn: "",
  businessNameAr: "",
  crNumber: "",
  vatNumber: "",
  type: "",
  country: "",
  city: "",
  description: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  language: "AR",
};

/** What the route answers; `field` marks a 409 that names one input. */
type RegisterResponse =
  | { success: true; status: string }
  | { success: false; error?: string; field?: string; fieldErrors?: Record<string, string> };

/**
 * The native <select> kept its element — it is a controlled input read back by
 * `fetch`, and swapping in a Radix listbox would be a behaviour change for a
 * styling problem — but its class list is now the same recessed rung-1 control
 * <Input> and <Textarea> paint, drawn from tokens.
 *
 * What it replaced: `h-10 rounded-xl border-input bg-background text-sm
 * focus-visible:ring-2` — a fixed 40px height that ignores --control-h-md, a
 * fixed 12px radius that ignores --radius, and a single-stop focus ring, so the
 * one control on this form that was not a primitive was also the one control
 * that looked like a different product.
 *
 * data-rung={1} is the system's own contract and is what makes it recessed; it
 * also re-declares --ring-offset-surface so the two-stop focus ring's inner stop
 * matches the ground it is drawn on.
 */
const SELECT_CLASS = [
  "w-full border border-input bg-surface-1 px-3 text-ui text-ink-1",
  "outline-none focus-visible:shadow-[var(--elev-1),0_0_0_2px_hsl(var(--ring-offset-surface)),0_0_0_4px_hsl(var(--ring))]",
  "transition-[border-color,box-shadow] duration-press ease-standard",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");
// [data-rung] already paints the radius from --radius, so the control cannot
// drift from the portal's own shape token the way a hardcoded rounded-xl did.
const SELECT_STYLE = { height: "var(--control-h-md)" } as const;

/**
 * The same schema the route enforces, run before the request so a typo is
 * caught without a round trip. Zod's own wording is kept where it is already
 * specific (the password rules, the phone format) and replaced where it would
 * name no field ("Required", "Invalid enum value").
 */
function messageFor(field: string, issue: ZodIssue, raw: unknown): string {
  const label = FIELD_LABELS[field] ?? field;
  if (raw === "" || raw === undefined) return `${label} is required.`;
  switch (issue.code) {
    case "too_small":
      return issue.type === "string" ? `${label} must be at least ${issue.minimum} characters.` : issue.message;
    case "too_big":
      return issue.type === "string" ? `${label} must be at most ${issue.maximum} characters.` : issue.message;
    case "invalid_string":
      return issue.validation === "email" ? "Enter a valid email address." : issue.message;
    case "invalid_enum_value":
      return `Choose a ${label.toLowerCase()}.`;
    default:
      return issue.message;
  }
}

export function RegisterForm({ termsUrl }: { termsUrl: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormValues>(EMPTY);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /** Editing a field retires its message: the value it described is gone. */
  function clearFieldError(key: string) {
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    clearFieldError(key);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const candidate: Record<string, unknown> = { ...form, acceptTerms };
    const parsed = RegisterSellerSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.map(String).join(".") || "form";
        // First issue per field wins: later ones are usually consequences of it.
        if (!(field in next)) next[field] = messageFor(field, issue, candidate[field]);
      }
      setFieldErrors(next);
      setError("Please correct the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register/seller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json().catch(() => null)) as RegisterResponse | null;

      if (res.ok && data?.success) {
        // Stay in the loading state through the navigation so the form
        // cannot be submitted twice.
        router.push("/login?registered=1");
        return;
      }

      if (data && !data.success) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        else if (data.field && data.error) setFieldErrors({ [data.field]: data.error });
        setError(data.error ?? "Registration failed. Please try again.");
      } else if (res.status === 429) {
        setError("Too many registration attempts. Please try again later.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Seller application" noValidate>
      {/* Two numbered movements, each headed by the brass rule the whole product
          uses to say "you are here". A long application form read as one
          undifferentiated scroll; the rule and the step number make it a
          sequence without changing a single field or a single validation. */}
      <fieldset className="space-y-3.5">
        <legend className="mb-3 w-full">
          <Divider drawn on className="w-10" />
          <span className="mt-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
            <Eyebrow as="span">Step 1 of 2</Eyebrow>
          </span>
          <span className="u-h3 mt-0.5 block text-ink-1">Your business</span>
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="reg-business-en"
            name="businessNameEn"
            label={FIELD_LABELS.businessNameEn}
            autoComplete="organization"
            value={form.businessNameEn}
            onChange={(e) => set("businessNameEn", e.target.value)}
            error={fieldErrors.businessNameEn}
            required
          />
          <Input
            id="reg-business-ar"
            name="businessNameAr"
            label={`${FIELD_LABELS.businessNameAr} (optional)`}
            dir="rtl"
            value={form.businessNameAr}
            onChange={(e) => set("businessNameAr", e.target.value)}
            error={fieldErrors.businessNameAr}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="reg-cr"
            name="crNumber"
            label={FIELD_LABELS.crNumber}
            value={form.crNumber}
            onChange={(e) => set("crNumber", e.target.value)}
            error={fieldErrors.crNumber}
            required
          />
          <Input
            id="reg-vat"
            name="vatNumber"
            label={`${FIELD_LABELS.vatNumber} (optional)`}
            value={form.vatNumber}
            onChange={(e) => set("vatNumber", e.target.value)}
            error={fieldErrors.vatNumber}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={FIELD_LABELS.type} htmlFor="reg-type" error={fieldErrors.type} required>
            <select
              id="reg-type"
              name="type"
              data-rung={1}
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              className={SELECT_CLASS}
              style={SELECT_STYLE}
              required
            >
              <option value="" disabled>Select type</option>
              {SELLER_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label={FIELD_LABELS.country} htmlFor="reg-country" error={fieldErrors.country} required>
            <select
              id="reg-country"
              name="country"
              data-rung={1}
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              className={SELECT_CLASS}
              style={SELECT_STYLE}
              required
            >
              <option value="" disabled>Select country</option>
              {COUNTRY_VALUES.map((code) => (
                <option key={code} value={code}>{getCountryName(code)}</option>
              ))}
            </select>
          </Field>
          <Input
            id="reg-city"
            name="city"
            label={FIELD_LABELS.city}
            autoComplete="address-level2"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            error={fieldErrors.city}
            required
          />
        </div>
        <Field
          label={`${FIELD_LABELS.description} (optional)`}
          htmlFor="reg-description"
          error={fieldErrors.description}
        >
          <Textarea
            id="reg-description"
            name="description"
            placeholder="What you sell, which markets you serve, and anything the reviewer should know"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={1000}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-3.5">
        <legend className="mb-3 w-full">
          <Divider drawn on className="w-10" />
          <span className="mt-3 flex items-center gap-2">
            <UserRound className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
            <Eyebrow as="span">Step 2 of 2</Eyebrow>
          </span>
          <span className="u-h3 mt-0.5 block text-ink-1">Account owner</span>
          <span className="u-meta mt-0.5 block max-w-desc text-ink-2">
            This person signs in to Seller Central and can invite staff later.
          </span>
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="reg-first-name"
            name="firstName"
            label={FIELD_LABELS.firstName}
            autoComplete="given-name"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            error={fieldErrors.firstName}
            required
          />
          <Input
            id="reg-last-name"
            name="lastName"
            label={FIELD_LABELS.lastName}
            autoComplete="family-name"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            error={fieldErrors.lastName}
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="reg-email"
            name="email"
            type="email"
            label={FIELD_LABELS.email}
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            error={fieldErrors.email}
            required
          />
          <Input
            id="reg-phone"
            name="phone"
            type="tel"
            label={`${FIELD_LABELS.phone} (optional)`}
            autoComplete="tel"
            placeholder="+9715xxxxxxxx"
            dir="ltr"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            error={fieldErrors.phone}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="reg-password"
            name="password"
            type="password"
            label={FIELD_LABELS.password}
            autoComplete="new-password"
            hint="At least 8 characters, with an uppercase letter and a number."
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            error={fieldErrors.password}
            required
          />
          <Field label={FIELD_LABELS.language} htmlFor="reg-language" error={fieldErrors.language}>
            <select
              id="reg-language"
              name="language"
              data-rung={1}
              value={form.language}
              onChange={(e) => set("language", e.target.value)}
              className={SELECT_CLASS}
              style={SELECT_STYLE}
            >
              {LANGUAGE_VALUES.map((code) => (
                <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <div>
        <label htmlFor="reg-accept-terms" className="u-ui flex items-start gap-2.5 text-ink-1">
          <input
            id="reg-accept-terms"
            name="acceptTerms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => {
              setAcceptTerms(e.target.checked);
              clearFieldError("acceptTerms");
            }}
            className="u-focus mt-0.5 h-4 w-4 shrink-0 rounded-sm border-border accent-primary"
          />
          <span>
            I have read and accept the{" "}
            {termsUrl ? (
              <a
                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
              >
                terms of service
              </a>
            ) : (
              "terms of service"
            )}
            .
          </span>
        </label>
        {fieldErrors.acceptTerms && (
          <p className="u-meta mt-1 text-danger-ink">{fieldErrors.acceptTerms}</p>
        )}
      </div>

      {error && (
        <p className="u-ui text-danger-ink" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" loading={loading}>
        Submit application
      </Button>
    </form>
  );
}
