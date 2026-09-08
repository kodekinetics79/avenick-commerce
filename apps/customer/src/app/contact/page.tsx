import { cookies } from "next/headers";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { PolicyShell, type PolicySection } from "@/components/legal/policy-shell";
import { companyHeadquarters, formatAddress, gccTradingEntity } from "@/lib/company";
import { platformContacts, platformName } from "@avenick/utils/portal-config";

export const metadata = {
  title: "Contact",
  description: `How to reach ${platformName()} — support, legal and privacy contacts, and the company address.`,
};

export const dynamic = "force-dynamic";

/**
 * Contact.
 *
 * WHAT THIS PAGE REFUSES TO DO. It does not print a phone number, a WhatsApp
 * line, office hours or a response-time promise, because nothing in this system
 * records any of them. "We reply within 24 hours" is the cheapest sentence on
 * any contact page and the one most likely to be false; the support portal
 * shows the status actually recorded against a ticket, so the page sends people
 * there instead of guaranteeing a window.
 *
 * Addresses and mailboxes are configuration, never typed here — see
 * @/lib/company and portal-config. Where a mailbox is unconfigured the section
 * points at the support portal rather than rendering a dead mailto:.
 */
export default async function ContactPage() {
  const isAr = ((await cookies()).get("AVENICK_LOCALE")?.value ?? "en") === "ar";
  const name = platformName();
  const { support, legal, privacy } = platformContacts();
  const hq = companyHeadquarters();
  const gcc = gccTradingEntity();

  const mail = (addr: string) => (
    <a href={`mailto:${addr}`} className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
      {addr}
    </a>
  );
  const supportLink = (
    <Link href="/support" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
      {isAr ? "بوابة الدعم" : "the support portal"}
    </Link>
  );

  const sections: PolicySection[] = [
    {
      id: "support",
      titleEn: "Support",
      titleAr: "الدعم",
      contentEn: (
        <>
          <p>
            Open a ticket through {supportLink}. A ticket carries a status you can follow, which an
            email thread does not.
          </p>
          {support ? <p>You can also write to {mail(support)}.</p> : null}
          <p>
            For a question about a specific order, open the order first — the ticket is then attached
            to it and support can see what you are looking at.
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            افتح تذكرة عبر {supportLink}. التذكرة تحمل حالة يمكنك متابعتها، بخلاف رسالة البريد.
          </p>
          {support ? <p>ويمكنك أيضًا المراسلة على {mail(support)}.</p> : null}
          <p>
            وللسؤال عن طلب بعينه، افتح الطلب أولًا لتُربط التذكرة به ويرى فريق الدعم ما تنظر إليه.
          </p>
        </>
      ),
    },
    {
      id: "company",
      titleEn: "Company",
      titleAr: "الشركة",
      contentEn: (
        <>
          <p>
            <strong className="text-ink-1">Headquarters</strong>
            <br />
            {formatAddress(hq)}
          </p>
          {gcc ? (
            <p>
              <strong className="text-ink-1">Trading entity</strong>
              <br />
              {gcc.legalName}
              <br />
              {gcc.line1}, {gcc.city}, {gcc.country}
            </p>
          ) : (
            // Deliberate. The operator has confirmed a GCC entity exists, but its
            // registered name has not been supplied, and a company name on a
            // contract page is the least survivable thing to guess. Saying so is
            // better than an empty corner or an invented line.
            <p>
              The registered trading entity for GCC orders is named on your order confirmation and in
              the {" "}
              <Link href="/terms" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
                terms of service
              </Link>
              .
            </p>
          )}
        </>
      ),
      contentAr: (
        <>
          <p>
            <strong className="text-ink-1">المقر الرئيسي</strong>
            <br />
            {formatAddress(hq)}
          </p>
          {gcc ? (
            <p>
              <strong className="text-ink-1">الكيان التجاري</strong>
              <br />
              {gcc.legalName}
              <br />
              {gcc.line1}، {gcc.city}، {gcc.country}
            </p>
          ) : (
            <p>
              يُذكر الكيان التجاري المسجَّل لطلبات الخليج في تأكيد طلبك وفي{" "}
              <Link href="/terms" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
                شروط الخدمة
              </Link>
              .
            </p>
          )}
        </>
      ),
    },
    {
      id: "legal",
      titleEn: "Legal and privacy",
      titleAr: "الشؤون القانونية والخصوصية",
      contentEn: (
        <>
          <p>
            Legal notices: {legal ? mail(legal) : <>via {supportLink}</>}.
          </p>
          <p>
            Data protection and privacy requests: {privacy ? mail(privacy) : <>via {supportLink}</>}. What
            {" "}{name} stores and why is set out in the{" "}
            <Link href="/privacy" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </>
      ),
      contentAr: (
        <>
          <p>
            الإشعارات القانونية: {legal ? mail(legal) : <>عبر {supportLink}</>}.
          </p>
          <p>
            طلبات حماية البيانات والخصوصية: {privacy ? mail(privacy) : <>عبر {supportLink}</>}. وما
            تحتفظ به {name} ولماذا موضّح في{" "}
            <Link href="/privacy" className="u-focus rounded-nested font-medium text-primary-ink hover:underline">
              سياسة الخصوصية
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "selling",
      titleEn: "Selling on the platform",
      titleAr: "البيع عبر المنصة",
      contentEn: (
        <p>
          Suppliers apply through the seller portal. Applications are reviewed — including the
          commercial registration — before a storefront goes live.
        </p>
      ),
      contentAr: (
        <p>
          يتقدّم الموردون عبر بوابة البائعين. وتُراجع الطلبات — بما فيها السجل التجاري — قبل تفعيل أي
          متجر.
        </p>
      ),
    },
  ];

  return (
    <MainLayout>
      <PolicyShell
        isAr={isAr}
        eyebrowEn="Contact"
        eyebrowAr="اتصل بنا"
        titleEn={`Contact ${name}`}
        titleAr={`التواصل مع ${name}`}
        descriptionEn="Where to send a question, a legal notice or a privacy request, and who the company is."
        descriptionAr="أين ترسل استفسارك أو إشعارك القانوني أو طلب الخصوصية، ومن هي الشركة."
        sections={sections}
        datelineEn="Addresses and mailboxes are read from this deployment's configuration"
        datelineAr="تُقرأ العناوين وصناديق البريد من إعدادات هذا النشر"
      />
    </MainLayout>
  );
}
