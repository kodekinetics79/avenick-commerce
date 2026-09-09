import { cookies } from "next/headers";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { PolicyShell, type PolicySection } from "@/components/legal/policy-shell";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = {
  title: "Delivery",
  description: `${platformName()} delivery — coverage, how charges and timing are confirmed, and what to do if an order arrives damaged.`,
};

export const dynamic = "force-dynamic";

/**
 * Delivery.
 *
 * ── A NOTE FOR WHOEVER EDITS THIS NEXT ────────────────────────────────────
 * This page is the easiest one in the product to break, and the way to break it
 * is to add a table of cities and delivery times.
 *
 * The support FAQ already answers this question, and answers it carefully:
 * "Coverage, delivery timing, charges, and tracking availability are confirmed
 * for each order during processing. The storefront does not promise a carrier
 * or delivery window before confirmation." The utility bar across every page of
 * the storefront says the same thing. That restraint is deliberate — orders are
 * fulfilled by many suppliers out of many locations, and no shipping zone table
 * in this repository can predict which one serves a given line.
 *
 * So this page EXPANDS that answer; it must not contradict it. A "2–4 working
 * days to Riyadh" row would be a promise the platform cannot keep and did not
 * make anywhere else, and it would make the storefront argue with itself in
 * front of a buyer who read both pages.
 *
 * If real delivery commitments exist later, they belong in the shipping-zone
 * data the schema already carries, rendered from that data — not typed here.
 */
export default async function ShippingPage() {
  const isAr = ((await cookies()).get("AVENICK_LOCALE")?.value ?? "en") === "ar";
  const name = platformName();

  const link = (href: string, en: string, ar: string) => (
    <Link href={href} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
      {isAr ? ar : en}
    </Link>
  );

  const sections: PolicySection[] = [
    {
      id: "confirmation",
      titleEn: "Timing and charges are confirmed per order",
      titleAr: "تُؤكَّد المدة والرسوم لكل طلب",
      contentEn: (
        <>
          <p>
            Coverage, delivery timing, charges and whether tracking is available are confirmed for
            each order while it is processed. {name} does not promise a carrier or a delivery window
            before that confirmation.
          </p>
          <p>
            That is not caution for its own sake: orders are fulfilled by approved suppliers from
            their own locations, and which supplier serves a given line — and from where — is settled
            when the order is processed, not when it is placed.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            يُؤكَّد نطاق التوصيل ومدته ورسومه وإمكانية التتبع لكل طلب أثناء معالجته. ولا تعد {name}{" "}
            بناقل أو مدة توصيل قبل ذلك التأكيد.
          </p>
          <p>
            وليس ذلك تحفظًا لذاته: فالطلبات ينفّذها موردون معتمدون من مواقعهم، وتحديد المورّد الذي
            يخدم بندًا بعينه — ومن أين — يتم عند معالجة الطلب لا عند تقديمه.
          </p>
        </>
      ),
    },
    {
      id: "coverage",
      titleEn: "Where we deliver",
      titleAr: "أين نوصّل",
      contentEn: (
        <>
          <p>
            {name} serves the GCC markets. Whether a given address can be served, and by which
            supplier, is determined at checkout and during processing — an address the platform
            cannot serve is refused at that point rather than accepted and cancelled later.
          </p>
          <p>
            Large, heavy or hazardous goods may need a delivery method the standard carrier does not
            offer. Where that applies it is raised against the order before dispatch.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            تخدم {name} أسواق دول الخليج. أما إمكانية خدمة عنوان بعينه وبأي مورّد فتُحدَّد عند إتمام
            الطلب وأثناء المعالجة — والعنوان الذي لا تستطيع المنصة خدمته يُرفض عندئذ بدل قبوله ثم
            إلغائه لاحقًا.
          </p>
          <p>
            وقد تحتاج البضائع الكبيرة أو الثقيلة أو الخطرة إلى وسيلة توصيل لا يوفرها الناقل
            الاعتيادي، ويُنبَّه إلى ذلك على الطلب قبل الشحن.
          </p>
        </>
      ),
    },
    {
      id: "tracking",
      titleEn: "Following an order",
      titleAr: "متابعة الطلب",
      contentEn: (
        <p>
          Your {link("/account/orders", "orders page", "صفحة الطلبات")} shows the status actually
          recorded against each order. Where the carrier provides tracking, it appears there once the
          order is dispatched. Where it does not, the page says so rather than showing an empty
          tracking panel.
        </p>
      ),
      contentAr: (
        <p>
          تعرض {link("/account/orders", "صفحة طلباتك", "صفحة طلباتك")} الحالة المسجَّلة فعليًا على كل
          طلب. وحيث يوفر الناقل تتبعًا يظهر هناك بعد الشحن، وحيث لا يوفره تذكر الصفحة ذلك بدل عرض
          لوحة تتبع فارغة.
        </p>
      ),
    },
    {
      id: "problems",
      titleEn: "Damage, shortage or a missed delivery",
      titleAr: "التلف أو النقص أو تعذّر التسليم",
      contentEn: (
        <>
          <p>
            Check the consignment on arrival. Report damage or a shortage within{" "}
            <strong className="text-ink-1">7 days of delivery</strong>, with photographs where the
            packaging or the goods are visibly affected — a carrier claim is much harder to evidence
            later.
          </p>
          <p>
            Raise it from {link("/returns", "your returns page", "صفحة المرتجعات")} against the order.
            What happens next, and who pays any carriage, is set out in{" "}
            {link("/returns-policy", "returns and refunds", "الإرجاع واسترداد المبالغ")}.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            افحص الشحنة عند الاستلام، وأبلغ عن التلف أو النقص خلال{" "}
            <strong className="text-ink-1">7 أيام من التسليم</strong>، مع صور حيث يظهر الأثر على
            العبوة أو البضاعة — فإثبات المطالبة لدى الناقل يصبح أصعب بكثير لاحقًا.
          </p>
          <p>
            وقدّم ذلك من {link("/returns", "صفحة المرتجعات", "صفحة المرتجعات")} على الطلب. وما يجري
            بعدها ومن يتحمل الأجرة موضّح في{" "}
            {link("/returns-policy", "الإرجاع واسترداد المبالغ", "الإرجاع واسترداد المبالغ")}.
          </p>
        </>
      ),
    },
  ];

  return (
    <MainLayout>
      <PolicyShell
        isAr={isAr}
        eyebrowEn="Delivery"
        eyebrowAr="التوصيل"
        titleEn="Delivery"
        titleAr="التوصيل"
        descriptionEn="How coverage, timing and charges are settled, how to follow an order, and what to do if something arrives damaged."
        descriptionAr="كيف تُحدَّد التغطية والمدة والرسوم، وكيف تتابع طلبك، وماذا تفعل إذا وصل شيء تالفًا."
        sections={sections}
        datelineEn="No delivery window is quoted here because none is promised before an order is confirmed"
        datelineAr="لا تُذكر هنا مدة توصيل لأنه لا يُوعد بها قبل تأكيد الطلب"
      />
    </MainLayout>
  );
}
