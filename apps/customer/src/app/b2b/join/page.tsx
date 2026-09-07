import Link from "next/link";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { clientIpFrom } from "@avenick/auth";
import { POST as registerJoinHandler } from "@/app/api/auth/register/join/route";
import { Building2, ShieldCheck, UserPlus } from "lucide-react";
import type { Language } from "@avenick/database";
import { LANGUAGE_VALUES } from "@avenick/types";
import { Button, Dateline, Eyebrow, Surface } from "@avenick/ui";
import { SelectField, TextField } from "@/components/b2b/controls";
import { MainLayout } from "@/components/layout/main-layout";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import { b2bT, type B2BKey, type B2BT } from "@/components/b2b/messages";
import type { B2BActionState } from "@/lib/b2b";
import { backendUrl, requestBaseUrl } from "@/lib/backend";
import { platformName } from "@avenick/utils/portal-config";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return b2bMetadata("meta.join");
}

const LANGUAGE_LABELS: Record<Language, B2BKey> = {
  AR: "register.language.AR",
  EN: "register.language.EN",
};

type JoinResponse = { success?: boolean; error?: string; message?: string };

/**
 * Apply to join a company that is already registered.
 *
 * Posts to /api/auth/register/join rather than writing rows here, for the same
 * reason /b2b/register does: the CR lookup, the domain gate, the rate limit and
 * the enumeration-neutral answers must have exactly one implementation. The
 * handler is invoked IN-PROCESS rather than over HTTP so the applicant's real
 * address reaches the rate limiter — see the long note in /b2b/register, which
 * this mirrors deliberately.
 */
async function joinCompanyAction(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  "use server";

  const t: B2BT = b2bT(cookies().get("AVENICK_LOCALE")?.value);

  const value = (key: string) => String(formData.get(key) ?? "").trim();
  const payload = {
    crNumber: value("crNumber"),
    firstName: value("firstName"),
    lastName: value("lastName"),
    email: value("email"),
    phone: value("phone"),
    // Never trimmed: a password's leading/trailing space is part of it.
    password: String(formData.get("password") ?? ""),
    requestedRole: value("requestedRole"),
    department: value("department"),
    language: value("language"),
  };

  const store = headers();
  let url: string;
  try {
    url = backendUrl(
      "/api/auth/register/join",
      requestBaseUrl({
        host: store.get("host"),
        forwardedHost: store.get("x-forwarded-host"),
        forwardedProto: store.get("x-forwarded-proto"),
      }),
    );
  } catch {
    url = "";
  }
  if (!URL.canParse(url)) return { error: t("join.error.origin") };

  let res: Response;
  let json: JoinResponse | null;
  try {
    res = await registerJoinHandler(
      new NextRequest(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": clientIpFrom(store) },
        body: JSON.stringify(payload),
      }),
    );
    json = (await res.json().catch(() => null)) as JoinResponse | null;
  } catch {
    return { error: t("join.error.unreachable") };
  }

  if (!res.ok || json?.success !== true) {
    // The endpoint names the reason — wrong domain, no such CR, invitation-only
    // company — and each one tells the applicant something different to do.
    // Replacing them with one generic line is throwing away the answer.
    return { error: json?.error ?? t("join.error.http", { status: res.status }) };
  }

  return { ok: true, message: json.message ?? t("join.submitted.body") };
}

export default async function B2BJoinPage() {
  const { t } = await getB2B();

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl px-4 py-section">
        <Eyebrow className="mb-3 flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> {t("join.eyebrow")}
        </Eyebrow>
        <h1 className="u-hero text-ink-1">{t("join.title")}</h1>
        <p className="u-lead mt-5 max-w-prose text-ink-2">{t("join.lead", { platform: platformName() })}</p>

        {/* The three gates, stated before the form rather than discovered one
            refusal at a time. Every line here is something the endpoint
            actually enforces; none of them is a promise about a review time,
            because nothing measures one. */}
        <Surface rung={2} className="mt-6 p-5">
          <Eyebrow className="mb-3 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t("join.gates.title")}
          </Eyebrow>
          <ol className="u-body list-decimal space-y-1.5 ps-5 text-ink-2">
            <li>{t("join.gates.cr")}</li>
            <li>{t("join.gates.domain")}</li>
            <li>{t("join.gates.email")}</li>
            <li>{t("join.gates.admin")}</li>
          </ol>
        </Surface>

        <ValidatedForm action={joinCompanyAction} rung={1} className="mt-6 p-5">
          <div className="grid items-start gap-x-3 gap-y-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={t("join.cr")} hint={t("join.cr.hint")}>
                <TextField name="crNumber" required minLength={5} maxLength={30} inputMode="numeric" />
              </Field>
            </div>
            <Field label={t("join.firstName")}>
              <TextField name="firstName" required minLength={2} maxLength={50} autoComplete="given-name" />
            </Field>
            <Field label={t("join.lastName")}>
              <TextField name="lastName" required minLength={2} maxLength={50} autoComplete="family-name" />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("join.email")} hint={t("join.email.hint")}>
                <TextField name="email" type="email" required autoComplete="email" />
              </Field>
            </div>
            <Field label={t("join.phone")} hint={t("join.phone.hint")}>
              <TextField name="phone" type="tel" autoComplete="tel" placeholder="+9715xxxxxxx" />
            </Field>
            <Field label={t("join.department")}>
              <TextField name="department" maxLength={60} />
            </Field>
            <Field label={t("join.role")} hint={t("join.role.hint")}>
              <SelectField name="requestedRole" defaultValue="COMPANY_BUYER">
                <option value="COMPANY_BUYER">{t("team.role.buyer")}</option>
                <option value="COMPANY_APPROVER">{t("team.role.approver")}</option>
              </SelectField>
            </Field>
            <Field label={t("join.language")}>
              <SelectField name="language" defaultValue="EN">
                {LANGUAGE_VALUES.map((l) => (
                  <option key={l} value={l}>
                    {t(LANGUAGE_LABELS[l])}
                  </option>
                ))}
              </SelectField>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("join.password")} hint={t("join.password.hint")}>
                <TextField name="password" type="password" required autoComplete="new-password" />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Dateline>{t("join.basis")}</Dateline>
            <Button type="submit" variant="primary">{t("join.submit")}</Button>
          </div>
        </ValidatedForm>

        <p className="u-meta mt-6 text-ink-3">
          {t("join.instead")}{" "}
          <Link href="/b2b/register" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
            <Building2 className="me-1 inline h-3.5 w-3.5" aria-hidden="true" />
            {t("join.instead.link")}
          </Link>
        </p>
      </div>
    </MainLayout>
  );
}

/**
 * A labelled control whose label WRAPS its control, so the two are associated
 * without an id. The same helper /b2b/register defines; kept local for the same
 * reason it is local there — it is four lines of markup, and a shared component
 * would be a second place to look for something neither page ever varies.
 */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="u-ui mb-1.5 block font-medium text-ink-1">{label}</span>
      {children}
      {hint ? <span className="u-meta mt-1 block text-ink-3">{hint}</span> : null}
    </label>
  );
}
