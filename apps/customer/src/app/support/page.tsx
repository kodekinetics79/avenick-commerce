import { cookies } from "next/headers";
import Link from "next/link";
import { MessageSquare, Clock, CheckCircle2, Activity, ChevronDown, Mail, LogIn, LifeBuoy } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { auth } from "@/lib/auth-instance";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { createTicket } from "./actions";
import { cookieHeaderFromStore, fetchBackendJsonWithCookies } from "@/lib/backend";
import { platformContacts, platformName } from "@avenick/utils/portal-config";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  Input,
  PageHeader,
  StatusPill,
  Surface,
  Textarea,
  type PillTone,
} from "@avenick/ui";
import { IDENTITY_LABEL_CLASS, IdentitySelect } from "../auth/identity-controls";
import { LOCALE_COOKIE, toIdentityLocale } from "../auth/identity-copy";

/**
 * The tab title is a user-visible string like any other, and it was the last
 * English literal on this route: an Arabic reader's
 * browser tab read "Support & Help Center" above a fully Arabic page. `metadata` is a static
 * export and cannot read a cookie, so it becomes `generateMetadata` — the same
 * accessor every other string on this track already uses. The route was already
 * dynamic (force-dynamic), so this adds no rendering cost.
 */
export async function generateMetadata() {
  const isAr = toIdentityLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "ar";
  return {
    title: `${isAr ? "مركز المساعدة والدعم" : "Help centre"} — ${platformName()}`,
  };
}

export const dynamic = "force-dynamic";

/**
 * THE KEY IS THE STORED VALUE — `SupportTicket.status` — and it never
 * localises; only the label does. A localised status written back to the column
 * would be a data defect wearing a translation.
 *
 * The label used to be baked into this map as one English string, so an Arabic
 * reader watched their own ticket sit at "In progress" beside six Arabic lines.
 * That is the half-translated tell: it says the Arabic build is a setting rather
 * than a design.
 */
const STATUS: Record<string, { tone: PillTone; icon: typeof Clock }> = {
  OPEN: { tone: "warning", icon: Clock },
  IN_PROGRESS: { tone: "accent", icon: Activity },
  RESOLVED: { tone: "success", icon: CheckCircle2 },
  CLOSED: { tone: "neutral", icon: CheckCircle2 },
};

const STATUS_LABELS: Record<"en" | "ar", Record<string, string>> = {
  en: { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved", CLOSED: "Closed" },
  ar: { OPEN: "مفتوحة", IN_PROGRESS: "قيد المعالجة", RESOLVED: "تمت المعالجة", CLOSED: "مغلقة" },
};

const CATEGORIES = ["ORDER", "DELIVERY", "PAYMENT", "PRODUCT", "ACCOUNT", "OTHER"];

/** Display only. The KEY is what SupportTicket.category stores. */
const CATEGORY_LABELS: Record<"en" | "ar", Record<string, string>> = {
  en: {
    ORDER: "Order",
    DELIVERY: "Delivery",
    PAYMENT: "Payment",
    PRODUCT: "Product",
    ACCOUNT: "Account",
    OTHER: "Other",
  },
  ar: {
    ORDER: "طلب",
    DELIVERY: "توصيل",
    PAYMENT: "دفع",
    PRODUCT: "منتج",
    ACCOUNT: "حساب",
    OTHER: "أخرى",
  },
};

/**
 * The category as a person reads it, in both the picker and the ticket row.
 * The row used to print the raw enum — "ORDER" — which is an English database
 * value shown to an Arabic reader, and shouted at an English one.
 */
function categoryLabel(value: string, locale: "en" | "ar"): string {
  return CATEGORY_LABELS[locale][value] ?? value;
}

// The brand name is read from the resolver so a renamed deployment does not
// keep answering "what is <old name>?" in its own help centre.
const FAQS = [
  {
    qEn: `What is ${platformName()}?`,
    qAr: `ما هي منصة ${platformName()}؟`,
    aEn: `${platformName()} is a B2B and B2C procurement platform connecting approved suppliers with buyers for industrial supply, tools, and office procurement.`,
    aAr: `${platformName()} هي منصة مشتريات للشركات والأفراد تربط الموردين المعتمدين بالمشترين لتوريد المنتجات الصناعية والأدوات والمستلزمات المكتبية.`
  },
  {
    qEn: "How do I request a bulk quote (RFQ)?",
    qAr: "كيف يمكنني طلب عرض سعر للكميات الكبيرة (RFQ)؟",
    aEn: "To request a bulk quote, log in and open the RFQ portal. Enter the item, quantity, and delivery requirements. The portal will show the quotes actually submitted for your request.",
    aAr: "لطلب عرض سعر للكميات، سجل الدخول وافتح بوابة طلبات عروض الأسعار. أدخل المنتج والكمية ومتطلبات التسليم، وستعرض البوابة العروض المقدمة فعلياً لطلبك."
  },
  {
    qEn: "What are the shipping times and coverage areas?",
    qAr: "ما هي أوقات الشحن ومناطق التغطية؟",
    aEn: "Coverage, delivery timing, charges, and tracking availability are confirmed for each order during processing. The storefront does not promise a carrier or delivery window before confirmation.",
    aAr: "يتم تأكيد نطاق التوصيل والمدة والرسوم وإمكانية التتبع لكل طلب أثناء المعالجة. ولا يعد المتجر بناقل أو مدة توصيل قبل التأكيد."
  },
  {
    qEn: "Can my company pay using credit or net terms?",
    qAr: "هل يمكن لشركتي الدفع باستخدام الائتمان أو شروط الدفع الآجل؟",
    aEn: "Only payment terms already approved and displayed on the active company account may be used. New credit terms are unavailable until a reviewed approval workflow is enabled.",
    aAr: "لا يمكن استخدام سوى شروط الدفع المعتمدة والظاهرة في حساب الشركة النشط. ولا تتاح شروط ائتمانية جديدة حتى يتم تفعيل مسار موافقة خاضع للمراجعة."
  }
];

// Tickets arrive through the JSON API, so createdAt is an ISO string, not a
// Date; formatting it without parsing threw for every user who had a ticket.
//
// ONE NUMERAL SYSTEM, WESTERN, IN BOTH LOCALES — DESIGN_SYSTEM.md §2.3.
// `ar-AE-u-nu-latn` is what pins it: without the extension the Arabic build
// prints Arabic-Indic digits here and Western digits in every figure beside it.
// The locale was hardcoded to "en-US", so an Arabic reader's own ticket was
// dated in English on an otherwise Arabic page.
const fmt = (d: string | Date, locale: "en" | "ar") =>
  new Date(d).toLocaleDateString(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default async function SupportPage() {
  const cookieStore = await cookies();
  // The same accessor every other page on this track uses, so the support page
  // and the account pages can never disagree about which language they are in.
  const locale = toIdentityLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const isAr = locale === "ar";
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  // The support mailbox is deployment configuration. When none is configured
  // the card is omitted: printing an address nobody reads is worse than none.
  const supportEmail = platformContacts().support;

  const tickets = userId
    ? await fetchBackendJsonWithCookies<any[]>("/api/support", undefined, cookieHeaderFromStore(cookieStore))
    : [];

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-block">
        <PageHeader
          eyebrow={isAr ? "مركز المساعدة والدعم" : "Help centre"}
          title={isAr ? "كيف يمكننا مساعدتك؟" : "How can we help?"}
          description={
            isAr
              ? "ابحث عن إجابات للأسئلة الشائعة أو افتح تذكرة دعم وتابع حالتها."
              : "Read the answers to the common questions, or open a support ticket and follow its status."
          }
          linkComponent={Link}
        />

        <div className="grid grid-cols-1 items-start gap-block lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* ── Answers ───────────────────────────────────────────────────── */}
          <section className="space-y-stack">
            <Eyebrow as="h2">{isAr ? "الأسئلة الشائعة" : "Frequently asked"}</Eyebrow>

            {/* One panel divided by hairlines, and each question is a real
                <details> disclosure — four answers open at once was four walls of
                text to scroll past to reach the one you wanted. No JavaScript is
                involved, so it works before hydration and with scripting off. */}
            <Surface rung={2} className="overflow-hidden">
              {FAQS.map((faq, idx) => (
                <details
                  key={idx}
                  className={`${idx > 0 ? "border-t border-hairline" : ""} [&[open]_[data-disclosure-mark]]:rotate-180`}
                >
                  <summary className="u-focus u-state-wash flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    <span className="u-ui font-medium text-ink-1">{isAr ? faq.qAr : faq.qEn}</span>
                    {/* Marked rather than selected as "any svg in an open
                        details", so an icon inside an answer can never be
                        rotated by the disclosure. */}
                    <ChevronDown
                      data-disclosure-mark
                      className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-press ease-standard"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="u-body max-w-prose px-4 pb-4 text-ink-2">{isAr ? faq.aAr : faq.aEn}</p>
                </details>
              ))}
            </Surface>

            {/* No response-time promise anywhere on this page: the platform
                measures no support SLA, so none is stated. */}
            {supportEmail && (
              <Surface rung={2} className="p-5">
                <Eyebrow>{isAr ? "البريد الإلكتروني" : "Email"}</Eyebrow>
                <p className="mt-1.5 flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <a
                    href={`mailto:${supportEmail}`}
                    className="u-focus u-ui rounded-nested break-all font-medium text-primary-ink hover:underline"
                  >
                    {supportEmail}
                  </a>
                </p>
                <Dateline className="mt-2">
                  {isAr
                    ? "لا يقيس النظام مدة الرد، لذا لا يُذكر أي وعد بذلك"
                    : "No response time is stated because none is measured"}
                </Dateline>
              </Surface>
            )}
          </section>

          {/* ── Tickets ───────────────────────────────────────────────────── */}
          <section className="space-y-stack">
            {userId ? (
              <>
                <Surface rung={2} className="p-5">
                  <Eyebrow as="h2">{isAr ? "إنشاء تذكرة دعم" : "Open a ticket"}</Eyebrow>

                  <ValidatedForm action={createTicket} className="mt-4 space-y-3">
                    {/* Every control had a placeholder and no label, so a screen
                        reader announced an unnamed edit field and the hint
                        vanished the moment anyone typed. */}
                    <Input
                      id="ticket-subject"
                      name="subject"
                      label={isAr ? "الموضوع" : "Subject"}
                      required
                    />
                    <IdentitySelect
                      id="ticket-category"
                      name="category"
                      label={isAr ? "التصنيف" : "Category"}
                    >
                      {/* The VALUE is the stored SupportTicket.category and never
                          localises; only the label does. A localised value in a
                          column is a data defect that looks like a translation. */}
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {categoryLabel(c, locale)}
                        </option>
                      ))}
                    </IdentitySelect>
                    <Input
                      id="ticket-order-ref"
                      name="orderRef"
                      label={isAr ? "رقم مرجع الطلب" : "Order reference"}
                      hint={isAr ? "اختياري" : "Optional."}
                    />
                    <div>
                      <label htmlFor="ticket-description" className={IDENTITY_LABEL_CLASS}>
                        {isAr ? "تفاصيل المشكلة" : "What happened"}
                      </label>
                      <Textarea
                        id="ticket-description"
                        name="description"
                        required
                        rows={4}
                        placeholder={isAr ? "اشرح المشكلة بالتفصيل…" : "Describe your issue…"}
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      {isAr ? "إرسال التذكرة" : "Submit ticket"}
                    </Button>
                  </ValidatedForm>
                </Surface>

                <div>
                  <Eyebrow as="h2" className="mb-2">
                    {isAr ? "تذاكري" : "My tickets"}
                  </Eyebrow>
                  <Surface rung={2} className="overflow-hidden">
                    {tickets.length === 0 ? (
                      <EmptyState
                        eyebrow={isAr ? "لا يوجد سجل" : "Nothing recorded"}
                        headline={
                          isAr
                            ? "لا توجد تذاكر دعم على هذا الحساب."
                            : "No support tickets on this account."
                        }
                        body={
                          isAr
                            ? "ستظهر التذاكر هنا فور إرسالها."
                            : "A ticket appears here as soon as it is submitted."
                        }
                        icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />}
                      />
                    ) : (
                      <ul>
                        {tickets.map((t) => {
                          const st = STATUS[t.status] ?? STATUS.OPEN;
                          return (
                            <li key={t.id} className="border-t border-hairline p-4 first:border-t-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  {/* dir="ltr" on every mono reference, as the orders and returns
                                      rows already do: a reference is a reference in both
                                      languages, and leaving it to inherit the paragraph
                                      direction is how a hyphenated ticket number comes out
                                      reordered under the bidi algorithm. */}
                                  <p className="u-mono u-meta text-ink-2" dir="ltr">{t.ticketNumber}</p>
                                  <p className="u-ui mt-0.5 truncate font-medium text-ink-1">{t.subject}</p>
                                </div>
                                <StatusPill tone={st.tone} className="shrink-0">
                                  <st.icon className="h-3 w-3" aria-hidden="true" />{" "}
                                  {STATUS_LABELS[locale][t.status] ?? t.status}
                                </StatusPill>
                              </div>
                              <p className="u-body mt-1.5 line-clamp-2 text-ink-2">{t.description}</p>
                              <p className="u-meta mt-1.5 text-ink-3">
                                {categoryLabel(t.category, locale)} ·{" "}
                                {isAr ? "تم الإنشاء في" : "opened"} {fmt(t.createdAt, locale)}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Surface>
                </div>
              </>
            ) : (
              // THE CERTIFICATE. With no session this IS the whole column, so it
              // is composed rather than apologised for: brass hairline across
              // the top edge, ledger ruling behind, a cropped glyph bleeding off
              // the outer corner (inset-inline-end, so it crops from the correct
              // corner in Arabic), and exactly one real action.
              <EmptyState
                variant="certificate"
                glyph={<LifeBuoy />}
                eyebrow={isAr ? "يلزم تسجيل الدخول" : "Sign in required"}
                headline={
                  isAr
                    ? "ترتبط تذاكر الدعم بالحساب الذي فتحها."
                    : "A support ticket belongs to the account that opened it."
                }
                // A SupportTicket row has a subject, a category, a description
                // and a status. There is no reply, message or response column in
                // schema.prisma and none is rendered below, so this may not
                // offer to show replies.
                body={
                  isAr
                    ? "سجّل الدخول لفتح تذكرة ومتابعة الحالة المسجّلة عليها."
                    : "Sign in to open a ticket and follow the status recorded against it."
                }
                action={
                  <Button variant="primary" asChild>
                    <Link href="/login?callbackUrl=/support">
                      {/* Directional glyph — mirrors, and by -scale-x rather than rotate so it
                        does not also turn upside down. */}
                      <LogIn className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" />
                      {isAr ? "تسجيل الدخول" : "Sign in"}
                    </Link>
                  </Button>
                }
              />
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
