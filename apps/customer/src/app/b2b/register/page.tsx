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
  Users,
} from "lucide-react";
import { db } from "@avenick/database";
import type { CompanySize, Country, Industry, Language } from "@avenick/database";
import { COMPANY_SIZE_VALUES, INDUSTRY_VALUES, LANGUAGE_VALUES } from "@avenick/types";
import {
  Button,
  Dateline,
  Eyebrow,
  StatusPill,
  Surface,
  Timeline,
  type SurfaceTone,
} from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { ValidatedPasswordField } from "@/components/auth/password-field";
import { identityCopy, toIdentityLocale } from "@/app/auth/identity-copy";
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
import { canonicalFor } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { ...(await b2bMetadata("meta.register")), ...canonicalFor("/b2b/register") };
}

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
  const t: B2BT = b2bT((await cookies()).get("AVENICK_LOCALE")?.value);

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

  const store = await headers();
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
    message: t("register.created", {
      status: json.data?.companyStatus ?? t("register.created.unreported"),
    }),
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
    tone === "warning"
      ? "text-warning-ink"
      : tone === "success"
        ? "text-success-ink"
        : "text-ink-3";
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

export default async function B2BRegisterPage(props: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const searchParams = await props.searchParams;
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
    // The filed Arabic name where one exists, the filed English name otherwise.
    // A blank heading would not be kinder than a name in the other script.
    const companyName = (locale === "ar" ? company.nameAr : null) || company.nameEn;

    /*
     * THE PAGE A RETURNING APPLICANT LANDS ON.
     *
     * A founder whose company is PENDING_VERIFICATION can sign in perfectly
     * well, and then every /b2b surface bounces them here, so this is the page
     * they see on every visit until a reviewer acts. It was one amber box: a
     * title, two sentences and two buttons. It said the application was in
     * review; it did not say WHERE in the review, and "there is nothing further
     * to submit" was buried in the second paragraph of the second sentence — so
     * the honest question a returning applicant has ("is it stuck on me?") was
     * answered, in passing, by a clause.
     *
     * It now states three things without being read closely: which stage the
     * application is at (the ladder), what was filed and when (the record), and
     * that nothing is waiting on the applicant (its own heading). The stage
     * ladder carries no dates on its future steps and the copy promises no
     * review time, because nothing in this system measures one — a company is
     * approved when its registration has been checked, and inventing "2–3
     * business days" here would be the one sentence on the page that could turn
     * out to be a lie.
     */
    if (pending) {
      const countryKey = COUNTRY_LABELS[company.country];
      const record: Array<{ label: string; value: string }> = [
        { label: t("status.filed.submitted"), value: f.date(company.createdAt) },
        { label: t("status.filed.cr"), value: company.crNumber ?? t("common.notRecorded") },
        { label: t("status.filed.country"), value: countryKey ? t(countryKey) : company.country },
      ];

      return (
        <MainLayout>
          <div className="mx-auto max-w-3xl space-y-block px-4 py-block lg:py-section">
            <header>
              <Eyebrow>{t("status.eyebrow")}</Eyebrow>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="u-h2 text-ink-1">{companyName}</h1>
                {/* Static dot, never pulsing: this page is visited repeatedly by
                    someone who can do nothing about it, and a pulsing indicator
                    on a wait they cannot shorten is fatigue, not information. */}
                <StatusPill tone="warning" dot>
                  {t("status.pill.review")}
                </StatusPill>
              </div>
              <p className="u-lead mt-3 max-w-prose text-ink-2">
                {t("status.lead", { platform: platformName() })}
              </p>
            </header>

            {/* THE RECORD. What was filed, and when — the applicant's own copy of
                it, and the three values a support conversation actually needs. */}
            <Surface rung={2} className="p-5 sm:p-6">
              <dl className="grid gap-4 sm:grid-cols-3">
                {record.map((row) => (
                  <div key={row.label}>
                    <dt className="u-micro text-ink-3">{row.label}</dt>
                    <dd className="u-ui mt-1 break-words font-medium text-ink-1">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <Dateline className="mt-5">{t("status.filed.basis")}</Dateline>
            </Surface>

            {/* THE LADDER. Three stages, one of them current. No timestamps on
                the two that have not happened. */}
            <Surface rung={2} className="p-5 sm:p-6">
              <h2 className="u-h3 text-ink-1">{t("status.stages")}</h2>
              <Timeline
                className="mt-4"
                currentLabel={t("status.current")}
                steps={[
                  {
                    label: t("status.step.received"),
                    description: t("status.step.received.desc"),
                    timestamp: f.date(company.createdAt),
                    done: true,
                  },
                  {
                    label: t("status.step.review"),
                    description: t("status.step.review.desc", { platform: platformName() }),
                    current: true,
                    icon: Clock,
                  },
                  {
                    label: t("status.step.open"),
                    description: t("status.step.open.desc"),
                  },
                ]}
              />
            </Surface>

            {/* WHAT IS WAITING ON WHOM. Its own heading, because it is the
                question a returning applicant came with. */}
            <Surface rung={2} tone="warning" className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <CheckCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-warning-ink"
                  aria-hidden="true"
                />
                <div className="u-body space-y-2 text-ink-2">
                  <h2 className="u-h3 text-ink-1">{t("status.next")}</h2>
                  <p>{t("status.next.nothingToDo")}</p>
                  <p>{t("status.next.noEta")}</p>
                  <p>{t("status.next.returning")}</p>
                </div>
              </div>
            </Surface>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href="/products">{t("common.browseCatalogue")}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/support">{t("register.support")}</Link>
              </Button>
            </div>
          </div>
        </MainLayout>
      );
    }

    return (
      <MainLayout>
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-16">
          {suspended ? (
            <Notice
              icon={AlertCircle}
              tone="warning"
              title={t("register.suspended.title", { company: companyName })}
            >
              <p>
                {company.deletedAt ? t("register.suspended.closed") : t("register.suspended.body")}
              </p>
            </Notice>
          ) : (
            <Notice
              icon={AlertCircle}
              tone="warning"
              title={t("register.inactive.title", { company: companyName })}
            >
              <p>{t("register.inactive.body")}</p>
            </Notice>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/products">{t("common.browseCatalogue")}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/support">{t("register.support")}</Link>
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (searchParams.submitted === "1") {
    return (
      <MainLayout>
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-16">
          <Notice icon={CheckCircle2} tone="success" title={t("register.submitted.title")}>
            <p>{t("register.submitted.body")}</p>
            <p>{t("register.submitted.body2")}</p>
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="primary">
              <Link href={SIGN_IN_HREF}>{t("register.signIn")}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/products">{t("common.browseCatalogue")}</Link>
            </Button>
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
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-16">
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
              <Button type="submit" variant="primary">
                {t("register.signOut")}
              </Button>
            </form>
            <Button asChild variant="secondary">
              <Link href="/products">{t("common.browseCatalogue")}</Link>
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-shell px-gutter py-4 lg:py-5">
        {/* Registration is the opening experience, not a destination below a
            marketing page. Chrome glass gives the form a focused workspace on
            wide screens; the mobile override removes the blur and uses the
            opaque float surface so a tall phone form stays fast and legible. */}
        <section
          id="register"
          className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-7"
        >
          <Surface
            rung={4}
            glass
            className="overflow-hidden max-md:!bg-surface-float max-md:backdrop-blur-none lg:col-span-8"
          >
            <div className="p-5 sm:p-6">
              <header className="mb-4 border-b border-border-strong pb-4">
                <h1 className="u-h1 max-w-[22ch] text-ink-1">
                  {t("register.title", { platform: platformName() })}
                </h1>
                <p className="u-body mt-2 max-w-[68ch] text-ink-2">{t("register.lead")}</p>
                <div className="u-ui mt-3 flex flex-wrap gap-x-5 gap-y-2 text-ink-2">
                  <span>
                    {t("register.haveAccount")}{" "}
                    <Link
                      href={SIGN_IN_HREF}
                      className="u-focus rounded-nested font-medium text-primary-ink underline decoration-transparent underline-offset-4 hover:decoration-current"
                    >
                      {t("register.signIn")}
                    </Link>
                  </span>
                  <span>
                    {t("register.joinInstead")}{" "}
                    <Link
                      href="/b2b/join"
                      className="u-focus rounded-nested font-medium text-primary-ink underline decoration-transparent underline-offset-4 hover:decoration-current"
                    >
                      {t("register.joinInstead.link")}
                    </Link>
                  </span>
                </div>
              </header>

              <div className="mb-4">
                <h2 className="u-h2 text-ink-1">{t("register.form.title")}</h2>
                <p className="u-meta mt-1 max-w-prose text-ink-2">{t("register.form.body")}</p>
              </div>

              <ValidatedForm action={registerBusinessAction} className="space-y-5">
                <div className="grid gap-6 xl:grid-cols-2">
                  <section>
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        className="u-mono u-ui grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary-ink"
                        aria-hidden="true"
                      >
                        01
                      </span>
                      <h3 className="u-h3 text-ink-1">{t("register.section.company")}</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ValidatedTextField
                        name="companyNameEn"
                        label={t("register.field.nameEn")}
                        required
                        minLength={2}
                        maxLength={100}
                        autoComplete="organization"
                      />
                      <ValidatedTextField
                        name="companyNameAr"
                        label={t("register.field.nameAr")}
                        minLength={2}
                        maxLength={100}
                        lang="ar"
                        dir="rtl"
                        placeholder={t("register.field.nameAr.placeholder")}
                      />
                      <ValidatedTextField
                        name="crNumber"
                        label={t("register.field.cr")}
                        required
                        minLength={5}
                        maxLength={30}
                      />
                      <ValidatedTextField
                        name="vatNumber"
                        label={t("register.field.vat")}
                        hint={t("register.field.vat.hint")}
                        maxLength={30}
                      />
                      <ValidatedSelectField
                        name="industry"
                        label={t("register.field.industry")}
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          {t("register.field.industry.select")}
                        </option>
                        {INDUSTRY_VALUES.map((v) => (
                          <option key={v} value={v}>
                            {t(INDUSTRY_LABELS[v])}
                          </option>
                        ))}
                      </ValidatedSelectField>
                      <ValidatedSelectField
                        name="companySize"
                        label={t("register.field.size")}
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          {t("register.field.size.select")}
                        </option>
                        {COMPANY_SIZE_VALUES.map((v) => (
                          <option key={v} value={v}>
                            {t(COMPANY_SIZE_LABELS[v])}
                          </option>
                        ))}
                      </ValidatedSelectField>
                      <ValidatedSelectField
                        name="country"
                        label={t("register.field.country")}
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          {t("register.field.country.select")}
                        </option>
                        {COUNTRY_OPTIONS.map(([code, name]) => (
                          <option key={code} value={code}>
                            {COUNTRY_LABELS[code] ? t(COUNTRY_LABELS[code]!) : name}
                          </option>
                        ))}
                      </ValidatedSelectField>
                      <ValidatedTextField
                        name="city"
                        label={t("register.field.city")}
                        required
                        minLength={2}
                        maxLength={50}
                        autoComplete="address-level2"
                      />
                    </div>
                  </section>

                  <section>
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        className="u-mono u-ui grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary-ink"
                        aria-hidden="true"
                      >
                        02
                      </span>
                      <h3 className="u-h3 text-ink-1">{t("register.section.admin")}</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ValidatedTextField
                        name="firstName"
                        label={t("register.field.firstName")}
                        required
                        minLength={2}
                        maxLength={50}
                        autoComplete="given-name"
                      />
                      <ValidatedTextField
                        name="lastName"
                        label={t("register.field.lastName")}
                        required
                        minLength={2}
                        maxLength={50}
                        autoComplete="family-name"
                      />
                      <ValidatedTextField
                        type="email"
                        name="email"
                        label={t("register.field.email")}
                        required
                        autoComplete="email"
                      />
                      <ValidatedTextField
                        type="tel"
                        name="phone"
                        label={t("register.field.phone")}
                        hint={t("register.field.phone.hint")}
                        pattern="\+[1-9][0-9]{7,14}"
                        autoComplete="tel"
                      />
                      {/* The show-password toggle's name comes from the identity copy,
                      the one place the storefront's sign-in and registration forms
                      share it, so all three forms say it the same way. */}
                      <ValidatedPasswordField
                        name="password"
                        label={t("register.field.password")}
                        hint={t("register.field.password.hint")}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        revealLabel={identityCopy(toIdentityLocale(locale)).passwordReveal.label}
                      />
                      <ValidatedSelectField
                        name="language"
                        label={t("register.field.language")}
                        defaultValue={locale === "ar" ? "AR" : "EN"}
                      >
                        {LANGUAGE_VALUES.map((v) => (
                          <option key={v} value={v}>
                            {t(LANGUAGE_LABELS[v])}
                          </option>
                        ))}
                      </ValidatedSelectField>
                    </div>
                  </section>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Button type="submit" variant="primary">
                      {t("register.submit")}
                    </Button>
                    {/* The alternative to pressing the button, beside the button.
                      This line used to sit outside the form entirely, below it;
                      the moment a reader realises they already have an account
                      is the moment they are looking at the submit, so that is
                      where the other route has to be. */}
                    <p className="u-ui text-ink-2">
                      {t("register.haveAccount")}{" "}
                      <Link
                        href={SIGN_IN_HREF}
                        className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
                      >
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

          <aside className="space-y-5 lg:col-span-4">
            <Surface
              rung={2}
              className="overflow-hidden border-primary/30 bg-primary text-primary-foreground"
            >
              <div className="p-5 sm:p-6">
                <h2 className="u-h2 max-w-[18ch] text-primary-foreground">
                  {t("register.process.title")}
                </h2>
                <ol className="mt-5 divide-y divide-primary-foreground/15">
                  {[
                    ["register.process.company", "register.process.company.desc"],
                    ["register.process.review", "register.process.review.desc"],
                    ["register.process.open", "register.process.open.desc"],
                  ].map(([titleKey, descKey], index) => (
                    <li
                      key={titleKey}
                      className="grid grid-cols-[2.4rem_minmax(0,1fr)] gap-3 py-3.5 first:pt-0 last:pb-0"
                    >
                      <span
                        className="u-mono u-ui grid h-9 w-9 place-items-center rounded-full border border-primary-foreground/20 text-primary-foreground/75"
                        aria-hidden="true"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong className="u-ui block font-semibold text-primary-foreground">
                          {t(titleKey as B2BKey)}
                        </strong>
                        <span className="u-meta mt-1 block text-primary-foreground/70">
                          {t(descKey as B2BKey)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="u-provenance mt-5 border-t border-primary-foreground/15 pt-4 !text-primary-foreground/70">
                  {t("register.process.basis")}
                </p>
              </div>
            </Surface>

            <Surface rung={1} className="p-5 sm:p-6">
              <h2 className="u-h3 text-ink-1">{t("register.requirements.title")}</h2>
              <ul className="mt-4 space-y-4">
                {[
                  ["register.requirements.cr", "register.requirements.cr.desc", FileText],
                  ["register.requirements.admin", "register.requirements.admin.desc", Users],
                  [
                    "register.requirements.location",
                    "register.requirements.location.desc",
                    Building2,
                  ],
                ].map(([titleKey, descKey, Icon]) => (
                  <li key={titleKey as string} className="flex gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <strong className="u-ui block font-semibold text-ink-1">
                        {t(titleKey as B2BKey)}
                      </strong>
                      <span className="u-meta mt-1 block text-ink-2">{t(descKey as B2BKey)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Surface>
          </aside>
        </section>
      </div>
    </MainLayout>
  );
}
