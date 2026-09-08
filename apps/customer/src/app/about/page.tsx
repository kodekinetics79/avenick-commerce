import { cookies } from "next/headers";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { PolicyShell, type PolicySection } from "@/components/legal/policy-shell";
import { companyHeadquarters, formatAddress } from "@/lib/company";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = {
  title: "About",
  description: `What ${platformName()} is, how buying works, and who operates the platform.`,
};

export const dynamic = "force-dynamic";

/**
 * About.
 *
 * THE WHOLE DIFFICULTY OF THIS PAGE is that an "about" page is where a
 * marketplace invents itself. Founding year, headcount, "trusted by 2,400+
 * suppliers", a mission, a founder quote, a map with pins on cities nobody
 * ships to — every one of them is available in five minutes and every one of
 * them is unsurvivable (LAW F). Nothing on this page is a claim the platform
 * cannot back: it describes what the product DOES, which is observable by using
 * it, and names the company, which is configuration.
 *
 * So there is no history section, no team section and no numbers. If those are
 * wanted later they need a source — a real incorporation date, a real supplier
 * count queried at render — not prose.
 */
export default async function AboutPage() {
  const isAr = ((await cookies()).get("AVENICK_LOCALE")?.value ?? "en") === "ar";
  const name = platformName();
  const hq = companyHeadquarters();

  const link = (href: string, en: string, ar: string) => (
    <Link href={href} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
      {isAr ? ar : en}
    </Link>
  );

  const sections: PolicySection[] = [
    {
      id: "what",
      titleEn: `What ${name} is`,
      titleAr: `ما هي ${name}`,
      contentEn: (
        <>
          <p>
            {name} is a GCC marketplace for business and consumer buying. Approved suppliers list
            industrial supply, tools and office procurement; buyers search that catalogue, order
            directly where a price is published, or submit a request for quotation where the
            requirement is a volume rather than a unit.
          </p>
          <p>
            It is B2B-first and B2C-ready: the same catalogue serves a company buying on account and
            a person buying one item, and the difference is in the terms attached to the order rather
            than in two separate stores.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            {name} سوق خليجي للشراء للأعمال وللأفراد. يعرض الموردون المعتمدون مستلزمات التوريد
            الصناعي والأدوات والمشتريات المكتبية؛ ويبحث المشترون في هذا الكتالوج، فيطلبون مباشرة حيث
            يكون السعر منشورًا، أو يقدّمون طلب عرض سعر حين يكون المطلوب كمية لا وحدة.
          </p>
          <p>
            المنصة موجّهة للأعمال أولًا وجاهزة للأفراد: الكتالوج نفسه يخدم شركة تشتري بحساب وفردًا
            يشتري قطعة واحدة، والفارق في الشروط المرتبطة بالطلب لا في وجود متجرين منفصلين.
          </p>
        </>
      ),
    },
    {
      id: "buying",
      titleEn: "How buying works",
      titleAr: "كيف يتم الشراء",
      contentEn: (
        <>
          <p>
            Where a supplier publishes a price, you can order at that price. Where the requirement is
            a volume, a break quantity or a specification, you raise a request for quotation and the
            portal shows the quotes actually submitted against it — not an estimate.
          </p>
          <p>
            Delivery coverage, timing and charges are confirmed per order during processing. The
            storefront does not promise a carrier or a delivery window before that confirmation, and
            the {link("/shipping", "shipping page", "صفحة الشحن")} says so in more detail.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            حيث ينشر المورّد سعرًا يمكنك الشراء بذلك السعر. وحيث يكون المطلوب كمية أو حد كمية أو
            مواصفة، تقدّم طلب عرض سعر وتعرض البوابة العروض المقدّمة فعليًا تجاهه — لا تقديرًا.
          </p>
          <p>
            ويُؤكَّد نطاق التوصيل ومدته ورسومه لكل طلب أثناء المعالجة. ولا يعد المتجر بناقل أو مدة
            توصيل قبل ذلك التأكيد، وتوضح {link("/shipping", "صفحة الشحن", "صفحة الشحن")} ذلك بتفصيل
            أكبر.
          </p>
        </>
      ),
    },
    {
      id: "suppliers",
      titleEn: "Suppliers are reviewed",
      titleAr: "مراجعة المورّدين",
      contentEn: (
        <p>
          A supplier does not self-publish. An application is reviewed — including the commercial
          registration — before a storefront goes live, and a verification mark shown anywhere on the
          platform cites the document it rests on rather than standing on its own.
        </p>
      ),
      contentAr: (
        <p>
          لا ينشر المورّد لنفسه. تُراجع الطلبات — بما فيها السجل التجاري — قبل تفعيل أي متجر، وأي
          علامة توثيق تظهر في المنصة تستند إلى المستند الذي تستشهد به لا إلى ذاتها.
        </p>
      ),
    },
    {
      id: "company",
      titleEn: "The company",
      titleAr: "الشركة",
      contentEn: (
        <>
          <p>
            Headquarters: {formatAddress(hq)}.
          </p>
          <p>
            The registered entity for GCC orders, the governing terms and the contact routes are on
            the {link("/contact", "contact page", "صفحة الاتصال")} and in the{" "}
            {link("/terms", "terms of service", "شروط الخدمة")}.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>المقر الرئيسي: {formatAddress(hq)}.</p>
          <p>
            أما الكيان المسجَّل لطلبات الخليج والشروط الحاكمة وطرق التواصل فمذكورة في{" "}
            {link("/contact", "صفحة الاتصال", "صفحة الاتصال")} وفي{" "}
            {link("/terms", "شروط الخدمة", "شروط الخدمة")}.
          </p>
        </>
      ),
    },
  ];

  return (
    <MainLayout>
      <PolicyShell
        isAr={isAr}
        eyebrowEn="About"
        eyebrowAr="عن المنصة"
        titleEn={`About ${name}`}
        titleAr={`عن ${name}`}
        descriptionEn="What the platform does, how an order is placed, and who operates it."
        descriptionAr="ما تقوم به المنصة، وكيف يُقدَّم الطلب، ومن يشغّلها."
        sections={sections}
        datelineEn="Describes how the platform behaves today; no figures are quoted because none are recorded here"
        datelineAr="يصف سلوك المنصة اليوم؛ ولا تُذكر أرقام لأن لا شيء منها مسجَّل هنا"
      />
    </MainLayout>
  );
}
