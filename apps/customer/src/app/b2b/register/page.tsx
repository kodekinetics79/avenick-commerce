import Link from "next/link";
import { headers } from "next/headers";
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
import { MainLayout } from "@/components/layout/main-layout";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { auth, signOut } from "@/lib/auth-instance";
import { isDurableB2BMember } from "@/lib/b2b-access";
import type { B2BActionState } from "@/lib/b2b";
import { backendUrl, requestBaseUrl } from "@/lib/backend";
import { SUPPORTED_COUNTRIES } from "@/lib/market-context";
import { platformName } from "@avenick/utils/portal-config";

export const dynamic = "force-dynamic";
export const metadata = { title: `Register your business — ${platformName()} for Business` };

// Each line describes a capability the portal implements, in the terms the
// product actually uses. No "exclusive discounts" and no Net-30/60/90: payment
// terms are whatever is recorded on an approved company account, and there is
// no self-service credit application (see the Terms of Service).
const FEATURES = [
  { icon: TrendingUp, title: "B2B Pricing", desc: "Quantity-based B2B prices where suppliers publish them" },
  { icon: FileText, title: "Purchase Orders", desc: "Create and manage POs with approval workflows" },
  { icon: Users, title: "Team Management", desc: "Add buyers with role-based spend limits" },
  { icon: ShieldCheck, title: "Payment Terms", desc: "Terms approved for your company are applied at checkout" },
];

/*
 * Option labels.
 *
 * Each map is keyed by the Prisma enum type, so a value added to or renamed in
 * schema.prisma fails the build here instead of silently disappearing from the
 * form — the same drift that made four of the old form's industries unstorable
 * and six of the database's industries unreachable. The values themselves come
 * from @avenick/types, which is checked against the same Prisma enums.
 */
const INDUSTRY_LABELS: Record<Industry, string> = {
  INDUSTRIAL_SUPPLIES: "Industrial supplies",
  ELECTRONICS: "Electronics",
  OFFICE_SUPPLIES: "Office supplies",
  SAFETY_PPE: "Safety & PPE",
  FOOD_HOSPITALITY: "Food & hospitality",
  BUILDING_MATERIALS: "Building materials",
  HEALTHCARE: "Healthcare",
  RETAIL: "Retail",
  MANUFACTURING: "Manufacturing",
  TECHNOLOGY: "Technology",
  OTHER: "Other",
};

// Headcount bands are the conventional reading of these buckets, shown so the
// choice means something at the point of entry. Only the enum value is stored.
const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  MICRO: "Micro — 1–9 employees",
  SMALL: "Small — 10–49 employees",
  MEDIUM: "Medium — 50–249 employees",
  LARGE: "Large — 250–999 employees",
  ENTERPRISE: "Enterprise — 1,000+ employees",
};

const LANGUAGE_LABELS: Record<Language, string> = {
  AR: "العربية — Arabic",
  EN: "English",
};

// The markets Avenick sells in. The annotation makes a code that is not a Prisma
// `Country` — a typo, or a market added without the matching enum value — a
// typecheck error rather than a 500 on INSERT.
const COUNTRY_OPTIONS: readonly (readonly [Country, string])[] = SUPPORTED_COUNTRIES;

const FIELD_CLASS =
  "h-10 w-full px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

type RegisterResponse = {
  success?: boolean;
  error?: string;
  data?: { companyStatus?: string };
};

/**
 * Submit the company + admin-user registration.
 *
 * This posts to /api/auth/register/business rather than writing the rows here so
 * that the transaction, the rate limit and the duplicate handling have exactly
 * one implementation — the same endpoint /register uses.
 */
async function registerBusinessAction(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  "use server";

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
    return { error: "Registration is temporarily unavailable: the application origin could not be resolved." };
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
    return { error: "Could not reach the registration service. Please try again in a moment." };
  }

  if (!res.ok || json?.success !== true) {
    // The endpoint names the field and the reason; show that, not a stand-in.
    return { error: json?.error ?? `Registration failed (HTTP ${res.status}). Please try again.` };
  }

  // The confirmation screen describes a company awaiting verification. If the
  // row came back in any other state, report the state instead of showing a
  // screen that contradicts it.
  if (json.data?.companyStatus === "PENDING_VERIFICATION") {
    redirect("/b2b/register?submitted=1");
  }
  return {
    ok: true,
    message: `Business account created (company status: ${json.data?.companyStatus ?? "unreported"}). Sign in to continue.`,
  };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Notice({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Building2;
  tone: "info" | "warning" | "success";
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    info: "border-border bg-card text-foreground",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  } as const;
  return (
    <div className={`rounded-2xl border p-6 ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-base">{title}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function B2BRegisterPage({
  searchParams,
}: {
  searchParams: { submitted?: string };
}) {
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
            <Notice icon={Clock} tone="warning" title={`${company.nameEn} is awaiting verification`}>
              <p>
                The company account was created on{" "}
                {company.createdAt.toISOString().slice(0, 10)} and is in review. {platformName()} checks the
                commercial registration before B2B pricing, purchase orders, credit terms and team
                accounts are switched on, so the business workspace stays closed until then.
              </p>
              <p>
                There is nothing further to submit here, and you do not need to register again — this
                page opens the workspace as soon as the company is approved.
              </p>
            </Notice>
          ) : suspended ? (
            <Notice icon={AlertCircle} tone="warning" title={`${company.nameEn} is not active`}>
              <p>
                This company account is currently {company.deletedAt ? "closed" : "suspended"}, so the
                B2B workspace is unavailable. Personal shopping is unaffected.
              </p>
            </Notice>
          ) : (
            <Notice icon={AlertCircle} tone="warning" title={`Your access to ${company.nameEn} is inactive`}>
              <p>
                The company is active, but your membership is not — a company administrator can
                re-enable it, or restore your buyer role if it was changed.
              </p>
            </Notice>
          )}

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/products" className="rounded-xl border border-border px-4 py-2 font-semibold hover:border-primary/40">
              Browse the catalogue
            </Link>
            <Link href="/support" className="rounded-xl border border-border px-4 py-2 font-semibold hover:border-primary/40">
              Ask support about this account
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (searchParams.submitted === "1") {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 space-y-4">
          <Notice icon={CheckCircle2} tone="success" title="Registration submitted">
            <p>
              The company and its administrator account have been created. New company accounts are
              reviewed before B2B pricing, purchase orders and credit terms are enabled.
            </p>
            <p>Sign in to see the current verification status of your company.</p>
          </Notice>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/login" className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90">
              Sign in
            </Link>
            <Link href="/products" className="rounded-xl border border-border px-4 py-2 font-semibold hover:border-primary/40">
              Browse the catalogue
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm mb-4">
            <Building2 className="h-4 w-4" />
            B2B Marketplace — للشركات
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Grow Your Business with {platformName()}
            <span className="block text-2xl font-normal text-muted-foreground mt-2">طوّر أعمالك مع {platformName()}</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Source from GCC suppliers with B2B pricing, purchase orders, and approval workflows built in.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-border p-6 text-center">
              <f.icon className="h-8 w-8 mx-auto text-primary/100 mb-3" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        {userId ? (
          <div className="mb-6">
            <Notice icon={AlertCircle} tone="info" title="You are signed in to a personal account">
              <p>
                Registering a business creates a new company and a new administrator login, so it needs
                an email address that is not already in use. Sign out first to continue.
              </p>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/b2b/register" });
                }}
              >
                <button type="submit" className="mt-1 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary/40">
                  Sign out
                </button>
              </form>
            </Notice>
          </div>
        ) : null}

        {/* Registration */}
        <div id="register" className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Create a business account</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You become the company administrator. Every field marked optional can be added later from
              the company profile.
            </p>
          </div>

          <ValidatedForm action={registerBusinessAction} className="space-y-6">
            <section className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Company</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Company name (English)">
                  <input name="companyNameEn" required minLength={2} maxLength={100} autoComplete="organization" placeholder="Gulf Industrial Trading LLC" className={FIELD_CLASS} />
                </Field>
                <Field label="Company name (Arabic) — optional">
                  <input name="companyNameAr" minLength={2} maxLength={100} dir="rtl" placeholder="اسم الشركة بالعربي" className={FIELD_CLASS} />
                </Field>
                <Field label="Commercial registration number">
                  <input name="crNumber" required minLength={5} maxLength={30} placeholder="CN-1234567" className={FIELD_CLASS} />
                </Field>
                <Field label="VAT number — optional" hint="Add it now to have tax invoices issued against it.">
                  <input name="vatNumber" maxLength={30} placeholder="100123456700003" className={FIELD_CLASS} />
                </Field>
                <Field label="Industry">
                  <select name="industry" required defaultValue="" className={FIELD_CLASS}>
                    <option value="" disabled>Select an industry</option>
                    {INDUSTRY_VALUES.map((v) => (
                      <option key={v} value={v}>{INDUSTRY_LABELS[v]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Company size">
                  <select name="companySize" required defaultValue="" className={FIELD_CLASS}>
                    <option value="" disabled>Select a company size</option>
                    {COMPANY_SIZE_VALUES.map((v) => (
                      <option key={v} value={v}>{COMPANY_SIZE_LABELS[v]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Country">
                  <select name="country" required defaultValue="" className={FIELD_CLASS}>
                    <option value="" disabled>Select a country</option>
                    {COUNTRY_OPTIONS.map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="City">
                  <input name="city" required minLength={2} maxLength={50} autoComplete="address-level2" placeholder="Dubai" className={FIELD_CLASS} />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Company administrator</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="First name">
                  <input name="firstName" required minLength={2} maxLength={50} autoComplete="given-name" className={FIELD_CLASS} />
                </Field>
                <Field label="Last name">
                  <input name="lastName" required minLength={2} maxLength={50} autoComplete="family-name" className={FIELD_CLASS} />
                </Field>
                <Field label="Work email">
                  <input type="email" name="email" required autoComplete="email" placeholder="you@company.com" className={FIELD_CLASS} />
                </Field>
                <Field label="Phone — optional" hint="International format, e.g. +9715xxxxxxx.">
                  <input type="tel" name="phone" pattern="\+[1-9][0-9]{7,14}" autoComplete="tel" placeholder="+9715xxxxxxx" className={FIELD_CLASS} />
                </Field>
                <Field label="Password" hint="At least 8 characters, with one uppercase letter and one number.">
                  <input type="password" name="password" required minLength={8} autoComplete="new-password" className={FIELD_CLASS} />
                </Field>
                <Field label="Preferred language">
                  <select name="language" defaultValue="EN" className={FIELD_CLASS}>
                    {LANGUAGE_VALUES.map((v) => (
                      <option key={v} value={v}>{LANGUAGE_LABELS[v]}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-[0.98]">
                Create business account
              </button>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Accounts are reviewed before B2B pricing and credit terms are enabled.
              </p>
            </div>
          </ValidatedForm>

          <p className="text-center text-sm text-muted-foreground mt-5">
            Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
