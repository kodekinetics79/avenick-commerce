import { cookies } from "next/headers";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { PolicyShell, type PolicySection } from "@/components/legal/policy-shell";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = {
  title: "Returns and refunds",
  description: `${platformName()} returns and refunds policy — eligibility, the request process, and how refunds are issued.`,
};

export const dynamic = "force-dynamic";

/**
 * The returns POLICY. The route is /returns-policy because /returns is already
 * the authenticated page where a buyer raises and tracks a return against a
 * real order — a transactional surface, not a statement of terms. Two different
 * things, so two routes; moving the existing one would break links people hold.
 *
 * ── A NOTE FOR WHOEVER EDITS THIS NEXT ────────────────────────────────────
 * These are STANDARD MARKETPLACE TERMS written at the operator's instruction to
 * be amended once legal has settled them. They were not derived from anything
 * the system records, which makes this the one file in the repository whose
 * content is a commitment rather than a description.
 *
 * Two disciplines were kept while writing it, and both should survive editing:
 *
 *   1. NOTHING HERE CONTRADICTS WHAT THE PRODUCT ALREADY SAYS. The support
 *      FAQ states that coverage, timing and charges are confirmed per order and
 *      that the storefront promises no delivery window in advance. A returns
 *      page that then guaranteed a collection date would make the product argue
 *      with itself in front of a buyer.
 *   2. THIS IS A MARKETPLACE. Goods are sold by approved suppliers, so the
 *      supplier's own terms govern where they are stricter or more generous,
 *      and the page says which is which rather than implying one uniform policy
 *      the platform cannot enforce on every seller.
 *
 * The windows below (14 days consumer, 7 days B2B damage reporting) are the
 * common GCC defaults. They are the numbers most likely to change.
 */
export default async function ReturnsPolicyPage() {
  const isAr = ((await cookies()).get("AVENICK_LOCALE")?.value ?? "en") === "ar";
  const name = platformName();

  const link = (href: string, en: string, ar: string) => (
    <Link href={href} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
      {isAr ? ar : en}
    </Link>
  );

  const sections: PolicySection[] = [
    {
      id: "eligibility",
      titleEn: "What can be returned",
      titleAr: "ما يمكن إرجاعه",
      contentEn: (
        <>
          <p>
            Most items bought at a published price may be returned within{" "}
            <strong className="text-ink-1">14 days of delivery</strong>, unused, in their original
            packaging and with any seals intact.
          </p>
          <p>These are not returnable except where faulty or incorrectly supplied:</p>
          <ul className="ms-5 list-disc space-y-1">
            <li>Items made, configured or sourced to your specification.</li>
            <li>Goods supplied against a quotation rather than a published price, unless the quotation says otherwise.</li>
            <li>Items sold as clearance, ex-display or second quality, where that is stated at the point of sale.</li>
            <li>Consumables, hygiene and safety items whose seal has been broken.</li>
          </ul>
          <p>
            Where a supplier's own terms are more generous, the supplier's terms apply. Where they are
            stricter, the stricter terms are shown on the product before you order.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            يمكن إرجاع معظم المنتجات المشتراة بسعر منشور خلال{" "}
            <strong className="text-ink-1">14 يومًا من التسليم</strong>، غير مستعملة وبعبوتها الأصلية
            وأختامها سليمة.
          </p>
          <p>ولا تُقبل إعادة ما يلي إلا إذا كان معيبًا أو مورّدًا بالخطأ:</p>
          <ul className="ms-5 list-disc space-y-1">
            <li>المنتجات المصنّعة أو المهيأة أو المورّدة حسب مواصفتك.</li>
            <li>البضائع المورّدة بموجب عرض سعر لا بسعر منشور، ما لم ينص العرض على خلاف ذلك.</li>
            <li>منتجات التصفية أو المعروضة أو من الدرجة الثانية، متى ذُكر ذلك عند البيع.</li>
            <li>المستهلكات ومواد النظافة والسلامة التي فُضّ ختمها.</li>
          </ul>
          <p>
            وحيث تكون شروط المورّد أكثر سخاءً فهي المطبَّقة، وحيث تكون أكثر تشددًا تُعرض على صفحة
            المنتج قبل الطلب.
          </p>
        </>
      ),
    },
    {
      id: "how",
      titleEn: "How to request a return",
      titleAr: "كيف تطلب الإرجاع",
      contentEn: (
        <>
          <p>
            Open {link("/returns", "your returns page", "صفحة المرتجعات")}, choose the order and the
            lines you are returning, and say why. The request carries a status you can follow, which
            an email thread does not.
          </p>
          <p>
            Damage or a shortage should be reported within{" "}
            <strong className="text-ink-1">7 days of delivery</strong>, with photographs where the
            packaging or the item is visibly affected. Reporting later does not remove your statutory
            rights over faulty goods; it does make a carrier claim harder to evidence.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            افتح {link("/returns", "صفحة المرتجعات", "صفحة المرتجعات")}، واختر الطلب والبنود المراد
            إرجاعها، وبيّن السبب. ويحمل الطلب حالة يمكنك متابعتها، بخلاف رسالة البريد.
          </p>
          <p>
            ويجب الإبلاغ عن التلف أو النقص خلال{" "}
            <strong className="text-ink-1">7 أيام من التسليم</strong>، مع صور حيث يظهر الأثر على
            العبوة أو المنتج. والإبلاغ المتأخر لا يسقط حقوقك النظامية في البضاعة المعيبة، لكنه يجعل
            إثبات المطالبة لدى الناقل أصعب.
          </p>
        </>
      ),
    },
    {
      id: "cost",
      titleEn: "Who pays for the return",
      titleAr: "من يتحمل تكلفة الإرجاع",
      contentEn: (
        <>
          <p>
            If the item is faulty, damaged in transit, or not what was ordered,{" "}
            <strong className="text-ink-1">{name} or the supplier pays</strong> the return carriage.
          </p>
          <p>
            If you are returning because you changed your mind, the return carriage is yours, and any
            original delivery charge is not refunded.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            إذا كان المنتج معيبًا أو تضرر أثناء النقل أو لم يكن المطلوب، فإن{" "}
            <strong className="text-ink-1">{name} أو المورّد يتحمل</strong> أجرة الإرجاع.
          </p>
          <p>
            وإذا كان الإرجاع لتغيّر رأيك فأجرة الإرجاع عليك، ولا تُردّ رسوم التوصيل الأصلية.
          </p>
        </>
      ),
    },
    {
      id: "refunds",
      titleEn: "Refunds",
      titleAr: "المبالغ المستردة",
      contentEn: (
        <>
          <p>
            A refund is issued once the return is received and checked. It goes back to the original
            payment method; an account buyer is credited against the account.
          </p>
          <p>
            The date your bank posts the credit is set by the bank, not by {name}, so no settlement
            date is promised here. The status recorded against your return is the authoritative
            record of where it has reached.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            يُصرف المبلغ بعد استلام المرتجع وفحصه، ويُعاد إلى وسيلة الدفع الأصلية؛ أما المشتري بحساب
            فيُقيَّد المبلغ لحسابه.
          </p>
          <p>
            وتاريخ إضافة البنك للمبلغ يحدده البنك لا {name}، لذلك لا يُوعد هنا بتاريخ تسوية. والحالة
            المسجَّلة على مرتجعك هي السجل المعتمد لما وصل إليه.
          </p>
        </>
      ),
    },
  ];

  return (
    <MainLayout>
      <PolicyShell
        isAr={isAr}
        eyebrowEn="Returns"
        eyebrowAr="المرتجعات"
        titleEn="Returns and refunds"
        titleAr="الإرجاع واسترداد المبالغ"
        descriptionEn="What can be returned, how to raise a return, who pays the carriage, and how refunds are issued."
        descriptionAr="ما يمكن إرجاعه، وكيف تقدّم طلب الإرجاع، ومن يتحمل الأجرة، وكيف تُردّ المبالغ."
        sections={sections}
        datelineEn="Supplier terms may differ and are shown on the product before you order"
        datelineAr="قد تختلف شروط المورّد وتُعرض على صفحة المنتج قبل الطلب"
      />
    </MainLayout>
  );
}
