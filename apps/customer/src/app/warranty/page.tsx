import { cookies } from "next/headers";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { PolicyShell, type PolicySection } from "@/components/legal/policy-shell";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = {
  title: "Warranty claims",
  description: `${platformName()} warranty claims — who honours a warranty, what to send, and how a claim is handled.`,
};

export const dynamic = "force-dynamic";

/**
 * Warranty claims.
 *
 * ── A NOTE FOR WHOEVER EDITS THIS NEXT ────────────────────────────────────
 * Standard marketplace terms, written at the operator's instruction to be
 * amended after legal review. Like /returns-policy this is a commitment rather
 * than a description of anything the system records.
 *
 * THE ONE THING NOT TO CHANGE CASUALLY: this page does not state a warranty
 * PERIOD. It cannot. A warranty period is set by the manufacturer and differs
 * per product — a blanket "12 months on everything" would be a promise the
 * platform makes on behalf of suppliers it does not control, enforceable
 * against it, and wrong for most of the catalogue. The page says where the
 * period comes from instead, which is both true and useful.
 *
 * It also does not claim {name} repairs anything. The platform routes a claim
 * to the party who owes the remedy; saying otherwise would invent a service
 * operation that does not exist.
 */
export default async function WarrantyPage() {
  const isAr = ((await cookies()).get("AVENICK_LOCALE")?.value ?? "en") === "ar";
  const name = platformName();

  const link = (href: string, en: string, ar: string) => (
    <Link href={href} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
      {isAr ? ar : en}
    </Link>
  );

  const sections: PolicySection[] = [
    {
      id: "who",
      titleEn: "Who honours the warranty",
      titleAr: "من يلتزم بالضمان",
      contentEn: (
        <>
          <p>
            Goods are sold by approved suppliers, and a warranty is given by the manufacturer or by
            that supplier. {name} does not issue a warranty of its own and does not repair goods; it
            routes your claim to the party who owes the remedy and records what happens to it.
          </p>
          <p>
            The warranty period, and what it covers, are set by the manufacturer and differ by
            product. They are stated on the product listing, in the documentation supplied with the
            goods, or on the quotation the order was raised against. This page does not state a
            single period, because there is no single period to state.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            تُباع البضائع عبر موردين معتمدين، والضمان يقدّمه المصنّع أو ذلك المورّد. ولا تصدر {name}{" "}
            ضمانًا خاصًا بها ولا تتولى الإصلاح؛ بل تحيل مطالبتك إلى الجهة الملزمة بالمعالجة وتسجّل ما
            يجري عليها.
          </p>
          <p>
            أما مدة الضمان وما يغطيه فيحددهما المصنّع ويختلفان بحسب المنتج، ويُذكران في صفحة المنتج
            أو في الوثائق المرفقة بالبضاعة أو في عرض السعر الذي صدر الطلب بموجبه. ولا تذكر هذه
            الصفحة مدة واحدة لأنه لا توجد مدة واحدة.
          </p>
        </>
      ),
    },
    {
      id: "covered",
      titleEn: "What a warranty usually covers",
      titleAr: "ما يغطيه الضمان عادةً",
      contentEn: (
        <>
          <p>
            A manufacturer's warranty normally covers a defect in materials or workmanship that
            appears in normal use within the stated period.
          </p>
          <p>It normally does not cover:</p>
          <ul className="ms-5 list-disc space-y-1">
            <li>Fair wear and tear, and consumable parts that are expected to be replaced.</li>
            <li>Damage from misuse, accident, or use outside the product's rated conditions.</li>
            <li>Goods modified, dismantled or repaired by someone the manufacturer did not authorise.</li>
            <li>Damage from incorrect installation, supply voltage or storage.</li>
          </ul>
          <p>
            None of this affects your statutory rights over goods that were faulty when supplied.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            يغطي ضمان المصنّع عادةً عيوب المواد أو التصنيع التي تظهر في الاستعمال الطبيعي خلال المدة
            المذكورة.
          </p>
          <p>ولا يغطي عادةً:</p>
          <ul className="ms-5 list-disc space-y-1">
            <li>الاستهلاك الطبيعي والأجزاء المستهلكة التي يُتوقع استبدالها.</li>
            <li>التلف الناتج عن سوء الاستعمال أو الحوادث أو التشغيل خارج الظروف المقررة.</li>
            <li>البضائع التي عُدِّلت أو فُكّت أو أُصلحت لدى جهة غير معتمدة من المصنّع.</li>
            <li>التلف الناتج عن تركيب أو جهد كهربائي أو تخزين غير صحيح.</li>
          </ul>
          <p>ولا يمس ذلك حقوقك النظامية تجاه بضاعة كانت معيبة عند التوريد.</p>
        </>
      ),
    },
    {
      id: "raise",
      titleEn: "Raising a claim",
      titleAr: "تقديم المطالبة",
      contentEn: (
        <>
          <p>
            Open a ticket through {link("/support", "the support portal", "بوابة الدعم")} with the
            order open, so the claim is attached to the order rather than described in prose. Include:
          </p>
          <ul className="ms-5 list-disc space-y-1">
            <li>The order reference and the affected line.</li>
            <li>What the fault is and when it appeared.</li>
            <li>Photographs or a short video where the fault is visible.</li>
            <li>The serial or batch number where the product carries one.</li>
          </ul>
          <p>
            If the item is faulty on arrival rather than after use, raise it as a return instead —
            that route is faster. See {link("/returns-policy", "returns and refunds", "الإرجاع واسترداد المبالغ")}.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            افتح تذكرة عبر {link("/support", "بوابة الدعم", "بوابة الدعم")} والطلب مفتوح، لتُربط
            المطالبة بالطلب بدل وصفها نصًا. وأرفق:
          </p>
          <ul className="ms-5 list-disc space-y-1">
            <li>رقم الطلب والبند المتأثر.</li>
            <li>ما هو العطل ومتى ظهر.</li>
            <li>صورًا أو مقطعًا قصيرًا يظهر فيه العطل.</li>
            <li>الرقم التسلسلي أو رقم التشغيلة إن وُجد على المنتج.</li>
          </ul>
          <p>
            وإذا كان المنتج معيبًا عند الاستلام لا بعد الاستعمال، فقدّمه كطلب إرجاع لأن ذلك المسار
            أسرع. انظر {link("/returns-policy", "الإرجاع واسترداد المبالغ", "الإرجاع واسترداد المبالغ")}.
          </p>
        </>
      ),
    },
    {
      id: "outcome",
      titleEn: "What happens next",
      titleAr: "ما الذي يحدث بعد ذلك",
      contentEn: (
        <>
          <p>
            The claim goes to the supplier or manufacturer for assessment. The usual outcomes are
            repair, replacement, or a credit — which one applies is the warranty provider's decision
            under their terms, not a choice {name} makes for them.
          </p>
          <p>
            No assessment or turnaround time is promised here, because the assessment is performed by
            a third party and nothing in this system records a commitment from them. The status on
            your ticket is the authoritative record of where the claim has reached.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            تُحال المطالبة إلى المورّد أو المصنّع للتقييم. والنتائج المعتادة هي الإصلاح أو الاستبدال
            أو قيد المبلغ، وتحديد أيها ينطبق قرار لمقدّم الضمان وفق شروطه لا خيار تتخذه {name} نيابة
            عنه.
          </p>
          <p>
            ولا يُوعد هنا بمدة تقييم أو إنجاز، لأن التقييم يجريه طرف ثالث ولا يسجّل النظام التزامًا
            منه. وحالة تذكرتك هي السجل المعتمد لما وصلت إليه المطالبة.
          </p>
        </>
      ),
    },
  ];

  return (
    <MainLayout>
      <PolicyShell
        isAr={isAr}
        eyebrowEn="Warranty"
        eyebrowAr="الضمان"
        titleEn="Warranty claims"
        titleAr="مطالبات الضمان"
        descriptionEn="Who honours a warranty on this marketplace, what a claim needs, and how it is handled."
        descriptionAr="من يلتزم بالضمان في هذا السوق، وما تحتاجه المطالبة، وكيف تُعالج."
        sections={sections}
        datelineEn="Warranty periods are set by the manufacturer and stated on the product, not here"
        datelineAr="يحدد المصنّع مدد الضمان وتُذكر على المنتج لا هنا"
      />
    </MainLayout>
  );
}
