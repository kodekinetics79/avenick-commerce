import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { clientIpFrom } from "@avenick/auth";
import { POST as registerBusinessHandler } from "@/app/api/auth/register/business/route";
import {
  AlertCircle,
  Building2,
  CheckCircle,
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { db } from "@avenick/database";
import type { CompanySize, Country, Industry, Language } from "@avenick/database";
import { COMPANY_SIZE_VALUES, INDUSTRY_VALUES, LANGUAGE_VALUES } from "@avenick/types";
import {
  Button,
  CellGrid,
  Dateline,
  DisplayPlate,
  Eyebrow,
  Reveal,
  Surface,
  type SurfaceTone,
} from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import {
  ValidatedForm,
  ValidatedSelectField,
  ValidatedTextField,
  type ValidatedFormState,
} from "@/components/b2b/validated-form";
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import { b2bT, type B2BKey, type B2BT } from "@/components/b2b/messages";
import { auth, signOut } from "@/lib/auth-instance";
import { isDurableB2BMember } from "@/lib/b2b-access";
import { backendUrl, requestBaseUrl } from "@/lib/backend";
import { SUPPORTED_COUNTRIES } from "@/lib/market-context";
import { platformName } from "@avenick/utils/portal-config";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return b2bMetadata("meta.register");
}

// Each line describes a capability the portal implements, in the terms the
// product actually uses. No "exclusive discounts" and no Net-30/60/90: payment
// terms are whatever is recorded on an approved company account, and there is
// no self-service credit application (see the Terms of Service).
const FEATURES: Array<{ icon: typeof TrendingUp; titleKey: B2BKey; descKey: B2BKey }> = [
  { icon: TrendingUp, titleKey: "register.feature.pricing", descKey: "register.feature.pricing.desc" },
  { icon: FileText, titleKey: "register.feature.po", descKey: "register.feature.po.desc" },
  { icon: Users, titleKey: "register.feature.team", descKey: "register.feature.team.desc" },
  { icon: ShieldCheck, titleKey: "register.feature.terms", descKey: "register.feature.terms.desc" },
];

/*
 * Option labels.
 *
 * Each map is keyed by the Prisma enum type, so a value added to or renamed in
 * schema.prisma fails the build here instead of silently disappearing from the
 * form — the same drift that made four of the old form's industries unstorable
 * and six of the database's industries unreachable. The values themselves come
 * from @avenick/types, which is checked against the same Prisma enums.
 *
 * The labels are message KEYS now. An applicant reading an Arabic page and
 * choosing from an English industry list is the clearest possible statement
 * that the Arabic build is a setting rather than a design.
 */
const INDUSTRY_LABELS: Record<Industry, B2BKey> = {
  INDUSTRIAL_SUPPLIES: "register.industry.INDUSTRIAL_SUPPLIES",
  ELECTRONICS: "register.industry.ELECTRONICS",
  OFFICE_SUPPLIES: "register.industry.OFFICE_SUPPLIES",
  SAFETY_PPE: "register.industry.SAFETY_PPE",
  FOOD_HOSPITALITY: "register.industry.FOOD_HOSPITALITY",
  BUILDING_MATERIALS: "register.industry.BUILDING_MATERIALS",
  HEALTHCARE: "register.industry.HEALTHCARE",
  RETAIL: "register.industry.RETAIL",
  MANUFACTURING: "register.industry.MANUFACTURING",
  TECHNOLOGY: "register.industry.TECHNOLOGY",
  OTHER: "register.industry.OTHER",
};

// Headcount bands are the conventional reading of these buckets, shown so the
// choice means something at the point of entry. Only the enum value is stored.
const COMPANY_SIZE_LABELS: Record<CompanySize, B2BKey> = {
  MICRO: "register.size.MICRO",
  SMALL: "register.size.SMALL",
  MEDIUM: "register.size.MEDIUM",
  LARGE: "register.size.LARGE",
  ENTERPRISE: "register.size.ENTERPRISE",
};

const LANGUAGE_LABELS: Record<Language, B2BKey> = {
  AR: "register.language.AR",
  EN: "register.language.EN",
};

/** The Arabic names of the markets this platform sells in, where one exists. */
const COUNTRY_LABELS: Record<string, B2BKey> = {
  AE: "sites.country.AE",
  SA: "sites.country.SA",
  QA: "sites.country.QA",
  KW: "sites.country.KW",
  OM: "sites.country.OM",
  BH: "sites.country.BH",
};

// The markets Avenick sells in. The annotation makes a code that is not a Prisma
// `Country` — a typo, or a market added without the matching enum value — a
// typecheck error rather than a 500 on INSERT.
const COUNTRY_OPTIONS: readonly (readonly [Country, string])[] = SUPPORTED_COUNTRIES;

type RegisterResponse = {
  success?: boolean;
  error?: string;
  /** Keyed by the control's `name`; see describeValidationFailure in the route. */
  fieldErrors?: Record<string, string>;
  data?: { companyStatus?: string };
};

/**
 * Where "Sign in" goes from this page.
 *
 * The callbackUrl is the buyer workspace, not the account area: everyone who
 * reads this page is here about a COMPANY account, and an approved member who
 * mistook this for the sign-in page should land where they were trying to get
 * to. /login validates the parameter with safeReturnTo before using it, and a
 * user with no durable membership is bounced from /b2b back here — a loop that
 * ends on this page's own "awaiting verification" notice rather than nowhere.
 */
const SIGN_IN_HREF = "/login?callbackUrl=%2Fb2b";

/**
 * Submit the company + admin-user registration.
 *
 * This posts to /api/auth/register/business rather than writing the rows here so
 * that the transaction, the rate limit and the duplicate handling have exactly
 * one implementation — the same endpoint /register uses.
 */
async function registerBusinessAction(
  _prev: ValidatedFormState,
  formData: FormData,
): Promise<ValidatedFormState> {
  "use server";

  // The locale is read from the same cookie next-intl's request config reads,
  // rather than through next-intl itself: a Server Action runs outside the page
  // render, and the three sentences below are the ones an applicant sees at the
  // exact moment something has gone wrong — the worst possible place for the one
  // line on an Arabic page that is not in Arabic.
  const t: B2BT = b2bT(cookies().get("AVENICK_LOCALE")?.value);

  const value = (key: string) => String(formData.get(key) ?? "").trim();
  const payload = {
    companyNameEn: value("companyNameEn"),
    companyNameAr: value("companyNameAr"),
    crNumber: value("crNumber"),
    vatNumber: value("vatNumber"),
    industry: value("industry"),
    companySize: value("companySize"),
    country: value("country"),
    city: value("city"),
    firstName: value("firstName"),
    lastName: value("lastName"),
    email: value("email"),
    phone: value("phone"),
    // Never trimmed: a password's leading/trailing space is part of it.
    password: String(formData.get("password") ?? ""),
    language: value("language"),
  };

  const store = headers();
  let url: string;
  try {
    url = backendUrl(
      "/api/auth/register/business",
      requestBaseUrl({
        host: store.get("host"),
        forwardedHost: store.get("x-forwarded-host"),
        forwardedProto: store.get("x-forwarded-proto"),
      }),
    );
  } catch {
    url = "";
  }
  // backendUrl() hands back the bare path when it cannot resolve an origin.
  // Say so rather than letting fetch fail with something unreadable.
  if (!URL.canParse(url)) {
    return { error: t("register.error.origin") };
  }

  // The handler is invoked in-process rather than over HTTP.
  //
  // Forwarding the caller's x-forwarded-for into a fetch of our own public
  // origin does NOT preserve the applicant's address: the request leaves the
  // runtime and re-enters through the edge, which APPENDS the runtime's egress
  // IP. Since the client address is derived from the rightmost (edge-appended)
  // entry — the only one a client cannot forge — every applicant would key on
  // the same egress IP and share a single 5-per-hour bucket platform-wide.
  //
  // Calling the handler directly keeps one implementation of the transaction,
  // the duplicate handling and the rate limit, while letting us hand it a
  // request whose sole XFF entry IS the true client address. It also removes a
  // server-to-server round trip through the public internet.
  const clientIp = clientIpFrom(store);

  let res: Response;
  let json: RegisterResponse | null;
  try {
    res = await registerBusinessHandler(
      new NextRequest(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": clientIp,
        },
        body: JSON.stringify(payload),
      }),
    );
    json = (await res.json().catch(() => null)) as RegisterResponse | null;
  } catch {
    return { error: t("register.error.unreachable") };
  }

  if (!res.ok || json?.success !== true) {
    // The endpoint names the field and the reason; show that, not a stand-in.
    //
    // `fieldErrors` is carried through untouched so each message can be shown
    // against the box that produced it. It was being dropped here, which is why
    // fourteen inputs shared one sentence at the foot of the form. The values
    // are the SERVER's own text — a Zod message that names the accepted enum
    // values, or the length a password must reach — and are shown verbatim for
    // the same reason the flat error is: a translated stand-in would say less.
    return {
      error: json?.error ?? t("register.error.http", { status: res.status }),
      fieldErrors: json?.fieldErrors,
    };
  }

  // The confirmation screen describes a company awaiting verification. If the
  // row came back in any other state, report the state instead of showing a
  // screen that contradicts it.
  if (json.data?.companyStatus === "PENDING_VERIFICATION") {
    redirect("/b2b/register?submitted=1");
  }
  return {
    ok: true,
    message: t("register.created", { status: json.data?.companyStatus ?? t("register.created.unreported") }),
  };
}

/*
 * The local <Field> that used to live here is gone.
 *
 * It wrapped its control in a <label> — a valid association, and the only one
 * available to it, because it minted no id. What it could not do is tell a
 * screen reader WHICH field a submission rejected or WHY: there was no error
 * slot at all, so the endpoint's per-field messages had nowhere to land and the
 * whole form shared one sentence at the bottom. <ValidatedTextField> and
 * <ValidatedSelectField> are packages/ui's <Field> with its function child,
 * which is the same fix checkout made, plus the lookup that finds this field's
 * message in the last response.
 */

/**
 * A stated fact about this account, at rung 2. The amber and emerald washes it
 * used to carry were light-only pairs with no dark counterpart — cream text on
 * cream in the dark theme — and are now semantic tones with real dark values.
 */
function Notice({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Building2;
  tone: SurfaceTone;
  title: string;
  children: React.ReactNode;
}) {
  const ink =
    tone === "warning" ? "text-warning-ink" : tone === "success" ? "text-success-ink" : "text-ink-3";
  return (
    <Surface rung={2} tone={tone} className="p-6">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ink}`} aria-hidden="true" />
        <div className="space-y-2">
          <h2 className="u-h3 text-ink-1">{title}</h2>
          <div className="u-body space-y-2 text-ink-2">{children}</div>
        </div>
      </div>
    </Surface>
  );
}

export default async function B2BRegisterPage({
  searchParams,
}: {
  searchParams: { submitted?: string };
}) {
  const { t, f, locale } = await getB2B();
  const session = await auth();
  const userId = session?.user?.id;

  // Scoped to the session user only — never to an id from the request.
  const member = userId
    ? await db.companyMember.findUnique({
        where: { userId },
        include: {
          company: true,
          user: { select: { role: true, status: true, deletedAt: true } },
        },
      })
    : null;

  // Exactly the predicate /b2b gates on, so this can never bounce back there.
  //
  // Held in a variable rather than called inline on purpose. isDurableB2BMember
  // is declared `member is DurableB2BMember`, which is true of the positive
  // branch but a lie about the negative one: a member that fails the check is
  // still a member-shaped row, yet TypeScript narrows the false branch to
  // `null | undefined` and every field access below collapses to `never`. The
  // two call sites in lib/ genuinely want that null-narrowing, so the predicate
  // stays as it is and this caller — the only one that needs the *non-durable*
  // row — opts out of narrowing instead. Do not inline this back.
  if (member && isDurableB2BMember(member)) redirect("/b2b");

  /*
   * A member row that is not durable is why /b2b sent the user here. Before this
   * screen existed the page showed the sign-up call to action, which took them
   * to a form that answered "email already registered" — a closed loop with no
   * way to learn that the company was simply awaiting review.
   */
  if (member) {
    const { company } = member;
    const pending = company.status === "PENDING_VERIFICATION" && !company.deletedAt;
    const suspended = company.status === "SUSPENDED" || Boolean(company.deletedAt);

    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 space-y-4">
          {pending ? (
            <Notice icon={Clock} tone="warning" title={t("register.pending.title", { company: company.nameEn })}>
              <p>
                {t("register.pending.body", {
                  date: f.date(company.createdAt),
                  platform: platformName(),
                })}
              </p>
              <p>{t("register.pending.body2")}</p>
            </Notice>
          ) : suspended ? (
            <Notice icon={AlertCircle} tone="warning" title={t("register.suspended.title", { company: company.nameEn })}>
              <p>{company.deletedAt ? t("register.suspended.closed") : t("register.suspended.body")}</p>
            </Notice>
          ) : (
            <Notice icon={AlertCircle} tone="warning" title={t("register.inactive.title", { company: company.nameEn })}>
              <p>{t("register.inactive.body")}</p>
            </Notice>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link href="/products">{t("common.browseCatalogue")}</Link></Button>
            <Button asChild variant="ghost"><Link href="/support">{t("register.support")}</Link></Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (searchParams.submitted === "1") {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 space-y-4">
          <Notice icon={CheckCircle2} tone="success" title={t("register.submitted.title")}>
            <p>{t("register.submitted.body")}</p>
            <p>{t("register.submitted.body2")}</p>
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="primary"><Link href={SIGN_IN_HREF}>{t("register.signIn")}</Link></Button>
            <Button asChild variant="secondary"><Link href="/products">{t("common.browseCatalogue")}</Link></Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  /*
   * Signed in, but on no company at all — a personal account holder who followed
   * a "for business" link.
   *
   * The form used to be rendered to them anyway, under a notice explaining that
   * they would have to sign out. It could not do what they were about to ask of
   * it: the endpoint creates a NEW user as the company administrator, so the
   * only submission that succeeds is one made with an email address that is not
   * the one they are signed in with, and it leaves them signed in as themselves
   * with no visible connection to the company they just created. Fourteen boxes
   * that end somewhere nobody wanted is worse than no boxes, so the page states
   * the position and offers the one action that unblocks it.
   */
  if (userId) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 space-y-4">
          <Notice icon={AlertCircle} tone="accent" title={t("register.signedIn.title")}>
            <p>{t("register.signedIn.body")}</p>
          </Notice>
          <div className="flex flex-wrap items-center gap-2">
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/b2b/register" });
              }}
            >
              <Button type="submit" variant="primary">{t("register.signOut")}</Button>
            </form>
            <Button asChild variant="secondary"><Link href="/products">{t("common.browseCatalogue")}</Link></Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // The second language's line. On the English page it is Arabic and on the
  // Arabic page it is English, and each carries its own lang/dir so the run is
  // shaped by the right face and laid out in the right direction inside a page
  // set in the other. Two languages of equal standing, stated by the layout
  // rather than claimed in a footer.
  const secondLang = locale === "ar" ? "en" : "ar";
  const secondDir = locale === "ar" ? "ltr" : "rtl";

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-section">
        {/* ══ THE OPENING ═══════════════════════════════════════════════════
            A 12-column asymmetric composition rather than a stack: seven
            columns of type against four holding one composed object, both
            dropping to full width below 1024px.

            `grid-column` is LOGICAL, so the whole composition mirrors in Arabic
            with no second rule — the type takes the right seven columns and the
            plate the left four, and nothing in this file knows about it.

            The plate is <DisplayPlate>: the system's generated object, built
            from the product's own hues with the ledger ruling and the grain
            behind it. It claims nothing — there is no stock photograph of a
            warehouse here, and no customer count — and the sentence on it is
            three facts the database actually enforces. */}
        <div className="mb-block grid grid-cols-1 items-end gap-x-10 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Eyebrow className="mb-3 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("register.eyebrow")}
            </Eyebrow>
            <h1 className="u-hero text-ink-1">{t("register.title", { platform: platformName() })}</h1>
            <p lang={secondLang} dir={secondDir} className="u-h2 mt-3 font-normal text-ink-3">
              {/* `titleAlt`, not `titleAr`: in the AR catalogue this key holds
                  the ENGLISH line, which is exactly what the composition above
                  asks for and exactly what a name ending in "Ar" invites the
                  next reader to "correct". */}
              {t("register.titleAlt", { platform: platformName() })}
            </p>
            <p className="u-lead mt-5 max-w-prose text-ink-2">{t("register.lead")}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="primary" size="lg">
                <Link href="#register">{t("register.submit")}</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/products?b2b=true">{t("common.browseCatalogue")}</Link>
              </Button>
            </div>
            {/* The way back in.
                This page offered "Create business account" and nothing else, so
                an existing buyer who arrived here — from a marketing link, or
                from /b2b bouncing them — had no visible route to signing in and
                the only thing on the screen to press was a second registration.
                It is stated here as well as beside the submit because a reader
                who is in the wrong place needs to find that out at the TOP of a
                long page, not after filling it in. */}
            <p className="u-ui mt-4 text-ink-2">
              {t("register.haveAccount")}{" "}
              <Link href={SIGN_IN_HREF} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
                {t("register.signIn")}
              </Link>
            </p>
          </div>

          <DisplayPlate className="grid min-h-[260px] content-end p-6 lg:col-span-5 lg:min-h-[340px]">
            {/* relative z-[1]: the plate's ruling is a positioned ::before at
                z-index 0 and its grain is a positioned ::after, and an in-flow
                child paints BELOW both. Every plate that carries content has to
                lift it, exactly as `.u-empty > *` does. */}
            <div className="relative z-[1]">
              {/* ink-1, not the brass tone. The plate's own conic runs to .16
                  alpha — twice the ambient field's — and brass-ink's measured
                  headroom is computed against the FIELD. An 11px micro-caps run
                  is small text and needs 4.5:1, so it is set in the ink with the
                  most headroom rather than in the hue with the least. */}
              <Eyebrow className="text-ink-1">{t("register.plate.eyebrow")}</Eyebrow>
              {/* Display-scale type only. Nothing body-sized sits on the plate:
                  its tint is a gradient, and a 13px label's contrast would
                  depend on where in that gradient it happened to land. */}
              <p className="u-h2 mt-2 text-ink-1">{t("register.plate.line")}</p>
            </div>
          </DisplayPlate>
        </div>

        {/* Features. One panel divided by hairlines: four capabilities, one
            object, rather than four cards floating at the same weight as the
            registration form itself. The stagger is the page's only one, it is
            capped at four, and every cell is readable at t=0 — with JavaScript
            off the reveal never runs and the panel is simply there. */}
        <CellGrid cols={{ base: 1, sm: 2, lg: 4 }} className="mb-block">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.titleKey} index={index}>
              <feature.icon className="mb-2 h-5 w-5 text-ink-3" aria-hidden="true" />
              <h2 className="u-ui font-medium text-ink-1">{t(feature.titleKey)}</h2>
              <p className="u-meta mt-1 text-ink-2">{t(feature.descKey)}</p>
            </Reveal>
          ))}
        </CellGrid>

        {/* Registration */}
        <Surface rung={2} id="register" className="overflow-hidden">
          <div className="u-drawn w-14" data-on="true" aria-hidden="true" />
          <div className="p-6">
            <div className="mb-5 border-b border-border-strong pb-4">
              <h2 className="u-h2 text-ink-1">{t("register.form.title")}</h2>
              <p className="u-body mt-1 max-w-prose text-ink-2">{t("register.form.body")}</p>
            </div>

            <ValidatedForm action={registerBusinessAction} className="space-y-block">
              <section>
                <Eyebrow className="mb-3 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("register.section.company")}
                </Eyebrow>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ValidatedTextField name="companyNameEn" label={t("register.field.nameEn")} required minLength={2} maxLength={100} autoComplete="organization" />
                  <ValidatedTextField name="companyNameAr" label={t("register.field.nameAr")} minLength={2} maxLength={100} lang="ar" dir="rtl" placeholder={t("register.field.nameAr.placeholder")} />
                  <ValidatedTextField name="crNumber" label={t("register.field.cr")} required minLength={5} maxLength={30} />
                  <ValidatedTextField name="vatNumber" label={t("register.field.vat")} hint={t("register.field.vat.hint")} maxLength={30} />
                  <ValidatedSelectField name="industry" label={t("register.field.industry")} required defaultValue="">
                    <option value="" disabled>{t("register.field.industry.select")}</option>
                    {INDUSTRY_VALUES.map((v) => (
                      <option key={v} value={v}>{t(INDUSTRY_LABELS[v])}</option>
                    ))}
                  </ValidatedSelectField>
                  <ValidatedSelectField name="companySize" label={t("register.field.size")} required defaultValue="">
                    <option value="" disabled>{t("register.field.size.select")}</option>
                    {COMPANY_SIZE_VALUES.map((v) => (
                      <option key={v} value={v}>{t(COMPANY_SIZE_LABELS[v])}</option>
                    ))}
                  </ValidatedSelectField>
                  <ValidatedSelectField name="country" label={t("register.field.country")} required defaultValue="">
                    <option value="" disabled>{t("register.field.country.select")}</option>
                    {COUNTRY_OPTIONS.map(([code, name]) => (
                      <option key={code} value={code}>
                        {COUNTRY_LABELS[code] ? t(COUNTRY_LABELS[code]!) : name}
                      </option>
                    ))}
                  </ValidatedSelectField>
                  <ValidatedTextField name="city" label={t("register.field.city")} required minLength={2} maxLength={50} autoComplete="address-level2" />
                </div>
              </section>

              <section>
                <Eyebrow className="mb-3 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" /> {t("register.section.admin")}
                </Eyebrow>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ValidatedTextField name="firstName" label={t("register.field.firstName")} required minLength={2} maxLength={50} autoComplete="given-name" />
                  <ValidatedTextField name="lastName" label={t("register.field.lastName")} required minLength={2} maxLength={50} autoComplete="family-name" />
                  <ValidatedTextField type="email" name="email" label={t("register.field.email")} required autoComplete="email" />
                  <ValidatedTextField type="tel" name="phone" label={t("register.field.phone")} hint={t("register.field.phone.hint")} pattern="\+[1-9][0-9]{7,14}" autoComplete="tel" />
                  <ValidatedTextField type="password" name="password" label={t("register.field.password")} hint={t("register.field.password.hint")} required minLength={8} autoComplete="new-password" />
                  <ValidatedSelectField name="language" label={t("register.field.language")} defaultValue={locale === "ar" ? "AR" : "EN"}>
                    {LANGUAGE_VALUES.map((v) => (
                      <option key={v} value={v}>{t(LANGUAGE_LABELS[v])}</option>
                    ))}
                  </ValidatedSelectField>
                </div>
              </section>

              <div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Button type="submit" variant="primary">{t("register.submit")}</Button>
                  {/* The alternative to pressing the button, beside the button.
                      This line used to sit outside the form entirely, below it;
                      the moment a reader realises they already have an account
                      is the moment they are looking at the submit, so that is
                      where the other route has to be. */}
                  <p className="u-ui text-ink-2">
                    {t("register.haveAccount")}{" "}
                    <Link href={SIGN_IN_HREF} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
                      {t("register.signInInstead")}
                    </Link>
                  </p>
                </div>
                <Dateline className="mt-3 flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("register.submit.basis")}
                </Dateline>
              </div>
            </ValidatedForm>
          </div>
        </Surface>
      </div>
    </MainLayout>
  );
}
