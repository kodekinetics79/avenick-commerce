import { cookies } from "next/headers";
import { Info, Settings, ShieldCheck, EyeOff, Activity, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = {
  title: `Cookies Policy — ${platformName()}`,
  description: `${platformName()} cookies policy, user tracking management, and data settings.`,
};

export const dynamic = "force-dynamic";

interface LegalSection {
  id: string;
  titleEn: string;
  titleAr: string;
  contentEn: React.ReactNode;
  contentAr: React.ReactNode;
  icon: typeof Info;
}

const SECTIONS: LegalSection[] = [
  {
    id: "what-are-cookies",
    titleEn: "1. What Are Cookies",
    titleAr: "١. ما هي ملفات تعريف الارتباط",
    icon: Info,
    contentEn: (
      <>
        <p>Cookies are small text files stored on your computer or mobile device when you visit websites. They are widely used to make websites work or perform more efficiently, as well as to provide information to the owners of the site.</p>
        <p>We use the term &quot;cookies&quot; to refer to cookies and similar tracking technologies (such as web beacons, pixels, and local storage).</p>
      </>
    ),
    contentAr: (
      <>
        <p>ملفات تعريف الارتباط (Cookies) هي ملفات نصية صغيرة يتم تخزينها على جهاز الكمبيوتر أو الهاتف المحمول عند زيارتكم للمواقع الإلكترونية. وتُستخدم على نطاق واسع لتمكين المواقع من العمل بشكل أفضل وأكثر كفاءة، وتزويد مالكي المواقع بالمعلومات الإحصائية.</p>
        <p>نحن نستخدم مصطلح &quot;ملفات تعريف الارتباط&quot; للإشارة إلى الكوكيز والتقنيات المماثلة للتتبع (مثل منارات الويب، والبكسلات، والتخزين المحلي).</p>
      </>
    ),
  },
  {
    id: "how-we-use",
    titleEn: "2. How We Use Cookies",
    titleAr: "٢. كيف نستخدم ملفات تعريف الارتباط",
    icon: ShieldCheck,
    contentEn: (
      <>
        <p>{platformName()} uses cookies and browser storage only to make the storefront work. Specifically, they:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>Keep you securely signed in to your B2B or consumer account.</li>
          <li>Remember your language preference (Arabic or English).</li>
          <li>Persist items inside your shopping cart and wishlist, and your light/dark theme choice, in your browser&apos;s local storage as you navigate between products.</li>
        </ul>
        <p>We do not run analytics or advertising cookies, and no browsing statistics are collected.</p>
      </>
    ),
    contentAr: (
      <>
        <p>تستخدم المنصة ملفات تعريف الارتباط وتخزين المتصفح فقط لتشغيل المتجر. وبشكل خاص، فهي:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>تبقيكم مسجلين الدخول بأمان إلى حساباتكم التجارية أو الشخصية.</li>
          <li>تحفظ اختياركم اللغوي المفضل (العربية أو الإنجليزية).</li>
          <li>تحفظ المنتجات المضافة إلى سلة التسوق وقائمة الأمنيات واختيار المظهر (الفاتح أو الداكن) في التخزين المحلي لمتصفحكم أثناء التنقل بين الصفحات.</li>
        </ul>
        <p>لا نستخدم ملفات تعريف ارتباط للتحليلات أو الإعلانات، ولا نجمع أي إحصاءات تصفح.</p>
      </>
    ),
  },
  {
    id: "types",
    titleEn: "3. Types of Cookies We Use",
    titleAr: "٣. أنواع ملفات تعريف الارتباط التي نستخدمها",
    icon: Activity,
    contentEn: (
      <>
        <p>Everything the storefront stores in your browser falls into one of these categories:</p>
        <ul className="list-disc ps-5 space-y-2 mt-2">
          <li><strong>Necessary Cookies:</strong> The session and CSRF cookies set at sign-in, which account login, B2B approval workflows, and checkout depend on. The site cannot function properly without these.</li>
          <li><strong>Functional Cookies:</strong> Your active language (`AVENICK_LOCALE`), stored so it persists across sessions.</li>
          <li><strong>Local Storage (not a cookie):</strong> Your cart, wishlist, and light/dark theme choice, kept in your browser&apos;s local storage and never sent to us as tracking data.</li>
        </ul>
        <p>There is no performance or analytics category: the platform sets no analytics cookies.</p>
      </>
    ),
    contentAr: (
      <>
        <p>كل ما يخزنه المتجر في متصفحكم يندرج ضمن إحدى هذه الفئات:</p>
        <ul className="list-disc ps-5 space-y-2 mt-2">
          <li><strong>ملفات أساسية ولازمة:</strong> ملفات الجلسة وحماية CSRF التي تُنشأ عند تسجيل الدخول، ويعتمد عليها تسجيل الدخول وتدفقات اعتماد أوامر الشراء B2B وإجراءات الدفع. لا يمكن للموقع العمل بدونها.</li>
          <li><strong>ملفات وظيفية:</strong> تفضيل اللغة النشطة (`AVENICK_LOCALE`) لاسترجاعه عند الزيارات القادمة.</li>
          <li><strong>التخزين المحلي (ليس ملف تعريف ارتباط):</strong> سلة التسوق وقائمة الأمنيات واختيار المظهر (الفاتح أو الداكن)، تُحفظ في التخزين المحلي لمتصفحكم ولا تُرسل إلينا كبيانات تتبع.</li>
        </ul>
        <p>لا توجد فئة للأداء أو التحليلات: المنصة لا تضع أي ملفات تعريف ارتباط تحليلية.</p>
      </>
    ),
  },
  {
    id: "management",
    titleEn: "4. Managing Cookie Preferences",
    titleAr: "٤. إدارة تفضيلات ملفات تعريف الارتباط",
    icon: Settings,
    contentEn: (
      <>
        <p>You can manage or disable cookies by adjusting your internet browser settings (e.g. Chrome, Safari, Edge). Please note that blocking essential cookies will disrupt B2B dashboard authentication and B2C shopping checkout flows.</p>
        <p>Our bilingual preference cookie `AVENICK_LOCALE` can be modified anytime using the language toggle in our storefront header.</p>
      </>
    ),
    contentAr: (
      <>
        <p>يمكنكم إدارة أو تعطيل ملفات تعريف الارتباط من خلال ضبط إعدادات متصفح الإنترنت الخاص بكم (مثل كروم، سفاري، إيدج). ويرجى العلم بأن حظر الكوكيز الأساسية سيؤدي لتعطيل مصادقة بوابة B2B وسلة تسوق B2C.</p>
        <p>يمكن تعديل ملف تعريف ارتباط التفضيل اللغوي `AVENICK_LOCALE` في أي وقت باستخدام زر تبديل اللغة في شريط ترويسة الموقع.</p>
      </>
    ),
  },
  {
    id: "third-parties",
    titleEn: "5. Third-party Tracking",
    titleAr: "٥. التتبع بواسطة أطراف ثالثة",
    icon: EyeOff,
    contentEn: (
      <>
        <p>We may integrate trusted third-party services (such as regional GCC logistics trackers or payment processing gateways) to deliver seamless ordering. These partners may place cookies on your device to track delivery status or complete payments.</p>
      </>
    ),
    contentAr: (
      <>
        <p>قد نقوم بدمج خدمات موثوقة لأطراف ثالثة (مثل أنظمة تتبع الشحنات الإقليمية أو بوابات الدفع الإلكتروني) لتسهيل المعاملات. وقد يضع هؤلاء الشركاء ملفات تعريف ارتباط على أجهزتكم لتتبع حالة التسليم أو إكمال عمليات الدفع.</p>
      </>
    ),
  },
  {
    id: "updates",
    titleEn: "6. Policy Updates",
    titleAr: "٦. تحديثات هذه السياسة",
    icon: RefreshCw,
    contentEn: (
      <>
        <p>We may update this Cookies Policy from time to time to reflect modifications in our tracking practices or GCC privacy regulations. We recommend reviewing this page periodically to remain informed.</p>
      </>
    ),
    contentAr: (
      <>
        <p>قد نقوم بتحديث سياسة ملفات تعريف الارتباط هذه من وقت لآخر لتعكس التعديلات في ممارسات التتبع أو لوائح الخصوصية الخليجية. وننصح بمراجعة هذه الصفحة بشكل دوري لتظلوا على اطلاع.</p>
      </>
    ),
  },
];

export default async function CookiesPage() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("AVENICK_LOCALE")?.value ?? "en";
  const isAr = locale === "ar";

  return (
    <MainLayout>
      <div className="relative overflow-hidden min-h-screen bg-background text-foreground py-10 lg:py-16">
        {/* Subtle decorative grid */}
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-20 start-1/4 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-20 end-1/4 h-80 w-80 rounded-full bg-accent/10 blur-[120px]" />

        <div className="relative max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="mb-10 text-center max-w-2xl mx-auto">
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-3">
              {isAr ? "سياسة ملفات تعريف الارتباط" : "Cookies Policy"}
            </h1>
            {/* No "last updated" date: nothing records when this text changed,
                so a typed date would be a claim the platform cannot back. */}
            <p className="text-muted-foreground text-sm">
              {isAr
                ? "يوضح هذا الدليل ما تخزنه المنصة في متصفحكم ولماذا."
                : "This guide explains what the platform stores in your browser and why."}
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
