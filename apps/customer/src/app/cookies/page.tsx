import { cookies } from "next/headers";
import { MainLayout } from "@/components/layout/main-layout";
import { PolicyShell, type PolicySection } from "@/components/legal/policy-shell";
import { resetTtlLabel } from "@/app/auth/identity-copy";
import { CATEGORY_VISIT_LIMIT, SEARCH_LIMIT, SIGNAL_TTL_MS, VIEW_LIMIT } from "@/components/discovery/interest-signals";
import { DISMISSAL_TTL_MS } from "@/components/discovery/history-storage";
import { platformName } from "@avenick/utils/portal-config";

export const metadata = {
  title: `Cookies Policy`,
  description: `${platformName()} cookies policy, user tracking management, and data settings.`,
};

export const dynamic = "force-dynamic";

/**
 * WHAT THIS POLICY DESCRIBES, AND WHERE EACH FACT IS READ FROM.
 *
 * It said "no browsing statistics are collected". That was written on 2 Sep; on
 * 5 Sep the product view beacon shipped (components/product/view-beacon.tsx →
 * POST /api/signals/view), and from then on every product page counted a view.
 * The policy had not moved. It also listed browser storage as the cart, the
 * wishlist and the theme, while the Discovery panel keeps a trail of products,
 * categories and searches in localStorage; warned that blocking cookies breaks
 * "B2C shopping checkout flows" nobody can reach; and said partners "may place
 * cookies" under a Content-Security-Policy that admits no third-party script or
 * frame. So every section below states what the code does:
 *
 *   view count      ProductViewSignal (schema.prisma) holds productId, a UTC day
 *                   and a count — no user, address, device or session column.
 *   the two records route.ts: a per-address ingest cap (60s window) and a
 *                   salted, truncated SHA-256 fence of address+product+day (24h
 *                   window), both in the rate-limit store, never in Postgres.
 *                   That store is Upstash Redis wherever it is configured, so
 *                   the policy says neither record is kept WITH THE COUNT and
 *                   each expires on its own — true of either store — rather
 *                   than "not written to our database", which a Redis store
 *                   makes arguable.
 *   local trail     interest-signals.ts and history-storage.ts. The limits and
 *                   ages are IMPORTED, not typed, so the policy cannot quote a
 *                   number the panel no longer uses.
 *   checkout draft  checkout-form.tsx keeps the address, payment choice and
 *                   typed code in sessionStorage ("avenick-checkout-draft") and
 *                   clears it once an order is accepted. A list that says it is
 *                   "everything the storefront stores in your browser" has to
 *                   name it — it is the one item that holds an address.
 *   other hosts     the Google Fonts @import in packages/ui/src/globals.css, and
 *                   manufacturer image hosts in next.config.mjs remotePatterns
 *                   (images are unoptimized, so the browser fetches them).
 *
 * The regression test beside components/legal checks the route windows and the
 * table's columns against these sentences.
 */
const DAY_SECONDS = 24 * 60 * 60;
const TRAIL_SECONDS = SIGNAL_TTL_MS / 1000;
const DISMISSAL_SECONDS = DISMISSAL_TTL_MS / 1000;
const daysEn = (seconds: number) => `${seconds / DAY_SECONDS} days`;
const daysAr = (seconds: number) => resetTtlLabel("ar", seconds, "");

const SECTIONS: PolicySection[] = [
  {
    id: "what-are-cookies",
    titleEn: "1. What cookies are",
    titleAr: "١. ما هي ملفات تعريف الارتباط",
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
    titleEn: "2. How we use cookies",
    titleAr: "٢. كيف نستخدم ملفات تعريف الارتباط",
    contentEn: (
      <>
        <p>{platformName()} uses cookies and browser storage to make the storefront work. Specifically, they:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>Keep you securely signed in to your account.</li>
          <li>Remember your language preference (Arabic or English).</li>
          <li>Keep your shopping cart, your wishlist and your light/dark theme choice in your browser&apos;s local storage as you move between pages.</li>
          <li>Remember, in your browser&apos;s local storage, the products you recently opened, the categories you browsed and your recent searches, so the Discovery panel can suggest where to look next. That trail stays in your browser.</li>
        </ul>
        <p>We do not set analytics or advertising cookies. One thing is counted: when a product page opens, it tells the platform that the product was viewed. What is stored is the number of views each product received on each day, which ranks the products shown as trending. That count holds no account, network address, device or browser detail, and nothing that identifies you.</p>
        <p>Two short-lived records make the count possible. Neither is stored with the count, and each expires on its own. Your network address is used for up to a minute to cap how many view reports one address can send. A one-way digest of your address, the product and the date, from which the address cannot be recovered, lets each visitor count once per product per day; it lapses within 24 hours.</p>
      </>
    ),
    contentAr: (
      <>
        <p>تستخدم المنصة ملفات تعريف الارتباط وتخزين المتصفح لتشغيل المتجر. وبشكل خاص، فهي:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>تبقيكم مسجلين الدخول بأمان إلى حساباتكم.</li>
          <li>تحفظ اختياركم اللغوي المفضل (العربية أو الإنجليزية).</li>
          <li>تحفظ سلة التسوق وقائمة الأمنيات واختيار المظهر (الفاتح أو الداكن) في التخزين المحلي لمتصفحكم أثناء التنقل بين الصفحات.</li>
          <li>تحفظ في التخزين المحلي لمتصفحكم المنتجات التي فتحتموها مؤخراً والفئات التي تصفحتموها وعمليات بحثكم الأخيرة، لتقترح عليكم لوحة الاستكشاف أين تبحثون بعد ذلك. ويبقى هذا السجل في متصفحكم.</li>
        </ul>
        <p>لا نضع ملفات تعريف ارتباط للتحليلات أو الإعلانات. ونحتسب أمراً واحداً فقط: عند فتح صفحة منتج، تُبلغ الصفحة المنصة بأن المنتج قد شوهد. وما يُخزَّن هو عدد مشاهدات كل منتج في كل يوم، ويُستخدم لترتيب المنتجات المعروضة ضمن الأكثر رواجاً. ولا يتضمن هذا العدد أي حساب أو عنوان شبكة أو بيانات جهاز أو متصفح، ولا أي شيء يدل على هويتكم.</p>
        <p>ويعتمد هذا الاحتساب على سجلين قصيري الأجل، لا يُحفظ أيٌّ منهما مع عدد المشاهدات، وينتهي كلٌّ منهما من تلقاء نفسه: يُستخدم عنوان شبكتكم لمدة أقصاها دقيقة واحدة لتحديد عدد بلاغات المشاهدة التي يمكن أن تصدر من عنوان واحد، وتُستخدم بصمة أحادية الاتجاه لعنوانكم مع المنتج والتاريخ — لا يمكن استرجاع العنوان منها — لاحتساب كل زائر مرة واحدة لكل منتج في اليوم، وتسقط خلال 24 ساعة.</p>
      </>
    ),
  },
  {
    id: "types",
    titleEn: "3. Types of cookies we use",
    titleAr: "٣. أنواع ملفات تعريف الارتباط التي نستخدمها",
    contentEn: (
      <>
        <p>Everything the storefront stores in your browser falls into one of these categories:</p>
        <ul className="list-disc ps-5 space-y-2 mt-2">
          <li><strong>Necessary cookies:</strong> the session, CSRF and sign-in return-address cookies set when you sign in, which account sign-in, company approval workflows and checkout depend on. The site cannot function properly without these.</li>
          <li><strong>Functional cookies:</strong> your active language (`AVENICK_LOCALE`), set when you use the language switch and kept for a year.</li>
          <li><strong>Local storage (not a cookie):</strong> your cart, your wishlist and your light/dark theme choice. Also the Discovery trail: up to {VIEW_LIMIT} products you opened, {CATEGORY_VISIT_LIMIT} category visits and {SEARCH_LIMIT} search terms, each dropped after {daysEn(TRAIL_SECONDS)}; and, if you hide the Discovery panel, the time you hid it, which is honoured for {daysEn(DISMISSAL_SECONDS)}. The panel itself can clear the trail.</li>
          <li><strong>Session storage (not a cookie):</strong> while you check out, the delivery address you entered, the payment method you chose and any code you typed, so that stepping back to the cart does not lose them. It is kept for that browser tab only, and is removed when the order is placed or the tab is closed.</li>
        </ul>
        <p>There is no performance, analytics or advertising category. The product view count described above is not a cookie and stores nothing in your browser.</p>
      </>
    ),
    contentAr: (
      <>
        <p>كل ما يخزنه المتجر في متصفحكم يندرج ضمن إحدى هذه الفئات:</p>
        <ul className="list-disc ps-5 space-y-2 mt-2">
          <li><strong>ملفات أساسية ولازمة:</strong> ملفات الجلسة وحماية CSRF وعنوان العودة بعد تسجيل الدخول، وتُنشأ عند تسجيل الدخول، ويعتمد عليها تسجيل الدخول وتدفقات اعتماد أوامر الشراء للشركات وإجراءات الدفع. لا يمكن للموقع العمل بدونها.</li>
          <li><strong>ملفات وظيفية:</strong> تفضيل اللغة النشطة (`AVENICK_LOCALE`)، ويُضبط عند استخدام زر تبديل اللغة ويُحتفظ به لمدة سنة.</li>
          <li><strong>التخزين المحلي (ليس ملف تعريف ارتباط):</strong> سلة التسوق وقائمة الأمنيات واختيار المظهر (الفاتح أو الداكن). وكذلك سجل الاستكشاف: حتى {VIEW_LIMIT} من المنتجات التي فتحتموها، و{CATEGORY_VISIT_LIMIT} من زيارات الفئات، و{SEARCH_LIMIT} من عبارات البحث، ويُحذف كلٌّ منها بعد {daysAr(TRAIL_SECONDS)}؛ وإذا أخفيتم لوحة الاستكشاف، يُحفظ وقت إخفائها ويُعمل به لمدة {daysAr(DISMISSAL_SECONDS)}. ويمكن مسح السجل من اللوحة نفسها.</li>
          <li><strong>تخزين الجلسة (ليس ملف تعريف ارتباط):</strong> أثناء إتمام الطلب، عنوان التوصيل الذي أدخلتموه وطريقة الدفع التي اخترتموها وأي رمز كتبتموه، حتى لا تضيع إذا عدتم إلى السلة. ويبقى ذلك في علامة التبويب هذه فقط، ويُحذف عند تقديم الطلب أو إغلاق علامة التبويب.</li>
        </ul>
        <p>لا توجد فئة للأداء أو التحليلات أو الإعلانات. واحتساب مشاهدات المنتجات الموضّح أعلاه ليس ملف تعريف ارتباط ولا يخزّن شيئاً في متصفحكم.</p>
      </>
    ),
  },
  {
    id: "management",
    titleEn: "4. Managing cookie preferences",
    titleAr: "٤. إدارة تفضيلات ملفات تعريف الارتباط",
    contentEn: (
      <>
        <p>You can manage or disable cookies in your browser settings (for example Chrome, Safari or Edge). Blocking the necessary cookies stops you signing in, and with it checkout and the company workspace.</p>
        <p>The language cookie `AVENICK_LOCALE` can be changed at any time with the language switch in the storefront header. Clearing this site&apos;s data in your browser removes the cart, the wishlist, the theme choice and the Discovery trail.</p>
      </>
    ),
    contentAr: (
      <>
        <p>يمكنكم إدارة ملفات تعريف الارتباط أو تعطيلها من إعدادات متصفحكم (مثل كروم أو سفاري أو إيدج). ويؤدي حظر الملفات الأساسية إلى تعذّر تسجيل الدخول، ومعه إتمام الطلب ومساحة عمل الشركة.</p>
        <p>يمكن تعديل ملف تعريف ارتباط اللغة `AVENICK_LOCALE` في أي وقت باستخدام زر تبديل اللغة في ترويسة المتجر. ومسح بيانات هذا الموقع من متصفحكم يزيل السلة وقائمة الأمنيات واختيار المظهر وسجل الاستكشاف.</p>
      </>
    ),
  },
  {
    id: "third-parties",
    titleEn: "5. Third parties",
    titleAr: "٥. الأطراف الثالثة",
    contentEn: (
      <>
        <p>The storefront loads no third-party scripts and embeds no third-party frames. Two kinds of file are fetched from other hosts: the typefaces, which come from Google Fonts, and some product images, which load directly from the host that serves them, such as a manufacturer&apos;s own website. Those hosts receive the request as they would from any page that uses their files.</p>
      </>
    ),
    contentAr: (
      <>
        <p>لا يحمّل المتجر أي نصوص برمجية من أطراف ثالثة، ولا يضمّن إطارات منها. ويُجلب نوعان من الملفات من مواقع أخرى: الخطوط، وتأتي من Google Fonts، وبعض صور المنتجات، وتُحمَّل مباشرة من الخادم الذي يستضيفها، كموقع الشركة المصنّعة. وتتلقى تلك المواقع الطلب كما تتلقاه من أي صفحة تستخدم ملفاتها.</p>
      </>
    ),
  },
  {
    id: "updates",
    titleEn: "6. Policy updates",
    titleAr: "٦. تحديثات هذه السياسة",
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

  // The layout is <PolicyShell>, shared with every other information page; see
  // the note there on why a policy is one ruled sheet rather than a card per
  // section. No "last updated" date is typed, because nothing records one — the
  // shell's default dateline says so.
  return (
    <MainLayout>
      <PolicyShell
        isAr={isAr}
        eyebrowEn="Legal"
        eyebrowAr="الشؤون القانونية"
        titleEn="Cookies Policy"
        titleAr="سياسة ملفات تعريف الارتباط"
        descriptionEn="What the platform stores in your browser, and why."
        descriptionAr="يوضح هذا الدليل ما تخزنه المنصة في متصفحكم ولماذا."
        sections={SECTIONS}
      />
    </MainLayout>
  );
}
