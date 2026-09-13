import { cookies } from "next/headers";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { PolicyShell, type PolicySection } from "@/components/legal/policy-shell";
import { platformContacts, platformName } from "@avenick/utils/portal-config";

export const metadata = {
  title: `Terms of Service`,
  description: `${platformName()} terms of service, B2B procurement rules, and regulatory guidelines.`,
};

export const dynamic = "force-dynamic";

/**
 * Built per request: the legal contact address is deployment configuration
 * (platformContacts) and is never typed into the terms. With no address
 * configured, the section points at the support portal instead.
 */
function buildSections(legalEmail: string | null): PolicySection[] {
  // The operator's name appears throughout the agreement; it is read once from
  // the resolver so a renamed deployment does not bind users to the old name.
  const name = platformName();
  const emailLink = legalEmail ? (
    <a href={`mailto:${legalEmail}`} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">{legalEmail}</a>
  ) : null;
  const supportLink = (ar: boolean) => (
    <Link href="/support" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">{ar ? "بوابة الدعم الفني" : "support portal"}</Link>
  );
  const contactLink = (ar: boolean) => (
    <Link href="/contact" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">{ar ? "صفحة الاتصال" : "contact page"}</Link>
  );
  return [
  {
    id: "terms",
    titleEn: "1. Acceptance of terms",
    titleAr: "١. قبول الشروط والأحكام",
    contentEn: (
      <>
        <p>By registering for, accessing, or using the {name} trading platform, you agree to be bound by these Terms of Service. These terms constitute a legally binding agreement between you (and your company, if registering as a business entity) and {name}.</p>
        <p>If you do not agree with any part of these terms, you must not access the platform or use our services.</p>
      </>
    ),
    contentAr: (
      <>
        <p>من خلال التسجيل أو الوصول أو استخدام منصة {name} للتجارة، فإنكم توافقون على الالتزام بشروط الخدمة هذه. تشكل هذه الشروط اتفاقية ملزمة قانونياً بينكم (وبين شركتكم، في حال التسجيل ككيان تجاري) وبين المنصة.</p>
        <p>إذا كنتم لا توافقون على أي جزء من هذه الشروط، فيجب عليكم عدم الدخول إلى المنصة أو استخدام خدماتنا.</p>
      </>
    ),
  },
  {
    id: "accounts",
    titleEn: "2. Registration and account roles",
    titleAr: "٢. التسجيل وأدوار الحسابات",
    contentEn: (
      <>
        <p>To access the B2B portal, businesses must submit a valid Commercial Registration (CR) and VAT certificate. You represent that all details provided are accurate and authorize {name} to conduct KYC checks.</p>
        <p>Companies can invite team members and delegate specific roles: Company Admin, Company Buyer, and Company Approver. The company assumes full liability for all purchase orders approved and payments committed by their invited users.</p>
      </>
    ),
    contentAr: (
      <>
        <p>للوصول إلى بوابة الشركات (B2B)، يجب على المنشآت تقديم سجل تجاري ساري المفعول (CR) وشهادة ضريبة القيمة المضافة. وتتعهدون بأن جميع البيانات المقدمة دقيقة وتفوضون {name} لإجراء عمليات التحقق من الهوية (KYC).</p>
        <p>يمكن للشركات دعوة أعضاء الفريق وتفويض أدوار محددة لهم: مدير الشركة، المشتري، والمفوّض بالاعتماد. وتتحمل الشركة المسؤولية القانونية الكاملة عن جميع أوامر الشراء التي تمت الموافقة عليها والمدفوعات الملتزم بها من قبل مستخدميها المدعوين.</p>
      </>
    ),
  },
  {
    id: "credit",
    titleEn: "3. B2B credit and payment terms",
    titleAr: "٣. الائتمان التجاري وشروط الدفع",
    contentEn: (
      <>
        <p>A company account may carry a credit limit and payment terms recorded by {name}. Only terms already approved and shown on the active company account apply. There is currently no self-service application for credit lines or Net terms, and no automated periodic review of credit limits.</p>
        <p>Tax invoices issued under recorded payment terms must be paid in full by their due dates. {name} does not currently operate automated credit suspension or account lockout on overdue invoices; any such action is taken manually under the executed customer agreement.</p>
      </>
    ),
    contentAr: (
      <>
        <p>قد يحمل حساب الشركة حداً ائتمانياً وشروط دفع مسجلة لدى {name}. ولا تسري إلا الشروط المعتمدة مسبقاً والظاهرة على حساب الشركة النشط. ولا يتوفر حالياً طلب ذاتي للحصول على خطوط ائتمان أو شروط دفع صافية، ولا توجد مراجعة دورية آلية للحدود الائتمانية.</p>
        <p>يجب سداد الفواتير الضريبية الصادرة بموجب شروط الدفع المسجلة بالكامل في تواريخ استحقاقها. ولا تُشغّل {name} حالياً تعليقاً ائتمانياً آلياً أو إغلاقاً للحساب عند تأخر الفواتير؛ وأي إجراء من هذا القبيل يُتخذ يدوياً بموجب اتفاقية العميل المبرمة.</p>
      </>
    ),
  },
  {
    id: "procurement",
    titleEn: "4. Procurement and RFQ rules",
    titleAr: "٤. قواعد المشتريات وطلبات عرض الأسعار",
    contentEn: (
      <>
        <p>When you submit a Request for Quotation (RFQ), it is recorded and may be assigned to a supplier. {name} does not guarantee that an RFQ is distributed to multiple suppliers or that a quote will be returned. Quotations received from suppliers are binding offers valid until the expiration date specified on the quote.</p>
        <p>Upon accepting a quotation, the platform automatically drafts a Purchase Order (PO). If approval policies are configured, the PO will wait for approval from your designated Company Approver before converting to a formal order.</p>
      </>
    ),
    contentAr: (
      <>
        <p>عند إرسال طلب عرض أسعار (RFQ)، يتم تسجيله وقد يُسنَد إلى مورد. ولا تضمن {name} توزيع الطلب على عدة موردين أو ورود عرض أسعار. وتعتبر عروض الأسعار الواردة من الموردين عروضاً ملزمة وسارية المفعول حتى تاريخ انتهاء الصلاحية المحدد في العرض.</p>
        <p>عند قبول عرض الأسعار، تقوم المنصة تلقائياً بصياغة أمر الشراء (PO). وفي حالة تهيئة سياسات الموافقة، سينتظر أمر الشراء موافقة المفوّض المعيّن قبل تحويله إلى طلب رسمي.</p>
      </>
    ),
  },
  {
    id: "disputes",
    titleEn: "5. Buyer protection and disputes",
    titleAr: "٥. حماية المشتري والنزاعات",
    contentEn: (
      <>
        <p>{name} does not currently provide an escrow service. Bank-transfer orders remain unpaid until finance reconciliation; online card payment methods remain unavailable until outbound payment initiation and settlement controls are certified.</p>
        <p>In case of defective, incorrect, or missing items, buyers must raise a formal dispute or request return within the inspection window. Support tickets will be mediated by the {name} customer care team.</p>
      </>
    ),
    contentAr: (
      <>
        <p>لا توفر {name} حالياً خدمة ضمان مالي (Escrow). وتظل طلبات التحويل البنكي غير مدفوعة حتى تسوية فريق المالية، كما تبقى طرق الدفع الإلكتروني بالبطاقات غير متاحة إلى أن يتم اعتماد بدء الدفع والتسوية.</p>
        <p>في حالة وجود سلع معيبة أو غير صحيحة أو مفقودة، يجب على المشتري رفع نزاع رسمي أو طلب إرجاع خلال فترة الفحص. وسيتم التوسط في تذاكر الدعم بواسطة فريق خدمة عملاء {name}.</p>
      </>
    ),
  },
  {
    id: "governing-law",
    titleEn: "6. Governing law",
    titleAr: "٦. القانون الحاكم والولاية القضائية",
    contentEn: (
      <>
        {/* This section called the live storefront "this demo" and sent readers
            to a "legal desk" that no page names. What is true is narrower and
            is all it says now: these terms name no governing law or forum, and
            a signed agreement that does name them governs. No jurisdiction is
            stated because none is recorded — lib/company.ts deliberately
            resolves the GCC trading entity to null until it is configured. */}
        <p>These terms do not name a governing law or a forum for disputes. Where a written agreement between you and {name} names them, that agreement applies. If none does, ask through the {contactLink(false)} before relying on these terms for a transaction.</p>
      </>
    ),
    contentAr: (
      <>
        <p>لا تحدد هذه الشروط قانوناً حاكماً ولا جهةً للفصل في النزاعات. فإن حدّدتهما اتفاقية مكتوبة بينكم وبين {name} فتسري تلك الاتفاقية، وإن لم توجد اتفاقية كهذه فاستفسروا عبر {contactLink(true)} قبل الاعتماد على هذه الشروط في أي معاملة.</p>
      </>
    ),
  },
  {
    id: "questions",
    titleEn: "7. Contacting the legal team",
    titleAr: "٧. الاتصال بالقسم القانوني",
    contentEn: (
      <>
        <p>If you have any questions or require clarification regarding these terms, {emailLink ? <>contact our legal desk at {emailLink} or </> : null}open a ticket in our {supportLink(false)}.</p>
      </>
    ),
    contentAr: (
      <>
        <p>إذا كانت لديكم أي استفسارات أو طلبات إيضاح بشأن هذه الشروط، {emailLink ? <>يرجى التواصل مع مكتبنا القانوني عبر {emailLink} أو </> : null}افتحوا تذكرة في {supportLink(true)}.</p>
      </>
    ),
  },
  ];
}

export default async function TermsPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("AVENICK_LOCALE")?.value ?? "en";
  const isAr = locale === "ar";
  const SECTIONS = buildSections(platformContacts().legal);

  // The layout — header, table of contents, one ruled sheet — is <PolicyShell>,
  // the same shell every other information page uses. This page carried its
  // own copy of it, which is how the terms came to look like a different site
  // from the contact page linked beside them in the footer.
  //
  // No "last updated" date: nothing records when this text changed, so a typed
  // date would be a claim the platform cannot back. The shell's default
  // dateline says that outright.
  return (
    <MainLayout>
      <PolicyShell
        isAr={isAr}
        eyebrowEn="Legal"
        eyebrowAr="الشؤون القانونية"
        titleEn="Terms of Service"
        titleAr="شروط الخدمة"
        descriptionEn={`Please read these terms carefully before using the ${platformName()} platform.`}
        descriptionAr="يرجى قراءة شروط الخدمة بعناية قبل استخدام المنصة."
        sections={SECTIONS}
      />
    </MainLayout>
  );
}
