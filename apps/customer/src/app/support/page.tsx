import { cookies } from "next/headers";
import Link from "next/link";
import { MessageSquare, Clock, CheckCircle2, Activity, ChevronDown, Mail, LogIn } from "lucide-react";
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

export const metadata = { title: `Support & Help Center — ${platformName()}` };

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: PillTone; icon: typeof Clock }> = {
  OPEN: { label: "Open", tone: "warning", icon: Clock },
  IN_PROGRESS: { label: "In progress", tone: "accent", icon: Activity },
  RESOLVED: { label: "Resolved", tone: "success", icon: CheckCircle2 },
  CLOSED: { label: "Closed", tone: "neutral", icon: CheckCircle2 },
};

const CATEGORIES = ["ORDER", "DELIVERY", "PAYMENT", "PRODUCT", "ACCOUNT", "OTHER"];

/**
 * The recessed rung-1 control recipe, shared with the register and returns
 * forms. It wants to be a packages/ui primitive; that is a cross-track request.
 *
 * The focus ring comes from the .u-focus utility rather than a hand-written
 * shadow-[...] value. A page may not spell out a box-shadow of its own: five
 * rungs and one ring exist, and the first hand-rolled shadow in a page is what
 * lets a sixth appear.
 */
const CONTROL_CLASS =
  "u-focus w-full border border-input bg-surface-1 px-3 text-ui text-ink-1 outline-none " +
  "transition-[border-color,box-shadow] duration-press ease-standard";

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
const fmt = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function SupportPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("AVENICK_LOCALE")?.value ?? "en";
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
                  <summary className="u-focus flex cursor-pointer list-none items-center justify-between gap-3 p-4 transition-colors duration-press ease-standard hover:bg-ink-1/[0.03] [&::-webkit-details-marker]:hidden">
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
                  <p className="u-ui max-w-prose px-4 pb-4 text-ink-2">{isAr ? faq.aAr : faq.aEn}</p>
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
                    <div>
                      <label htmlFor="ticket-category" className="u-ui mb-1.5 block font-medium text-ink-1">
                        {isAr ? "التصنيف" : "Category"}
                      </label>
                      <select
                        id="ticket-category"
                        name="category"
                        data-rung={1}
                        className={CONTROL_CLASS}
                        style={{ height: "var(--control-h-md)" }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c.charAt(0) + c.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      id="ticket-order-ref"
                      name="orderRef"
                      label={isAr ? "رقم مرجع الطلب" : "Order reference"}
                      hint={isAr ? "اختياري" : "Optional."}
                    />
                    <div>
                      <label htmlFor="ticket-description" className="u-ui mb-1.5 block font-medium text-ink-1">
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
                                  <p className="u-mono u-meta text-ink-2">{t.ticketNumber}</p>
                                  <p className="u-ui mt-0.5 truncate font-medium text-ink-1">{t.subject}</p>
                                </div>
                                <StatusPill tone={st.tone} className="shrink-0">
                                  <st.icon className="h-3 w-3" aria-hidden="true" /> {st.label}
                                </StatusPill>
                              </div>
                              <p className="u-meta mt-1.5 line-clamp-2 text-ink-2">{t.description}</p>
                              <p className="u-meta mt-1.5 text-ink-3">
                                {t.category} · {isAr ? "تم الإنشاء في" : "opened"} {fmt(t.createdAt)}
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
              <Surface rung={2}>
                <EmptyState
                  eyebrow={isAr ? "يلزم تسجيل الدخول" : "Sign in required"}
                  headline={
                    isAr
                      ? "ترتبط تذاكر الدعم بالحساب الذي فتحها."
                      : "A support ticket belongs to the account that opened it."
                  }
                  // A SupportTicket row has a subject, a category, a
                  // description and a status. There is no reply, message or
                  // response column in schema.prisma and none is rendered
                  // below, so this may not offer to show replies.
                  body={
                    isAr
                      ? "سجّل الدخول لفتح تذكرة ومتابعة الحالة المسجلة عليها."
                      : "Sign in to open a ticket and follow the status recorded against it."
                  }
                  action={
                    <Button variant="primary" size="sm" asChild>
                      <Link href="/login?callbackUrl=/support">
                        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                        {isAr ? "تسجيل الدخول" : "Sign in"}
                      </Link>
                    </Button>
                  }
                />
              </Surface>
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
