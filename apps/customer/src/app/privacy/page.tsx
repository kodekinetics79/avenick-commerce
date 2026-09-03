import { cookies } from "next/headers";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { Eyebrow, PageHeader, Surface } from "@avenick/ui";
import { platformContacts, platformName } from "@avenick/utils/portal-config";

export const metadata = {
  title: `Privacy Policy — ${platformName()}`,
  description: `${platformName()} privacy policy and data protection guidelines under GCC regulations.`,
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
 * Built per request rather than at module load because the contact address is
 * deployment configuration (platformContacts) and must never be typed into the
 * policy. With no address configured, the policy points at the support portal
 * — the one contact channel this codebase actually operates.
 */
function buildSections(privacyEmail: string | null): LegalSection[] {
  const name = platformName();
  const emailLink = privacyEmail ? (
    <a href={`mailto:${privacyEmail}`} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">{privacyEmail}</a>
  ) : null;
  const supportLink = (ar: boolean) => (
    <Link href="/support" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">{ar ? "بوابة الدعم الفني" : "support portal"}</Link>
  );
  return [
  {
    id: "intro",
    titleEn: "1. Introduction",
    titleAr: "١. مقدمة",
    contentEn: (
      <>
        <p>Welcome to {name}. We are committed to protecting your personal and business data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our B2B procurement platform, or purchase products from us.</p>
        <p>By accessing or using our services, you consent to the practices described in this policy. If you do not agree with these terms, please do not use our platform.</p>
      </>
    ),
    contentAr: (
      <>
        <p>مرحباً بكم في {name}. نحن ملتزمون بحماية بياناتكم الشخصية والتجارية. توضح سياسة الخصوصية هذه كيفية جمع معلوماتكم واستخدامها والإفصاح عنها وحمايتها عند زيارتكم لموقعنا أو استخدام منصة المشتريات الخاصة بنا.</p>
        <p>من خلال الوصول إلى خدماتنا أو استخدامها، فإنكم توافقون على الممارسات الموضحة في هذه السياسة. إذا كنتم لا توافقون على هذه الشروط، يرجى عدم استخدام منصتنا.</p>
      </>
    ),
  },
  {
    id: "data-collection",
    titleEn: "2. Information We Collect",
    titleAr: "٢. المعلومات التي نجمعها",
    contentEn: (
      <>
        <p>We collect information that you provide directly to us when creating an account, placing an order, or submitting a Request for Quotation (RFQ). This includes:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li><strong>Personal Information:</strong> Name, email address, phone number, and password.</li>
          <li><strong>Business Details:</strong> Company name, Commercial Registration (CR) number, VAT certificate, size, and industry.</li>
          <li><strong>Transaction Details:</strong> Payment terms, delivery sites, purchase orders, quotes, and billing history.</li>
        </ul>
      </>
    ),
    contentAr: (
      <>
        <p>نقوم بجمع المعلومات التي تقدمونها لنا مباشرة عند إنشاء حساب، أو تقديم طلب شراء، أو إرسال طلب عرض أسعار (RFQ). ويشمل ذلك:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li><strong>معلومات شخصية:</strong> الاسم، عنوان البريد الإلكتروني، رقم الهاتف، وكلمة المرور.</li>
          <li><strong>تفاصيل العمل التجاري:</strong> اسم الشركة، رقم السجل التجاري (CR)، شهادة ضريبة القيمة المضافة، حجم الشركة، ومجال الصناعة.</li>
          <li><strong>تفاصيل المعاملات:</strong> شروط الدفع، مواقع التسليم، أوامر الشراء، عروض الأسعار، وتاريخ الفواتير.</li>
        </ul>
      </>
    ),
  },
  {
    id: "data-use",
    titleEn: "3. How We Use Your Information",
    titleAr: "٣. كيفية استخدام معلوماتكم",
    contentEn: (
      <>
        <p>We process your data to deliver a secure, efficient B2B/B2C trading environment. Specifically, we use it to:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>Facilitate RFQ distribution, quote comparisons, and order fulfillment.</li>
          <li>Apply the payment terms already approved and recorded on your company account.</li>
          <li>Send transactional updates, security alerts, and customer support messages.</li>
          <li>Comply with tax regulations, custom declarations, and GCC trade laws.</li>
        </ul>
      </>
    ),
    contentAr: (
      <>
        <p>نقوم بمعالجة بياناتكم لتوفير بيئة تجارية آمنة وفعالة للشركات والأفراد. وبشكل خاص، نستخدمها لـ:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>تسهيل توزيع طلبات عروض الأسعار، ومقارنة العروض، وتلبية الطلبات.</li>
          <li>تطبيق شروط الدفع المعتمدة والمسجلة مسبقاً في حساب شركتكم.</li>
          <li>إرسال تحديثات المعاملات، وتنبيهات الأمان، ورسائل دعم العملاء.</li>
          <li>الامتثال للأنظمة الضريبية، والإقرارات الجمركية، وقوانين التجارة في دول مجلس التعاون الخليجي.</li>
        </ul>
      </>
    ),
  },
  {
    id: "gcc-compliance",
    titleEn: "4. Privacy Laws & Compliance",
    titleAr: "٤. قوانين الخصوصية والامتثال لها",
    contentEn: (
      <>
        <p>We apply data-security controls and assess legal obligations according to the customer, processing, and hosting jurisdictions that actually apply:</p>
        <ul className="list-disc ps-5 space-y-2 mt-2">
          <li><strong>Jurisdiction:</strong> Applicable privacy requirements are confirmed during customer onboarding and contracting.</li>
          <li><strong>Data location:</strong> Hosting and transfer details are documented for the deployed customer environment.</li>
          <li><strong>No implied certification:</strong> Availability of the demo does not itself represent legal or regulatory certification in any country.</li>
        </ul>
      </>
    ),
    contentAr: (
      <>
        <p>نطبق ضوابط أمن البيانات ونحدد الالتزامات القانونية وفقاً لبلد العميل ومكان المعالجة والاستضافة الفعلي:</p>
        <ul className="list-disc ps-5 space-y-2 mt-2">
          <li><strong>الاختصاص القانوني:</strong> يتم تأكيد متطلبات الخصوصية أثناء إعداد حساب العميل والتعاقد.</li>
          <li><strong>موقع البيانات:</strong> يتم توثيق تفاصيل الاستضافة والنقل لبيئة العميل المنشورة.</li>
          <li><strong>لا اعتماد ضمني:</strong> إتاحة البيئة التجريبية لا تعني اعتماداً قانونياً أو تنظيمياً في أي دولة.</li>
        </ul>
      </>
    ),
  },
  {
    id: "user-rights",
    titleEn: "5. Your Data Rights",
    titleAr: "٥. حقوق البيانات الخاصة بكم",
    contentEn: (
      <>
        <p>Under local GCC privacy laws, you possess legal rights regarding your information. You have the right to request access, rectification, restriction of processing, or erasure of your personal data stored on our servers.</p>
        <p>To exercise these rights, open a ticket in the {supportLink(false)}{emailLink ? <> or email {emailLink}</> : null}.</p>
      </>
    ),
    contentAr: (
      <>
        <p>بموجب قوانين الخصوصية المعمول بها في الخليج، لديكم حقوق قانونية كاملة تجاه بياناتكم. يحق لكم طلب الوصول إلى بياناتكم الشخصية المخزنة لدينا، أو تصحيحها، أو تقييد معالجتها، أو حذفها نهائياً.</p>
        <p>لممارسة هذه الحقوق، افتحوا تذكرة في {supportLink(true)}{emailLink ? <> أو راسلونا عبر {emailLink}</> : null}.</p>
      </>
    ),
  },
  {
    id: "support",
    titleEn: "6. Questions & Support",
    titleAr: "٦. الأسئلة والدعم الفني",
    contentEn: (
      <>
        <p>If you have any questions about this Privacy Policy or how your data is treated, {emailLink ? <>email {emailLink} or </> : null}open a ticket in our {supportLink(false)}.</p>
      </>
    ),
    contentAr: (
      <>
        <p>إذا كانت لديكم أي استفسارات حول سياسة الخصوصية هذه أو كيفية التعامل مع بياناتكم، {emailLink ? <>راسلونا عبر {emailLink} أو </> : null}افتحوا تذكرة في {supportLink(true)}.</p>
      </>
    ),
  },
  ];
}

export default async function PrivacyPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("AVENICK_LOCALE")?.value ?? "en";
  const isAr = locale === "ar";
  const SECTIONS = buildSections(platformContacts().privacy);

  return (
    <MainLayout>
      {/* The brass reading hairline is mounted ONCE, by <MainLayout>, for every
          route in this app. A second <ScrollProgress> here stacked a second
          position:fixed, scroll-timeline-animated layer on exactly the same 2px
          band — two compositor layers and two running animations drawing one
          rule. "One per document" is the budget, and MainLayout already spends
          it. */}
      <div className="mx-auto max-w-6xl px-4 py-block">
        <PageHeader
          eyebrow={isAr ? "الشؤون القانونية" : "Legal"}
          title={isAr ? "سياسة الخصوصية" : "Privacy Policy"}
          description={
            isAr
              ? "تعرف على كيفية حماية بياناتك الشخصية والتجارية بموجب اللوائح الخليجية."
              : "How your personal and business data is handled under GCC guidelines."
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


        {/* The table of contents was `hidden lg:block`, so on a phone a
            seven-section legal document had no navigation at all — you scrolled
            it or you did not read it. A <details> disclosure needs no client
            component, works before hydration and with scripting off, and the
            chevron is drawn from two rotated borders, so there is nothing to
            mirror in Arabic. */}
        <details className="u-facet mb-stack border-y border-hairline lg:hidden">
          <summary className="u-focus">
            <span className="u-micro text-ink-3">{isAr ? "جدول المحتويات" : "Table of contents"}</span>
            <span className="u-facet__chev" aria-hidden="true" />
          </summary>
          <nav aria-label={isAr ? "جدول المحتويات" : "Table of contents"} className="flex flex-col pb-3">
            {SECTIONS.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="u-focus u-ui rounded-e-nested border-s-2 border-hairline py-1.5 ps-3 text-ink-2"
              >
                {isAr ? sec.titleAr : sec.titleEn}
              </a>
            ))}
          </nav>
        </details>
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

          {/* One document, ruled into sections — not six independently bordered
              cards, each with its own shadow and its own icon tile. */}
          <Surface rung={2} className="overflow-hidden">
            {SECTIONS.map((sec, i) => (
              <section
                key={sec.id}
                id={sec.id}
                className={`scroll-mt-24 p-6 lg:p-8 ${i > 0 ? "border-t border-hairline" : ""}`}
              >
                <h2 className="u-h2 text-ink-1">{isAr ? sec.titleAr : sec.titleEn}</h2>
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
