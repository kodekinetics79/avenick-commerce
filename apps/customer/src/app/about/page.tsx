import { cookies } from "next/headers";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { PolicyShell, type PolicySection } from "@/components/legal/policy-shell";
import { OFFICE_AR, companyHeadquarters, formatAddress, gccOffices } from "@/lib/company";
import { platformName } from "@avenick/utils/portal-config";
import { canonicalFor } from "@/lib/page-metadata";

export const metadata = {
  ...canonicalFor("/about"),
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
  const offices = gccOffices();

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
          {/* This used to describe "business and consumer buying" of "tools and
              office procurement", with "a person buying one item". The live
              catalogue is electrical and industrial supply only, and whether a
              product can be ordered on a personal account is a per-product
              channel its supplier sets — the product page's specifications state
              "Consumer orders" and "Business orders" for exactly that reason. So
              the page names what the catalogue is and where that fact is shown,
              and makes no promise about either channel that the data could
              contradict. */}
          <p>
            {name} is a GCC marketplace for industrial supply. Suppliers list their catalogue; buyers
            search it, raise a purchase order where a business price is published, or submit a
            request for quotation where the requirement is a volume rather than a unit.
          </p>
          <p>
            It is built business-first. Whether a product can be ordered on a company account, a
            personal account or both is set by its supplier, and the product page states which in its
            specifications.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            {name} سوق خليجي للتوريد الصناعي. يعرض الموردون كتالوجاتهم، ويبحث المشترون فيها، فيُصدرون
            أمر شراء حيث يكون سعر الأعمال منشورًا، أو يقدّمون طلب عرض سعر حين يكون المطلوب كمية لا وحدة.
          </p>
          <p>
            والمنصة موجّهة للأعمال أولًا. ويحدد المورّد ما إذا كان المنتج يُطلب بحساب شركة أو بحساب شخصي
            أو بكليهما، وتذكر صفحة المنتج ذلك في مواصفاته.
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
      titleEn: "Suppliers do not self-publish",
      titleAr: "المورّدون لا ينشرون لأنفسهم",
      // Narrowed to the one thing the code guarantees. This said every
      // application is reviewed "including the commercial registration" before
      // a storefront goes live. A seller's own application does wait at
      // PENDING_REVIEW for an operator, but approveSeller checks no document,
      // and the operator catalogue scripts (pilot-catalog.ts) create sellers
      // ACTIVE directly — on production every live listing came from a seller
      // with no reviewed document. What holds on every path is that the platform,
      // never the supplier, turns a storefront on.
      contentEn: (
        <p>
          A supplier cannot publish a storefront itself: it goes live only when the platform
          activates it.
        </p>
      ),
      contentAr: (
        <p>
          لا يستطيع المورّد نشر متجره بنفسه؛ فالمتجر لا يظهر إلا حين تفعّله المنصة.
        </p>
      ),
    },
    {
      id: "company",
      titleEn: "The company",
      titleAr: "الشركة",
      contentEn: (
        <>
          <p>Headquarters: {formatAddress(hq)}.</p>
          <p>
            Gulf offices:{" "}
            {offices.map((o) => `${o.city}, ${o.country}`).join(" · ")}.
          </p>
          <p>
            An office is where the platform works, not who your order is with. The registered entity
            for GCC orders, the governing terms and the contact routes are on the{" "}
            {link("/contact", "contact page", "صفحة الاتصال")} and in the{" "}
            {link("/terms", "terms of service", "شروط الخدمة")}.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>المقر الرئيسي: {formatAddress(hq)}.</p>
          <p>
            مكاتب الخليج:{" "}
            {offices
              .map((o) => {
                const t = OFFICE_AR[o.city];
                return `${t?.city ?? o.city}، ${t?.country ?? o.country}`;
              })
              .join(" · ")}
            .
          </p>
          <p>
            والمكتب هو موضع عمل المنصة لا الجهة التي يُبرم معها طلبك. أما الكيان المسجَّل لطلبات
            الخليج والشروط الحاكمة وطرق التواصل فمذكورة في{" "}
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
