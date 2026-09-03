import { cookies } from "next/headers";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { Eyebrow, PageHeader, Surface } from "@avenick/ui";
import { platformContacts, platformName } from "@avenick/utils/portal-config";

export const metadata = {
  title: `Terms of Service — ${platformName()}`,
  description: `${platformName()} terms of service, B2B procurement rules, and regulatory guidelines.`,
};

export const dynamic = "force-dynamic";

interface LegalSection {
  id: string;
  titleEn: string;
  titleAr: string;
  contentEn: React.ReactNode;
  contentAr: React.ReactNode;
}

/**
 * Built per request: the legal contact address is deployment configuration
 * (platformContacts) and is never typed into the terms. With no address
 * configured, the section points at the support portal instead.
 */
function buildSections(legalEmail: string | null): LegalSection[] {
  // The operator's name appears throughout the agreement; it is read once from
  // the resolver so a renamed deployment does not bind users to the old name.
  const name = platformName();
  const emailLink = legalEmail ? (
    <a href={`mailto:${legalEmail}`} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">{legalEmail}</a>
  ) : null;
  const supportLink = (ar: boolean) => (
    <Link href="/support" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">{ar ? "بوابة الدعم الفني" : "support portal"}</Link>
  );
  return [
  {
    id: "terms",
    titleEn: "1. Acceptance of Terms",
    titleAr: "١. قبول الشروط والأحكام",
    contentEn: (
      <>
        <p>By registering for, accessing, or using the {name} B2B/B2C trading platform, you agree to be bound by these Terms of Service. These terms constitute a legally binding agreement between you (and your company, if registering as a business entity) and {name}.</p>
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
    titleEn: "2. Registration & Account Roles",
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
    titleEn: "3. B2B Credit & Payment Terms",
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
    titleEn: "4. Procurement & RFQ Rules",
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
    titleEn: "5. Buyer Protection & Disputes",
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
    titleEn: "6. Governing Law",
    titleAr: "٦. القانون الحاكم والولاية القضائية",
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

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-block">
        <PageHeader
          eyebrow={isAr ? "الشؤون القانونية" : "Legal"}
          title={isAr ? "شروط الخدمة" : "Terms of Service"}
          description={
            isAr
              ? "يرجى قراءة شروط الخدمة بعناية قبل استخدام المنصة."
              : `Please read these terms carefully before using the ${platformName()} platform.`
          }
          // No "last updated" date: nothing records when this text changed, so a
          // typed date would be a claim the platform cannot back. Saying that
          // outright is better than an empty corner where a date should be.
          dateline={
            isAr
              ? "لا يسجل النظام تاريخ آخر تعديل لهذا النص، فلا يُعرض تاريخ"
              : "No revision date is shown because none is recorded"
          }
          linkComponent={Link}
        />

        <div className="grid grid-cols-1 items-start gap-block lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* The sidebar carried `hidden lg:sticky` and no `lg:block`, so it was
              hidden at every breakpoint and the table of contents never appeared
              on any screen. */}
          <aside className="hidden lg:block">
            <div className="lg:sticky lg:top-24">
              <Eyebrow as="h2">{isAr ? "جدول المحتويات" : "Table of Contents"}</Eyebrow>
              <nav
                aria-label={isAr ? "جدول المحتويات" : "Table of contents"}
                className="mt-3 flex flex-col"
              >
                {SECTIONS.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    // border-s, not border-l: the marker sits at the reading
                    // start in both directions. Hover changes colour rather than
                    // weight — animating font-weight reflows the whole list.
                    className="u-focus u-ui rounded-e-nested border-s-2 border-hairline py-1.5 ps-3 text-ink-3 transition-colors duration-press ease-standard hover:border-border-strong hover:text-ink-1"
                  >
                    {isAr ? sec.titleAr : sec.titleEn}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* One document, ruled into sections — not seven independently
              bordered cards, each with its own shadow and its own icon tile. */}
          <Surface rung={2} className="overflow-hidden">
            {SECTIONS.map((sec, i) => (
              <section
                key={sec.id}
                id={sec.id}
                className={`scroll-mt-24 p-6 lg:p-8 ${i > 0 ? "border-t border-hairline" : ""}`}
              >
                <h2 className="u-h3 text-ink-1">{isAr ? sec.titleAr : sec.titleEn}</h2>
                <div className="u-body mt-3 max-w-prose space-y-4 text-ink-2 [&_strong]:font-semibold [&_strong]:text-ink-1">
                  {isAr ? sec.contentAr : sec.contentEn}
                </div>
              </section>
            ))}
          </Surface>
        </div>
      </div>
    </MainLayout>
  );
}
