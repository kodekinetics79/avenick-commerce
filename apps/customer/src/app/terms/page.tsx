import { cookies } from "next/headers";
import { Scale, Users, CreditCard, ShoppingBag, ShieldAlert, Award, HelpCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";

export const metadata = {
  title: "Terms of Service — Avenick Commerce",
  description: "Avenick Commerce terms of service, B2B procurement rules, and regulatory guidelines.",
};

export const dynamic = "force-dynamic";

interface LegalSection {
  id: string;
  titleEn: string;
  titleAr: string;
  contentEn: React.ReactNode;
  contentAr: React.ReactNode;
  icon: typeof Scale;
}

const SECTIONS: LegalSection[] = [
  {
    id: "terms",
    titleEn: "1. Acceptance of Terms",
    titleAr: "١. قبول الشروط والأحكام",
    icon: Scale,
    contentEn: (
      <>
        <p>By registering for, accessing, or using the Avenick Commerce B2B/B2C trading platform, you agree to be bound by these Terms of Service. These terms constitute a legally binding agreement between you (and your company, if registering as a business entity) and Avenick Commerce.</p>
        <p>If you do not agree with any part of these terms, you must not access the platform or use our services.</p>
      </>
    ),
    contentAr: (
      <>
        <p>من خلال التسجيل أو الوصول أو استخدام منصة أفينيك كومرس (Avenick Commerce) للتجارة، فإنكم توافقون على الالتزام بشروط الخدمة هذه. تشكل هذه الشروط اتفاقية ملزمة قانونياً بينكم (وبين شركتكم، في حال التسجيل ككيان تجاري) وبين المنصة.</p>
        <p>إذا كنتم لا توافقون على أي جزء من هذه الشروط، فيجب عليكم عدم الدخول إلى المنصة أو استخدام خدماتنا.</p>
      </>
    ),
  },
  {
    id: "accounts",
    titleEn: "2. Registration & Account Roles",
    titleAr: "٢. التسجيل وأدوار الحسابات",
    icon: Users,
    contentEn: (
      <>
        <p>To access the B2B portal, businesses must submit a valid Commercial Registration (CR) and VAT certificate. You represent that all details provided are accurate and authorize Avenick to conduct KYC checks.</p>
        <p>Companies can invite team members and delegate specific roles: Company Admin, Company Buyer, and Company Approver. The company assumes full liability for all purchase orders approved and payments committed by their invited users.</p>
      </>
    ),
    contentAr: (
      <>
        <p>للوصول إلى بوابة الشركات (B2B)، يجب على المنشآت تقديم سجل تجاري ساري المفعول (CR) وشهادة ضريبة القيمة المضافة. وتتعهدون بأن جميع البيانات المقدمة دقيقة وتفوضون أفينيك لإجراء عمليات التحقق من الهوية (KYC).</p>
        <p>يمكن للشركات دعوة أعضاء الفريق وتفويض أدوار محددة لهم: مدير الشركة، المشتري، والمفوّض بالاعتماد. وتتحمل الشركة المسؤولية القانونية الكاملة عن جميع أوامر الشراء التي تمت الموافقة عليها والمدفوعات الملتزم بها من قبل مستخدميها المدعوين.</p>
      </>
    ),
  },
  {
    id: "credit",
    titleEn: "3. B2B Credit & Payment Terms",
    titleAr: "٣. الائتمان التجاري وشروط الدفع",
    icon: CreditCard,
    contentEn: (
      <>
        <p>A company account may carry a credit limit and payment terms recorded by Avenick. Only terms already approved and shown on the active company account apply. There is currently no self-service application for credit lines or Net terms, and no automated periodic review of credit limits.</p>
        <p>Tax invoices issued under recorded payment terms must be paid in full by their due dates. Avenick does not currently operate automated credit suspension or account lockout on overdue invoices; any such action is taken manually under the executed customer agreement.</p>
      </>
    ),
    contentAr: (
      <>
        <p>قد يحمل حساب الشركة حداً ائتمانياً وشروط دفع مسجلة لدى أفينيك. ولا تسري إلا الشروط المعتمدة مسبقاً والظاهرة على حساب الشركة النشط. ولا يتوفر حالياً طلب ذاتي للحصول على خطوط ائتمان أو شروط دفع صافية، ولا توجد مراجعة دورية آلية للحدود الائتمانية.</p>
        <p>يجب سداد الفواتير الضريبية الصادرة بموجب شروط الدفع المسجلة بالكامل في تواريخ استحقاقها. ولا تُشغّل أفينيك حالياً تعليقاً ائتمانياً آلياً أو إغلاقاً للحساب عند تأخر الفواتير؛ وأي إجراء من هذا القبيل يُتخذ يدوياً بموجب اتفاقية العميل المبرمة.</p>
      </>
    ),
  },
  {
    id: "procurement",
    titleEn: "4. Procurement & RFQ Rules",
    titleAr: "٤. قواعد المشتريات وطلبات عرض الأسعار",
    icon: ShoppingBag,
    contentEn: (
      <>
        <p>When you submit a Request for Quotation (RFQ), it is recorded and may be assigned to a supplier. Avenick does not guarantee that an RFQ is distributed to multiple suppliers or that a quote will be returned. Quotations received from suppliers are binding offers valid until the expiration date specified on the quote.</p>
        <p>Upon accepting a quotation, the platform automatically drafts a Purchase Order (PO). If approval policies are configured, the PO will wait for approval from your designated Company Approver before converting to a formal order.</p>
      </>
    ),
    contentAr: (
      <>
        <p>عند إرسال طلب عرض أسعار (RFQ)، يتم تسجيله وقد يُسنَد إلى مورد. ولا تضمن أفينيك توزيع الطلب على عدة موردين أو ورود عرض أسعار. وتعتبر عروض الأسعار الواردة من الموردين عروضاً ملزمة وسارية المفعول حتى تاريخ انتهاء الصلاحية المحدد في العرض.</p>
        <p>عند قبول عرض الأسعار، تقوم المنصة تلقائياً بصياغة أمر الشراء (PO). وفي حالة تهيئة سياسات الموافقة، سينتظر أمر الشراء موافقة المفوّض المعيّن قبل تحويله إلى طلب رسمي.</p>
      </>
    ),
  },
  {
    id: "disputes",
    titleEn: "5. Buyer Protection & Disputes",
    titleAr: "٥. حماية المشتري والنزاعات",
    icon: ShieldAlert,
    contentEn: (
      <>
        <p>Avenick does not currently provide an escrow service. Bank-transfer orders remain unpaid until finance reconciliation; online card payment methods remain unavailable until outbound payment initiation and settlement controls are certified.</p>
        <p>In case of defective, incorrect, or missing items, buyers must raise a formal dispute or request return within the inspection window. Support tickets will be mediated by the Avenick customer care team.</p>
      </>
    ),
    contentAr: (
      <>
        <p>لا توفر أفينيك حالياً خدمة ضمان مالي (Escrow). وتظل طلبات التحويل البنكي غير مدفوعة حتى تسوية فريق المالية، كما تبقى طرق الدفع الإلكتروني بالبطاقات غير متاحة إلى أن يتم اعتماد بدء الدفع والتسوية.</p>
        <p>في حالة وجود سلع معيبة أو غير صحيحة أو مفقودة، يجب على المشتري رفع نزاع رسمي أو طلب إرجاع خلال فترة الفحص. وسيتم التوسط في تذاكر الدعم بواسطة فريق خدمة عملاء أفينيك.</p>
      </>
    ),
  },
  {
    id: "governing-law",
    titleEn: "6. Governing Law",
    titleAr: "٦. القانون الحاكم والولاية القضائية",
    icon: Award,
    contentEn: (
      <>
        <p>The governing law and dispute forum must be stated in the executed customer agreement for the deployed tenant. This demo does not assign a jurisdiction by default. Contact the legal desk before relying on these terms for a live transaction.</p>
      </>
    ),
    contentAr: (
      <>
        <p>يجب تحديد القانون الحاكم وجهة الفصل في النزاعات ضمن اتفاقية العميل الموقعة للبيئة المنشورة. لا تحدد هذه البيئة التجريبية اختصاصاً قضائياً افتراضياً. يرجى التواصل مع القسم القانوني قبل الاعتماد على هذه الشروط في معاملة فعلية.</p>
      </>
    ),
  },
  {
    id: "questions",
    titleEn: "7. Contact Legal Team",
    titleAr: "٧. الاتصال بالقسم القانوني",
    icon: HelpCircle,
    contentEn: (
      <>
        <p>If you have any questions or require clarification regarding these terms, please contact our legal desk at <a href="mailto:legal@avenick.com" className="text-primary hover:underline font-semibold">legal@avenick.com</a>.</p>
      </>
    ),
    contentAr: (
      <>
        <p>إذا كانت لديكم أي استفسارات أو طلبات إيضاح بشأن هذه الشروط، يرجى التواصل مع مكتبنا القانوني عبر البريد الإلكتروني <a href="mailto:legal@avenick.com" className="text-primary hover:underline font-semibold">legal@avenick.com</a>.</p>
      </>
    ),
  },
];

export default async function TermsPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("AVENICK_LOCALE")?.value ?? "en";
  const isAr = locale === "ar";

  return (
    <MainLayout>
      <div className="relative overflow-hidden min-h-screen bg-background text-foreground py-10 lg:py-16">
        {/* Decorative Grid and Glow */}
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-20 end-1/4 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-20 start-1/4 h-80 w-80 rounded-full bg-accent/10 blur-[120px]" />

        <div className="relative max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="mb-10 text-center max-w-2xl mx-auto">
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-3">
              {isAr ? "شروط الخدمة" : "Terms of Service"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isAr 
                ? "آخر تحديث: يونيو ٢٠٢٦ — يرجى قراءة شروط الخدمة بعناية قبل استخدام منصة أفينيك للتجارة." 
                : "Last updated: June 2026 — Please read these terms carefully before utilizing the Avenick Commerce platform."}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10 items-start">
            {/* Sidebar Sticky TOC */}
            <aside className="hidden lg:sticky lg:top-24 h-max bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                {isAr ? "جدول المحتويات" : "Table of Contents"}
              </p>
              <nav className="flex flex-col gap-2">
                {SECTIONS.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="text-sm text-muted-foreground hover:text-primary hover:font-medium transition-colors"
                  >
                    {isAr ? sec.titleAr : sec.titleEn}
                  </a>
                ))}
              </nav>
            </aside>

            {/* Content Body */}
            <div className="space-y-6">
              {SECTIONS.map((sec) => {
                const SecIcon = sec.icon;
                return (
                  <section
                    key={sec.id}
                    id={sec.id}
                    className="scroll-mt-24 bg-card border border-border rounded-2xl p-6 lg:p-8 hover:shadow-card transition-shadow"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                        <SecIcon className="h-5 w-5" />
                      </span>
                      <h2 className="text-lg lg:text-xl font-bold tracking-tight">
                        {isAr ? sec.titleAr : sec.titleEn}
                      </h2>
                    </div>
                    <div className="text-muted-foreground text-sm lg:text-base leading-relaxed space-y-4">
                      {isAr ? sec.contentAr : sec.contentEn}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
