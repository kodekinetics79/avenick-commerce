"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ZodIssue } from "zod";
import { Building2, UserRound } from "lucide-react";
import { Input, Button, Textarea } from "@avenick/ui";
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

const SELECT_CLASS =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-foreground";
const FIELD_ERROR_CLASS = "mt-1 text-xs text-destructive";

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
      <fieldset className="space-y-3.5">
        <legend className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Building2 className="h-4 w-4 text-primary" /> Your business
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
          <div>
            <label htmlFor="reg-type" className={LABEL_CLASS}>{FIELD_LABELS.type}</label>
            <select
              id="reg-type"
              name="type"
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              className={SELECT_CLASS}
              required
            >
              <option value="" disabled>Select type</option>
              {SELLER_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {fieldErrors.type && <p className={FIELD_ERROR_CLASS}>{fieldErrors.type}</p>}
          </div>
          <div>
            <label htmlFor="reg-country" className={LABEL_CLASS}>{FIELD_LABELS.country}</label>
            <select
              id="reg-country"
              name="country"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              className={SELECT_CLASS}
              required
            >
              <option value="" disabled>Select country</option>
              {COUNTRY_VALUES.map((code) => (
                <option key={code} value={code}>{getCountryName(code)}</option>
              ))}
            </select>
            {fieldErrors.country && <p className={FIELD_ERROR_CLASS}>{fieldErrors.country}</p>}
          </div>
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
        <div>
          <label htmlFor="reg-description" className={LABEL_CLASS}>{FIELD_LABELS.description} (optional)</label>
          <Textarea
            id="reg-description"
            name="description"
            placeholder="What you sell, which markets you serve, and anything the reviewer should know"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={1000}
          />
          {fieldErrors.description && <p className={FIELD_ERROR_CLASS}>{fieldErrors.description}</p>}
        </div>
      </fieldset>

      <fieldset className="space-y-3.5">
        <legend className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <UserRound className="h-4 w-4 text-primary" /> Account owner
        </legend>
        <p className="text-xs text-muted-foreground -mt-2">
          This person signs in to Seller Central and can invite staff later.
        </p>
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
          <div>
            <label htmlFor="reg-language" className={LABEL_CLASS}>{FIELD_LABELS.language}</label>
            <select
              id="reg-language"
              name="language"
              value={form.language}
              onChange={(e) => set("language", e.target.value)}
              className={SELECT_CLASS}
            >
              {LANGUAGE_VALUES.map((code) => (
                <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>
              ))}
            </select>
            {fieldErrors.language && <p className={FIELD_ERROR_CLASS}>{fieldErrors.language}</p>}
          </div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="reg-accept-terms" className="flex items-start gap-2.5 text-sm text-foreground">
          <input
            id="reg-accept-terms"
            name="acceptTerms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => {
              setAcceptTerms(e.target.checked);
              clearFieldError("acceptTerms");
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[hsl(var(--primary))]"
          />
          <span>
            I have read and accept the{" "}
            {termsUrl ? (
              <a href={termsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                terms of service
              </a>
            ) : (
              "terms of service"
            )}
            .
          </span>
        </label>
        {fieldErrors.acceptTerms && <p className={FIELD_ERROR_CLASS}>{fieldErrors.acceptTerms}</p>}
      </div>

      {error && (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" loading={loading}>
        Submit application
      </Button>
    </form>
  );
}
