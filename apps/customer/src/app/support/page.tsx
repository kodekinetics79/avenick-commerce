import { cookies } from "next/headers";
import Link from "next/link";
import { MessageSquare, Plus, Clock, CheckCircle2, Activity, Lock, Mail, HelpCircle, Shield } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { auth } from "@/lib/auth-instance";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { createTicket } from "./actions";
import { cookieHeaderFromStore, fetchBackendJsonWithCookies } from "@/lib/backend";
import { platformContacts, platformName } from "@avenick/utils/portal-config";

export const metadata = { title: `Support & Help Center — ${platformName()}` };

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  IN_PROGRESS: { label: "In progress", cls: "bg-primary/15 text-primary", icon: Activity },
  RESOLVED: { label: "Resolved", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  CLOSED: { label: "Closed", cls: "bg-secondary text-muted-foreground", icon: CheckCircle2 },
};

const CATEGORIES = ["ORDER", "DELIVERY", "PAYMENT", "PRODUCT", "ACCOUNT", "OTHER"];

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
      <div className="relative overflow-hidden min-h-screen bg-background text-foreground py-10 lg:py-16">
        {/* Glowing visual accents */}
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-20 start-1/4 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-20 end-1/4 h-80 w-80 rounded-full bg-accent/10 blur-[120px]" />

        <div className="relative max-w-6xl mx-auto px-4">
          
          {/* Hero Header */}
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs font-semibold text-primary mb-3">
              <HelpCircle className="h-3.5 w-3.5" />
              {isAr ? "مركز المساعدة والدعم" : "Help Center & Support"}
            </span>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-3">
              {isAr ? "كيف يمكننا مساعدتك اليوم؟" : "How can we help you today?"}
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              {isAr 
                ? "ابحث عن إجابات سريعة للأسئلة الشائعة أو تواصل مع مسؤولي الدعم الفني مباشرة." 
                : "Find answers to common questions or open a support ticket."}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
            
            {/* Left Column: FAQs & Contact Info */}
            <div className="space-y-8">
              
              {/* Contact Information Cards — no response-time promise: the
                  platform measures no support SLA, so none is stated. */}
              {supportEmail && (
                <div className="bg-card/40 backdrop-blur-md border border-border/80 rounded-2xl p-6">
                  <h2 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    {isAr ? "قنوات الاتصال المباشر" : "Direct Contact Channels"}
                  </h2>
                  <div className="grid gap-4">
                    <div className="bg-secondary/30 rounded-xl p-4 border border-border/40 hover:border-primary/20 transition-all">
                      <Mail className="h-5 w-5 text-primary mb-2" />
                      <p className="text-xs text-muted-foreground mb-1">{isAr ? "البريد الإلكتروني" : "Email us"}</p>
                      <a href={`mailto:${supportEmail}`} className="font-semibold text-sm text-primary hover:underline break-all">{supportEmail}</a>
                    </div>
                  </div>
                </div>
              )}

              {/* FAQs Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  {isAr ? "الأسئلة الأكثر شيوعاً" : "Frequently Asked Questions"}
                </h2>
                <div className="space-y-4">
                  {FAQS.map((faq, idx) => (
                    <div key={idx} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/20 transition-all">
                      <h3 className="font-bold text-sm lg:text-base text-foreground mb-2 flex items-start gap-2">
                        <span className="text-primary font-mono font-bold">Q.</span>
                        {isAr ? faq.qAr : faq.qEn}
                      </h3>
                      <p className="text-muted-foreground text-xs lg:text-sm leading-relaxed ps-5">
                        {isAr ? faq.aAr : faq.aEn}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Support Tickets */}
            <div className="space-y-6">
              
              {userId ? (
                /* Authenticated User: Ticket Creation & List */
                <div className="space-y-6">
                  {/* Create Ticket */}
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
                    <div className="flex items-center gap-2 text-sm font-semibold mb-4 text-foreground">
                      <Plus className="h-4 w-4 text-primary" />
                      {isAr ? "إنشاء تذكرة دعم جديدة" : "Open a support ticket"}
                    </div>
                    
                    <ValidatedForm action={createTicket} className="space-y-3">
                      <div className="space-y-3">
                        <input 
                          name="subject" 
                          required 
                          placeholder={isAr ? "الموضوع" : "Subject"} 
                          className="w-full h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" 
                        />
                        <select 
                          name="category" 
                          aria-label="Category" 
                          className="w-full h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c.charAt(0) + c.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </select>
                        <input 
                          name="orderRef" 
                          placeholder={isAr ? "رقم مرجع الطلب (اختياري)" : "Order reference (optional)"} 
                          className="w-full h-10 px-3 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" 
                        />
                        <textarea 
                          name="description" 
                          required 
                          rows={4} 
                          placeholder={isAr ? "اشرح المشكلة بالتفصيل..." : "Describe your issue…"} 
                          className="w-full px-3 py-2.5 text-sm rounded-xl bg-secondary/60 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" 
                        />
                        <button 
                          type="submit" 
                          className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]"
                        >
                          {isAr ? "إرسال التذكرة" : "Submit Ticket"}
                        </button>
                      </div>
                    </ValidatedForm>
                  </div>

                  {/* My Tickets List */}
                  <div>
                    <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider mb-3">
                      {isAr ? "تذاكر الدعم الخاصة بي" : "My tickets"}
                    </h2>
                    {tickets.length === 0 ? (
                      <div className="rounded-2xl border border-border bg-card text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-xs">{isAr ? "لا توجد تذاكر حالية" : "No tickets yet."}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tickets.map((t) => {
                          const st = STATUS[t.status] ?? STATUS.OPEN!;
                          return (
                            <div key={t.id} className="rounded-2xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-mono text-primary font-semibold">{t.ticketNumber}</span>
                                    <span className="text-[9px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">{t.category}</span>
                                  </div>
                                  <p className="font-medium text-xs lg:text-sm truncate text-foreground">{t.subject}</p>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{t.description}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1.5">{isAr ? "تم الإنشاء في" : "Opened"} {fmt(t.createdAt)}</p>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${st.cls}`}>
                                  <st.icon className="h-3 w-3" /> {st.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Unauthenticated User: Lock & Login Card */
                <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 text-center shadow-card flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
                    <Lock className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-bold text-base text-foreground mb-2">
                    {isAr ? "تقديم تذكرة دعم فني" : "Submit a support ticket"}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-6 max-w-sm">
                    {isAr 
                      ? "هل تحتاج لمساعدة مخصصة بشأن طلب أو حساب؟ يرجى تسجيل الدخول لتقديم تذكرة وتتبعها." 
                      : "Need personalized help with an order or account? Sign in to open a support ticket and track its progress."}
                  </p>
                  <Link
                    href="/login?callbackUrl=/support"
                    className="w-full inline-flex items-center justify-center h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]"
                  >
                    {isAr ? "تسجيل الدخول" : "Sign In"}
                  </Link>
                </div>
              )}

            </div>

          </div>

        </div>
      </div>
    </MainLayout>
  );
}
