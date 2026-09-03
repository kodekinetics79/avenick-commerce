"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Building2, ChevronRight, User } from "lucide-react";
import { Divider, Eyebrow, Input, Button } from "@avenick/ui";
import { AuthShell, FormErrorSlot } from "../auth/auth-shell";
import { IdentitySelect } from "../auth/identity-controls";
import { identityCopy, toIdentityLocale } from "../auth/identity-copy";
import { platformName } from "@avenick/utils/portal-config";
import { SUPPORTED_COUNTRIES } from "@/lib/market-context";
// "@avenick/types/schemas", never the "@avenick/types" barrel: the barrel
// re-exports runtime enums from @avenick/database and drags Prisma into the
// client bundle. These two lists ARE the Prisma enums, proven by the
// AssertTrue<Exact<...>> block in that file, so nothing here can drift from
// what the column will accept.
import { COMPANY_SIZE_VALUES, INDUSTRY_VALUES } from "@avenick/types/schemas";

type Mode = "select" | "consumer" | "business";

export default function RegisterPage() {
  const router = useRouter();
  // The provider in the root layout carries the same AVENICK_LOCALE value the
  // server pages read, so the client and server halves of this track can never
  // disagree about which language they are in.
  const locale = toIdentityLocale(useLocale());
  const t = identityCopy(locale).register;

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
    // THE FAILED STATE IS A DESIGNED STATE. The endpoint, the payload, the
    // success branch and the server's own `error` string are exactly what they
    // were — but the fetch and the res.json() had no catch, so a dropped
    // connection or a non-JSON 502 rejected out of this handler and
    // setLoading(false) never ran: the applicant was left staring at a spinner
    // on a permanently disabled button with nothing to read and nothing to
    // press. Every other form on this track already catches; this one is the
    // longest to fill in and was the only one that could strand you.
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success) {
        router.push("/login?registered=1");
      } else {
        setError(data.error ?? t.failed);
      }
    } catch {
      setError(t.failed);
    } finally {
      setLoading(false);
    }
  }

  const isBusiness = mode === "business";

  /**
   * The two account types, as a hairline-divided pair of rows rather than two
   * 6rem tiles with icons that scaled 10% on hover. A chooser is a list of
   * choices; making each one a floating card gave them the same visual weight as
   * the page itself, and `transition-all` animated their layout on every frame.
   *
   * It is also no longer a nested <Surface rung={2}> inside the shell's own
   * rung-2 card — a box inside a box, which is the exact failure the two line
   * weights exist to prevent. It is a ruled list on the ground it already sits
   * on, and the brass rule that draws in on hover is the same .u-drawn gesture
   * as active nav.
   *
   * Each line says what the choice actually COSTS you — the business route needs
   * a commercial registration number — because that is the fact that decides it.
   */
  const MODES = [
    { value: "consumer" as const, icon: User, title: t.consumerTitle, body: t.consumerBody },
    { value: "business" as const, icon: Building2, title: t.businessTitle, body: t.businessBody },
  ];

  return (
    <AuthShell
      locale={locale}
      eyebrow={t.eyebrow}
      title={mode === "select" ? t.title : isBusiness ? t.titleBusiness : t.titleConsumer}
      subtitle={mode === "select" ? t.subtitle(platformName()) : undefined}
      footer={
        <p className="u-meta text-ink-3">
          {t.hasAccount}{" "}
          <Link href="/login" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            {t.signIn}
          </Link>
        </p>
      }
    >
      {mode === "select" && (
        <div role="group" aria-label={t.chooserLabel} className="border-t border-hairline">
          {MODES.map(({ value, icon: Icon, title, body }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className="u-focus u-drawn-host u-state-wash relative flex w-full items-center gap-3 border-b border-hairline px-1 py-4 text-start"
            >
              <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="u-ui block font-medium text-ink-1">{title}</span>
                <span className="u-meta mt-0.5 block text-ink-2">{body}</span>
              </span>
              {/* A direction-implying icon has to flip in Arabic. */}
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 rtl:rotate-180" aria-hidden="true" />
              {/* The brass rule, drawn from the inline start on HOVER. Same
                  gesture, same 160ms, same origin token as everything else brass
                  in the product — one gesture in a new posture, never a sixth
                  gesture with its own timing.
                  Keyboard focus is carried by the two-stop .u-focus ring, not by
                  this rule: `.u-drawn-host` in globals.css matches :hover only.
                  Teaching it :focus-visible is a one-line change in packages/ui
                  and is filed as a cross-track request — do not hand-roll a
                  second focus indicator here to work around it. */}
              <Divider drawn className="absolute inset-x-0 bottom-[-1px]" />
            </button>
          ))}
        </div>
      )}

      {(mode === "consumer" || isBusiness) && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setMode("select")}
            className="u-focus u-meta inline-flex items-center gap-1.5 rounded-nested font-medium text-primary-ink hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            {t.changeType}
          </button>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                id="reg-first-name"
                label={t.firstName}
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
              />
              <Input
                id="reg-last-name"
                label={t.lastName}
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
              />
            </div>
            <Input
              id="reg-email"
              type="email"
              label={t.email}
              autoComplete="email"
              placeholder={t.emailPlaceholder}
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
              label={t.password}
              autoComplete="new-password"
              placeholder="••••••••"
              hint={t.passwordHint}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
            <Input
              id="reg-phone"
              type="tel"
              label={t.phone}
              autoComplete="tel"
              hint={t.phoneHint}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />

            {isBusiness && (
              <>
                <div className="pt-3">
                  <Eyebrow>{t.companySection}</Eyebrow>
                  <Divider tone="strong" className="mt-1.5" />
                </div>
                <Input
                  id="reg-company-en"
                  label={t.companyNameEn}
                  dir="ltr"
                  value={form.companyNameEn}
                  onChange={(e) => set("companyNameEn", e.target.value)}
                  required
                />
                <Input
                  id="reg-company-ar"
                  label={t.companyNameAr}
                  dir="rtl"
                  value={form.companyNameAr}
                  onChange={(e) => set("companyNameAr", e.target.value)}
                />
                <Input
                  id="reg-cr"
                  label={t.crNumber}
                  inputMode="numeric"
                  value={form.crNumber}
                  onChange={(e) => set("crNumber", e.target.value)}
                  required
                />
                <Input
                  id="reg-vat"
                  label={t.vatNumber}
                  inputMode="numeric"
                  hint={t.optional}
                  value={form.vatNumber}
                  onChange={(e) => set("vatNumber", e.target.value)}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* One shared recessed control instead of three copies of a
                      CONTROL_CLASS string in three files. */}
                  <IdentitySelect
                    id="reg-industry"
                    label={t.industry}
                    required
                    value={form.industry}
                    onChange={(e) => set("industry", e.target.value)}
                  >
                    <option value="" disabled>{t.industryPlaceholder}</option>
                    {/* The VALUES come from @avenick/types/schemas; this map only
                        NAMES them, so a value added to schema.prisma shows up as
                        an un-named option rather than a silently-dropped one. */}
                    {INDUSTRY_VALUES.map((value) => (
                      <option key={value} value={value}>{t.industryLabels[value] ?? value}</option>
                    ))}
                  </IdentitySelect>
                  <IdentitySelect
                    id="reg-company-size"
                    label={t.companySize}
                    required
                    value={form.companySize}
                    onChange={(e) => set("companySize", e.target.value)}
                  >
                    <option value="" disabled>{t.companySizePlaceholder}</option>
                    {COMPANY_SIZE_VALUES.map((value) => (
                      <option key={value} value={value}>{t.companySizeLabels[value] ?? value}</option>
                    ))}
                  </IdentitySelect>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <IdentitySelect
                    id="reg-country"
                    label={t.country}
                    required
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                  >
                    <option value="" disabled>{t.countryPlaceholder}</option>
                    {SUPPORTED_COUNTRIES.map(([code, name]) => (
                      <option key={code} value={code}>{t.countryLabels[code] ?? name}</option>
                    ))}
                  </IdentitySelect>
                  <Input
                    id="reg-city"
                    label={t.city}
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <FormErrorSlot message={error} />
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              {t.submit}
            </Button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
