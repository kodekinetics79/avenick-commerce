import { cookies } from "next/headers";
import Link from "next/link";
import { MessageSquare, Plus, Clock, CheckCircle2, Activity, Lock, Phone, Mail, MapPin, HelpCircle, Shield } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { auth } from "@/lib/auth-instance";
import { ValidatedForm } from "@/components/b2b/validated-form";
import { createTicket } from "./actions";
import { cookieHeaderFromStore, fetchBackendJsonWithCookies } from "@/lib/backend";

export const metadata = { title: "Support & Help Center — Avenick Commerce" };

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  IN_PROGRESS: { label: "In progress", cls: "bg-primary/15 text-primary", icon: Activity },
  RESOLVED: { label: "Resolved", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  CLOSED: { label: "Closed", cls: "bg-secondary text-muted-foreground", icon: CheckCircle2 },
};

const CATEGORIES = ["ORDER", "DELIVERY", "PAYMENT", "PRODUCT", "ACCOUNT", "OTHER"];

const FAQS = [
  {
    qEn: "What is Avenick Commerce?",
    qAr: "ما هي منصة أفينيك كومرس؟",
    aEn: "Avenick Commerce is the GCC's premier B2B and B2C procurement platform, connecting verified suppliers with buyers across the Gulf region for industrial supply, tools, and office procurement.",
    aAr: "أفينيك كومرس هي منصة المشتريات الرائدة في دول مجلس التعاون الخليجي للشركات والأفراد، حيث تربط الموردين المعتمدين بالمشترين عبر منطقة الخليج لتوريد المنتجات الصناعية والأدوات والمستلزمات المكتبية."
  },
  {
    qEn: "How do I request a bulk quote (RFQ)?",
    qAr: "كيف يمكنني طلب عرض سعر للكميات الكبيرة (RFQ)؟",
    aEn: "To request a bulk quote, log in to your account and click 'Get a Quote' or navigate to the RFQ portal. Fill out the item details, quantity, and delivery requirements. Multiple verified suppliers will submit competitive quotes for your review.",
    aAr: "لطلب عرض سعر للكميات، قم بتسجيل الدخول إلى حسابك وانقر على 'طلب عرض سعر' أو انتقل إلى منصة طلبات عروض الأسعار (RFQ). قم بتعبئة تفاصيل المنتجات والكمية ومتطلبات التسليم لتتلقى عروض أسعار تنافسية من موردين معتمدين."
  },
  {
    qEn: "What are the shipping times and coverage areas?",
    qAr: "ما هي أوقات الشحن ومناطق التغطية؟",
    aEn: "We deliver GCC-wide (UAE, Saudi Arabia, Qatar, Oman, Bahrain, Kuwait) using integrated 3PL logistics. Local delivery within major cities usually takes 1-3 business days, while cross-border GCC shipping takes 3-7 business days.",
    aAr: "نقوم بالتوصيل إلى جميع أنحاء دول مجلس التعاون الخليجي (الإمارات، السعودية، قطر، عمان، البحرين، الكويت) باستخدام خدمات لوجستية متكاملة. يستغرق التوصيل المحلي داخل المدن الكبرى عادةً من يوم إلى 3 أيام عمل، بينما يستغرق الشحن عبر الحدود من 3 إلى 7 أيام عمل."
  },
  {
    qEn: "Can my company pay using credit or net terms?",
    qAr: "هل يمكن لشركتي الدفع باستخدام الائتمان أو شروط الدفع الآجل؟",
    aEn: "Yes! Registered B2B companies can apply for trade credit (e.g. Net 30, Net 45 terms) by submitting their Commercial Registration (CR), VAT Certificate, and financial references through the B2B Company portal.",
    aAr: "نعم! يمكن للشركات المسجلة التقدم بطلب للحصول على تسهيلات ائتمانية تجارية (مثل شروط دفع بعد 30 أو 45 يوماً) من خلال تقديم السجل التجاري، شهادة ضريبة القيمة المضافة، والمراجع المالية عبر بوابة الشركات."
  }
];

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function SupportPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("AVENICK_LOCALE")?.value ?? "en";
  const isAr = locale === "ar";
  const session = await auth();
  const userId = session?.user?.id as string | undefined;

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
                : "Find instant answers to common questions or reach out to our dedicated support representatives."}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
            
            {/* Left Column: FAQs & Contact Info */}
            <div className="space-y-8">
              
              {/* Contact Information Cards */}
              <div className="bg-card/40 backdrop-blur-md border border-border/80 rounded-2xl p-6">
                <h2 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  {isAr ? "قنوات الاتصال المباشر" : "Direct Contact Channels"}
                </h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/40 hover:border-primary/20 transition-all">
                    <Phone className="h-5 w-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">{isAr ? "اتصل بنا" : "Call us"}</p>
                    <p className="font-semibold text-sm font-mono">+971 4 234 5678</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{isAr ? "الاثنين - الجمعة، ٩ - ٦" : "Mon - Fri, 9 AM - 6 PM"}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/40 hover:border-primary/20 transition-all">
                    <Mail className="h-5 w-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">{isAr ? "البريد الإلكتروني" : "Email us"}</p>
                    <a href="mailto:support@avenick.com" className="font-semibold text-sm text-primary hover:underline break-all">support@avenick.com</a>
                    <p className="text-[10px] text-muted-foreground mt-1">{isAr ? "الرد خلال ٢٤ ساعة" : "Response in 24 hours"}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/40 hover:border-primary/20 transition-all">
                    <MapPin className="h-5 w-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">{isAr ? "الموقع الرئيسي" : "Headquarters"}</p>
                    <p className="font-semibold text-xs leading-normal">Al Quoz Industrial, Dubai, UAE</p>
                  </div>
                </div>
              </div>

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
