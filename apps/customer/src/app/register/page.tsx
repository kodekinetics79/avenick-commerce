"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, ChevronRight, User } from "lucide-react";
import { Divider, Eyebrow, Input, Button, Surface } from "@avenick/ui";
import { AuthShell, FormErrorSlot } from "../auth/auth-shell";
import { platformName } from "@avenick/utils/portal-config";
import { SUPPORTED_COUNTRIES } from "@/lib/market-context";
// "@avenick/types/schemas", never the "@avenick/types" barrel: the barrel
// re-exports runtime enums from @avenick/database and drags Prisma into the
// client bundle. These two lists ARE the Prisma enums, proven by the
// AssertTrue<Exact<...>> block in that file, so nothing here can drift from
// what the column will accept.
import { COMPANY_SIZE_VALUES, INDUSTRY_VALUES } from "@avenick/types/schemas";

type Mode = "select" | "consumer" | "business";

/**
 * A native <select> dressed as the system's recessed rung-1 control, so it sits
 * at the same depth and height as every <Input> beside it. It stays native
 * rather than becoming the Radix <Select> because this form is a plain POST of
 * controlled state and a native picker is what a phone keyboard expects.
 *
 * The recipe is duplicated in the returns and support forms; it wants to be a
 * primitive in packages/ui, which is a cross-track request rather than something
 * this file may add.
 */
const CONTROL_CLASS =
  "u-focus w-full border border-input bg-surface-1 px-3 text-ui text-ink-1 outline-none " +
  "transition-[border-color,box-shadow] duration-press ease-standard";

/**
 * Display strings for the two Prisma enums the business branch has to send.
 * The VALUES come from @avenick/types/schemas — this map only names them, so a
 * value added to schema.prisma shows up as an un-named option rather than as a
 * silently-dropped choice.
 */
const INDUSTRY_LABELS: Record<(typeof INDUSTRY_VALUES)[number], string> = {
  INDUSTRIAL_SUPPLIES: "Industrial supplies",
  ELECTRONICS: "Electronics",
  OFFICE_SUPPLIES: "Office supplies",
  SAFETY_PPE: "Safety and PPE",
  FOOD_HOSPITALITY: "Food and hospitality",
  BUILDING_MATERIALS: "Building materials",
  HEALTHCARE: "Healthcare",
  RETAIL: "Retail",
  MANUFACTURING: "Manufacturing",
  TECHNOLOGY: "Technology",
  OTHER: "Other",
};

const COMPANY_SIZE_LABELS: Record<(typeof COMPANY_SIZE_VALUES)[number], string> = {
  MICRO: "Micro",
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
  ENTERPRISE: "Enterprise",
};

/**
 * The two account types, as a hairline-divided pair of rows rather than two
 * 6rem tiles with icons that scaled 10% on hover. A chooser is a list of
 * choices; making each one a floating card gave them the same visual weight as
 * the page itself, and `transition-all` animated their layout on every frame.
 *
 * Each line says what the choice actually costs you — the business route needs a
 * commercial registration number — because that is the fact that decides it.
 */
const MODES: ReadonlyArray<{
  value: Exclude<Mode, "select">;
  icon: typeof User;
  title: string;
  body: string;
}> = [
  {
    value: "consumer",
    icon: User,
    title: "Personal account / حساب شخصي",
    body: "Buy for yourself. No company details are required.",
  },
  {
    value: "business",
    icon: Building2,
    title: "Business account / حساب تجاري",
    body: "Buy on behalf of a company. Needs a commercial registration number.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // `companySize` is required by RegisterBusinessSchema and was absent from this
  // object entirely, so every business registration was rejected 400 before it
  // reached the database. `industry` was present but hardcoded to
  // INDUSTRIAL_SUPPLIES, which meant the platform recorded a classification the
  // applicant never gave. Both are now asked for; both start empty so nothing is
  // submitted on the applicant's behalf.
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", companyNameEn: "", companyNameAr: "", crNumber: "", vatNumber: "", industry: "", companySize: "", country: "", city: "" });

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const endpoint = mode === "consumer" ? "/api/auth/register/consumer" : "/api/auth/register/business";
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (data.success) {
      router.push("/login?registered=1");
    } else {
      setError(data.error ?? "Registration failed");
    }
    setLoading(false);
  }

  const isBusiness = mode === "business";

  return (
    <AuthShell
      eyebrow="Create an account"
      title={
        mode === "select"
          ? "Register"
          : isBusiness
            ? "Business account"
            : "Personal account"
      }
      subtitle={mode === "select" ? `Choose how you will buy on ${platformName()}.` : undefined}
      footer={
        <p className="u-meta text-ink-3">
          Already have an account?{" "}
          <Link href="/login" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      {mode === "select" && (
        <Surface rung={2} className="overflow-hidden">
          {/* A 1px gap filled by the hairline colour, each row painting its own
              surface over it — the CellGrid idiom, direction-neutral by
              construction. */}
          <div className="grid gap-px bg-hairline">
            {MODES.map(({ value, icon: Icon, title, body }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className="u-focus flex items-center gap-3 bg-surface-2 p-4 text-start transition-colors duration-press ease-standard hover:bg-ink-1/[0.04]"
              >
                <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="u-ui block font-medium text-ink-1">{title}</span>
                  <span className="u-meta mt-0.5 block text-ink-2">{body}</span>
                </span>
                {/* A direction-implying icon has to flip in Arabic. */}
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 rtl:rotate-180" aria-hidden="true" />
              </button>
            ))}
          </div>
        </Surface>
      )}

      {(mode === "consumer" || isBusiness) && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMode("select")}
            className="u-focus u-meta inline-flex items-center gap-1.5 rounded-nested font-medium text-primary-ink hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            Change account type
          </button>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                id="reg-first-name"
                label="First name / الاسم الأول"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
              />
              <Input
                id="reg-last-name"
                label="Last name / اسم العائلة"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
              />
            </div>
            <Input
              id="reg-email"
              type="email"
              label="Email address / البريد الإلكتروني"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
            {/* The password rule used to live in the placeholder, where it
                disappeared the moment you started typing. A hint stays put, and
                its line is also the space an error will occupy. */}
            <Input
              id="reg-password"
              type="password"
              label="Password / كلمة المرور"
              autoComplete="new-password"
              placeholder="••••••••"
              hint="At least 8 characters, with an uppercase letter and a number."
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
            <Input
              id="reg-phone"
              type="tel"
              label="Phone / رقم الهاتف"
              autoComplete="tel"
              hint="Optional. International format, including the country code."
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />

            {isBusiness && (
              <>
                <div className="pt-2">
                  <Eyebrow>Company details / بيانات الشركة</Eyebrow>
                  <Divider tone="strong" className="mt-1.5" />
                </div>
                <Input
                  id="reg-company-en"
                  label="Company name (English) / اسم الشركة بالإنجليزية"
                  value={form.companyNameEn}
                  onChange={(e) => set("companyNameEn", e.target.value)}
                  required
                />
                <Input
                  id="reg-company-ar"
                  label="Company name (Arabic) / اسم الشركة بالعربية"
                  dir="rtl"
                  value={form.companyNameAr}
                  onChange={(e) => set("companyNameAr", e.target.value)}
                />
                <Input
                  id="reg-cr"
                  label="Commercial registration number / رقم السجل التجاري"
                  value={form.crNumber}
                  onChange={(e) => set("crNumber", e.target.value)}
                  required
                />
                <Input
                  id="reg-vat"
                  label="VAT number / الرقم الضريبي"
                  hint="Optional."
                  value={form.vatNumber}
                  onChange={(e) => set("vatNumber", e.target.value)}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-industry" className="u-ui mb-1.5 block font-medium text-ink-1">
                      Industry / القطاع
                    </label>
                    <select
                      id="reg-industry"
                      data-rung={1}
                      required
                      value={form.industry}
                      onChange={(e) => set("industry", e.target.value)}
                      className={CONTROL_CLASS}
                      style={{ height: "var(--control-h-md)" }}
                    >
                      <option value="" disabled>Select an industry</option>
                      {INDUSTRY_VALUES.map((value) => (
                        <option key={value} value={value}>{INDUSTRY_LABELS[value]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reg-company-size" className="u-ui mb-1.5 block font-medium text-ink-1">
                      Company size / حجم الشركة
                    </label>
                    <select
                      id="reg-company-size"
                      data-rung={1}
                      required
                      value={form.companySize}
                      onChange={(e) => set("companySize", e.target.value)}
                      className={CONTROL_CLASS}
                      style={{ height: "var(--control-h-md)" }}
                    >
                      <option value="" disabled>Select a size</option>
                      {COMPANY_SIZE_VALUES.map((value) => (
                        <option key={value} value={value}>{COMPANY_SIZE_LABELS[value]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-country" className="u-ui mb-1.5 block font-medium text-ink-1">
                      Country / الدولة
                    </label>
                    <select
                      id="reg-country"
                      data-rung={1}
                      required
                      value={form.country}
                      onChange={(e) => set("country", e.target.value)}
                      className={CONTROL_CLASS}
                      style={{ height: "var(--control-h-md)" }}
                    >
                      <option value="" disabled>Select country</option>
                      {SUPPORTED_COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </select>
                  </div>
                  <Input
                    id="reg-city"
                    label="City / المدينة"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <FormErrorSlot message={error} />
            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
