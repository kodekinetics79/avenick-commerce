/**
 * The identity track's copy, in two languages, as ONE dictionary.
 *
 * WHY THIS FILE EXISTS AT ALL, and the honest caveat.
 *
 * Round one shipped these screens with strings like `label="Email / البريد
 * الإلكتروني"` — both languages, welded together, shown to both audiences. That
 * is not bilingual; it is a product that never decided. An Arabic buyer read a
 * form whose every label carried an English word it did not need, and an English
 * buyer read the mirror image. It is also the exact defect the direction names:
 * "a page where two labels come from the message tree and one is hardcoded
 * eventually renders half-translated in front of an Arabic buyer, which says the
 * Arabic build is a setting rather than a design."
 *
 * The correct home for these strings is `apps/customer/messages/{en,ar}.json`
 * under an `identity` namespace, read through next-intl. That file is owned by
 * another track and was being edited concurrently while this one was written, so
 * this module is shaped EXACTLY like a next-intl namespace — flat groups, plain
 * strings, no JSX, interpolation by function argument — so lifting it is a copy
 * and a rename of the accessor, not a rewrite. See the cross-track request in
 * the handover note.
 *
 * LAW 9: no "use client" directive here. Server components call `identityCopy`
 * directly; a callable helper exported from a client module is replaced by a
 * client reference in the server graph and fails the production build with a
 * minified TypeError.
 *
 * THE ARABIC IS NOT A TRANSLATION OF THE ENGLISH. Where the two languages want
 * different phrasing they get it. What they never get is different FACTS: every
 * pair below states the same thing about the same system, because a promise that
 * exists in one locale and not the other is a truth defect wearing a flag.
 */

export type IdentityLocale = "en" | "ar";

/** The cookie the root layout reads. Kept here so pages do not re-spell it. */
export const LOCALE_COOKIE = "AVENICK_LOCALE";

export function toIdentityLocale(raw: string | undefined | null): IdentityLocale {
  return raw === "ar" ? "ar" : "en";
}

/**
 * The reset TTL as a person reads it, in the locale they are reading in.
 *
 * `passwordResetTtlLabel()` in lib/password-reset.ts derives the English form
 * from the same constant the token verifier enforces, so the promise can never
 * drift from the expiry. This is that function's Arabic half, and it takes the
 * seconds rather than the English string for the same reason — a translated
 * "30 minutes" would be a copy of a copy.
 *
 * WESTERN DIGITS, deliberately: DESIGN_SYSTEM.md §2.3 pins one numeral system
 * across both locales, which is GCC commerce convention and what lets a figure
 * stay tabular.
 */
export function resetTtlLabel(locale: IdentityLocale, ttlSeconds: number, englishLabel: string): string {
  if (locale === "en") return englishLabel;
  if (ttlSeconds % 3600 === 0) {
    const h = ttlSeconds / 3600;
    return h === 1 ? "ساعة واحدة" : h === 2 ? "ساعتين" : `${h} ساعات`;
  }
  if (ttlSeconds % 60 === 0) {
    const m = ttlSeconds / 60;
    return m === 1 ? "دقيقة واحدة" : m === 2 ? "دقيقتين" : `${m} دقيقة`;
  }
  return `${ttlSeconds} ثانية`;
}

/**
 * The three surfaces an account actually reaches on this deployment, with the
 * route each one IS.
 *
 * Printing the route is not decoration and it is not developer-facing whimsy: it
 * is the McMaster-Carr move the direction names — density of TRUE fact where a
 * template would put a stock illustration. It is checkable, it is the same in
 * both languages, and it is the one thing on a sign-in page that could not have
 * been written by a marketing team.
 *
 * Nothing here promises a delivery window, a response time, a discount or a
 * reply, because the platform measures and stores none of those. The support
 * line is deliberately narrow: a SupportTicket row carries a subject, a
 * category, a description and a status and NOTHING ELSE — there is no reply or
 * message column in schema.prisma.
 */
export interface AccountSurface {
  readonly label: string;
  readonly body: string;
  readonly route: string;
}

interface IdentityDictionary {
  readonly brand: {
    readonly eyebrow: string;
    readonly ledger: string;
    readonly provenance: string;
  };
  readonly surfaces: readonly AccountSurface[];
  readonly login: {
    readonly eyebrow: string;
    readonly title: string;
    readonly subtitle: string;
    readonly subtitleRegistered: string;
    readonly formLabel: string;
    readonly email: string;
    readonly emailPlaceholder: string;
    readonly password: string;
    readonly forgot: string;
    readonly submit: string;
    readonly noAccount: string;
    readonly register: string;
    readonly genericError: string;
    readonly errorInvalid: string;
    readonly errorThrottled: string;
  };
  readonly register: {
    readonly eyebrow: string;
    readonly title: string;
    readonly titleConsumer: string;
    readonly titleBusiness: string;
    readonly subtitle: (platform: string) => string;
    readonly chooserLabel: string;
    readonly consumerTitle: string;
    readonly consumerBody: string;
    readonly businessTitle: string;
    readonly businessBody: string;
    readonly changeType: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly emailPlaceholder: string;
    readonly password: string;
    readonly passwordHint: string;
    readonly phone: string;
    readonly phoneHint: string;
    readonly companySection: string;
    readonly companyNameEn: string;
    readonly companyNameAr: string;
    readonly crNumber: string;
    readonly vatNumber: string;
    readonly optional: string;
    readonly industry: string;
    readonly industryPlaceholder: string;
    readonly companySize: string;
    readonly companySizePlaceholder: string;
    readonly country: string;
    readonly countryPlaceholder: string;
    readonly city: string;
    readonly submit: string;
    readonly hasAccount: string;
    readonly signIn: string;
    readonly failed: string;
    readonly industryLabels: Readonly<Record<string, string>>;
    readonly companySizeLabels: Readonly<Record<string, string>>;
    readonly countryLabels: Readonly<Record<string, string>>;
  };
  readonly forgot: {
    readonly eyebrow: string;
    readonly title: string;
    readonly subtitle: string;
    readonly note: (ttl: string) => string;
    readonly formLabel: string;
    readonly email: string;
    readonly submit: string;
    readonly sent: (ttl: string) => string;
    readonly remembered: string;
    readonly signIn: string;
    readonly genericError: string;
  };
  readonly reset: {
    readonly eyebrow: string;
    readonly title: string;
    readonly subtitle: string;
    readonly note: (ttl: string) => string;
    readonly formLabel: string;
    readonly password: string;
    readonly passwordHint: string;
    readonly confirm: string;
    readonly confirmHint: string;
    readonly mismatch: string;
    readonly weak: string;
    readonly submit: string;
    readonly done: string;
    readonly signIn: string;
    readonly signInSeller: string;
    readonly missingToken: string;
    readonly deadToken: string;
    readonly usedToken: string;
    readonly noSecret: string;
    readonly requestNew: string;
    readonly backTo: string;
    readonly genericError: string;
  };
}

const EN: IdentityDictionary = {
  brand: {
    eyebrow: "Account",
    ledger: "What the account reaches",
    provenance: "Every surface named here exists on this deployment",
  },
  surfaces: [
    {
      label: "Orders",
      body: "Every order placed on this account, with the status currently recorded against it.",
      route: "/account/orders",
    },
    {
      label: "Returns",
      body: "Request a return on a delivered order, then follow its review.",
      route: "/returns",
    },
    {
      label: "Support",
      body: "Open a ticket and follow the status recorded against it.",
      route: "/support",
    },
  ],
  login: {
    eyebrow: "Sign in",
    title: "Welcome back",
    subtitle: "Sign in to see your orders, returns and support tickets.",
    // What this may NOT say is "your account has been created". Both
    // registration endpoints answer identically whether or not the address was
    // already registered — that neutrality is what stops the endpoint being a
    // free membership oracle — so the browser genuinely does not know which
    // branch ran. This is the sentence that is true in both.
    subtitleRegistered:
      "Registration received. Sign in with that email address — if it was already registered, use your existing password.",
    formLabel: "Sign in",
    email: "Email address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    forgot: "Forgot password?",
    submit: "Sign in",
    noAccount: "No account yet?",
    register: "Register",
    genericError: "Something went wrong. Please try again.",
    // These two mirror @avenick/auth's own outcomes and are never used in the
    // English build — the package's own strings are. They exist so the Arabic
    // build has the same two outcomes in its own language; see localiseSignInError.
    errorInvalid: "Invalid email or password.",
    errorThrottled: "Too many sign-in attempts. Please wait a few minutes and try again.",
  },
  register: {
    eyebrow: "Create an account",
    title: "Register",
    titleConsumer: "Personal account",
    titleBusiness: "Business account",
    subtitle: (platform) => `Choose how you will buy on ${platform}.`,
    chooserLabel: "Account type",
    consumerTitle: "Personal account",
    consumerBody: "Buy for yourself. No company details are required.",
    businessTitle: "Business account",
    businessBody: "Buy on behalf of a company. Needs a commercial registration number.",
    changeType: "Change account type",
    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordHint: "At least 8 characters, with an uppercase letter and a number.",
    phone: "Phone",
    phoneHint: "Optional. International format, including the country code.",
    companySection: "Company details",
    companyNameEn: "Company name (English)",
    companyNameAr: "Company name (Arabic)",
    crNumber: "Commercial registration number",
    vatNumber: "VAT number",
    optional: "Optional.",
    industry: "Industry",
    industryPlaceholder: "Select an industry",
    companySize: "Company size",
    companySizePlaceholder: "Select a size",
    country: "Country",
    countryPlaceholder: "Select a country",
    city: "City",
    submit: "Create account",
    hasAccount: "Already have an account?",
    signIn: "Sign in",
    failed: "Registration failed.",
    industryLabels: {
      INDUSTRIAL_SUPPLIES: "Industrial supplies",
      ELECTRONICS: "Electronics",
      OFFICE_SUPPLIES: "Office supplies",
      SAFETY_PPE: "Safety and PPE",
      FOOD_HOSPITALITY: "Food and hospitality",
      BUILDING_MATERIALS: "Building materials",
      HEALTHCARE: "Healthcare",
      RETAIL: "Retail",
      MANUFACTURING: "Manufacturing",
      TECHNOLOGY: "Technology",
      OTHER: "Other",
    },
    companySizeLabels: {
      MICRO: "Micro",
      SMALL: "Small",
      MEDIUM: "Medium",
      LARGE: "Large",
      ENTERPRISE: "Enterprise",
    },
    countryLabels: {
      AE: "United Arab Emirates",
      SA: "Saudi Arabia",
      QA: "Qatar",
      KW: "Kuwait",
      BH: "Bahrain",
      OM: "Oman",
    },
  },
  forgot: {
    eyebrow: "Password reset",
    title: "Forgot your password?",
    subtitle: "Enter your email address and we will send a link to choose a new one.",
    note: (ttl) => `A reset link is valid for ${ttl} from the moment it is requested.`,
    formLabel: "Request a password reset",
    email: "Email address",
    submit: "Send reset link",
    sent: (ttl) => `If an account exists for that address, a reset link has been sent. It expires in ${ttl}.`,
    remembered: "Remembered it?",
    signIn: "Sign in",
    genericError: "Something went wrong. Please try again.",
  },
  reset: {
    eyebrow: "Password reset",
    title: "Choose a new password",
    subtitle: "Pick something you have not used on this account before.",
    note: (ttl) => `Reset links expire ${ttl} after they are requested.`,
    formLabel: "Choose a new password",
    password: "New password",
    passwordHint: "At least 8 characters, with an uppercase letter and a number.",
    confirm: "Confirm password",
    confirmHint: "Type the same password again.",
    mismatch: "The two passwords do not match.",
    weak: "Choose a stronger password.",
    submit: "Update password",
    done: "Your password has been updated. Sign in with the new one.",
    signIn: "Sign in",
    signInSeller: "Sign in to the seller portal",
    missingToken: "This page needs the link from your reset email — the reset code is missing from the address.",
    deadToken: "This reset link is invalid or has expired.",
    usedToken: "This reset link is invalid, has expired, or has already been used.",
    noSecret: "Password reset is not available from this environment.",
    requestNew: "Request a new reset link",
    backTo: "Back to",
    genericError: "Something went wrong. Please try again.",
  },
};

const AR: IdentityDictionary = {
  brand: {
    eyebrow: "الحساب",
    ledger: "ما يصل إليه الحساب",
    provenance: "كل صفحة مذكورة هنا موجودة فعلياً في هذا الإصدار",
  },
  surfaces: [
    {
      label: "الطلبات",
      body: "كل طلب قُدّم على هذا الحساب، مع الحالة المسجّلة عليه حالياً.",
      route: "/account/orders",
    },
    {
      label: "المرتجعات",
      body: "اطلب إرجاع طلب تم تسليمه، ثم تابع مراجعته.",
      route: "/returns",
    },
    {
      label: "الدعم",
      body: "افتح تذكرة وتابع الحالة المسجّلة عليها.",
      route: "/support",
    },
  ],
  login: {
    eyebrow: "تسجيل الدخول",
    title: "أهلاً بعودتك",
    subtitle: "سجّل الدخول لعرض طلباتك ومرتجعاتك وتذاكر الدعم.",
    subtitleRegistered:
      "تم استلام طلب التسجيل. سجّل الدخول بهذا البريد الإلكتروني — وإن كان مسجّلاً من قبل، فاستخدم كلمة المرور الحالية.",
    formLabel: "تسجيل الدخول",
    email: "البريد الإلكتروني",
    emailPlaceholder: "you@example.com",
    password: "كلمة المرور",
    forgot: "نسيت كلمة المرور؟",
    submit: "تسجيل الدخول",
    noAccount: "ليس لديك حساب؟",
    register: "إنشاء حساب",
    genericError: "حدث خطأ غير متوقع. حاول مرة أخرى.",
    errorInvalid: "بيانات الدخول غير صحيحة.",
    errorThrottled: "محاولات تسجيل دخول كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.",
  },
  register: {
    eyebrow: "إنشاء حساب",
    title: "التسجيل",
    titleConsumer: "حساب شخصي",
    titleBusiness: "حساب تجاري",
    subtitle: (platform) => `اختر طريقة الشراء على ${platform}.`,
    chooserLabel: "نوع الحساب",
    consumerTitle: "حساب شخصي",
    consumerBody: "الشراء لنفسك. لا تُطلب أي بيانات شركة.",
    businessTitle: "حساب تجاري",
    businessBody: "الشراء نيابة عن شركة. يتطلب رقم سجل تجاري.",
    changeType: "تغيير نوع الحساب",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    email: "البريد الإلكتروني",
    emailPlaceholder: "you@example.com",
    password: "كلمة المرور",
    passwordHint: "8 أحرف على الأقل، مع حرف لاتيني كبير ورقم.",
    phone: "رقم الهاتف",
    phoneHint: "اختياري. بالصيغة الدولية، مع رمز الدولة.",
    companySection: "بيانات الشركة",
    companyNameEn: "اسم الشركة بالإنجليزية",
    companyNameAr: "اسم الشركة بالعربية",
    crNumber: "رقم السجل التجاري",
    vatNumber: "الرقم الضريبي",
    optional: "اختياري.",
    industry: "القطاع",
    industryPlaceholder: "اختر القطاع",
    companySize: "حجم الشركة",
    companySizePlaceholder: "اختر الحجم",
    country: "الدولة",
    countryPlaceholder: "اختر الدولة",
    city: "المدينة",
    submit: "إنشاء الحساب",
    hasAccount: "لديك حساب بالفعل؟",
    signIn: "تسجيل الدخول",
    failed: "تعذّر إتمام التسجيل.",
    industryLabels: {
      INDUSTRIAL_SUPPLIES: "التوريدات الصناعية",
      ELECTRONICS: "الإلكترونيات",
      OFFICE_SUPPLIES: "المستلزمات المكتبية",
      SAFETY_PPE: "السلامة ومعدات الوقاية",
      FOOD_HOSPITALITY: "الأغذية والضيافة",
      BUILDING_MATERIALS: "مواد البناء",
      HEALTHCARE: "الرعاية الصحية",
      RETAIL: "تجارة التجزئة",
      MANUFACTURING: "التصنيع",
      TECHNOLOGY: "التقنية",
      OTHER: "أخرى",
    },
    companySizeLabels: {
      MICRO: "متناهية الصغر",
      SMALL: "صغيرة",
      MEDIUM: "متوسطة",
      LARGE: "كبيرة",
      ENTERPRISE: "مؤسسة كبرى",
    },
    countryLabels: {
      AE: "الإمارات العربية المتحدة",
      SA: "المملكة العربية السعودية",
      QA: "قطر",
      KW: "الكويت",
      BH: "البحرين",
      OM: "سلطنة عُمان",
    },
  },
  forgot: {
    eyebrow: "إعادة تعيين كلمة المرور",
    title: "نسيت كلمة المرور؟",
    subtitle: "أدخل بريدك الإلكتروني وسنرسل إليه رابطاً لاختيار كلمة مرور جديدة.",
    note: (ttl) => `يبقى رابط إعادة التعيين صالحاً لمدة ${ttl} من لحظة طلبه.`,
    formLabel: "طلب إعادة تعيين كلمة المرور",
    email: "البريد الإلكتروني",
    submit: "إرسال رابط إعادة التعيين",
    sent: (ttl) => `إذا كان هناك حساب مرتبط بهذا العنوان، فقد أُرسل إليه رابط إعادة التعيين. تنتهي صلاحيته خلال ${ttl}.`,
    remembered: "تذكّرتها؟",
    signIn: "تسجيل الدخول",
    genericError: "حدث خطأ غير متوقع. حاول مرة أخرى.",
  },
  reset: {
    eyebrow: "إعادة تعيين كلمة المرور",
    title: "اختر كلمة مرور جديدة",
    subtitle: "اختر كلمة لم تستخدمها من قبل على هذا الحساب.",
    note: (ttl) => `تنتهي صلاحية روابط إعادة التعيين بعد ${ttl} من طلبها.`,
    formLabel: "اختيار كلمة مرور جديدة",
    password: "كلمة المرور الجديدة",
    passwordHint: "8 أحرف على الأقل، مع حرف لاتيني كبير ورقم.",
    confirm: "تأكيد كلمة المرور",
    confirmHint: "أعد كتابة كلمة المرور نفسها.",
    mismatch: "كلمتا المرور غير متطابقتين.",
    weak: "كلمة المرور لا تستوفي الشرط: 8 أحرف على الأقل، مع حرف لاتيني كبير ورقم.",
    submit: "تحديث كلمة المرور",
    done: "تم تحديث كلمة المرور. سجّل الدخول بالكلمة الجديدة.",
    signIn: "تسجيل الدخول",
    signInSeller: "تسجيل الدخول إلى بوابة الموردين",
    missingToken: "تحتاج هذه الصفحة إلى الرابط الوارد في رسالة إعادة التعيين — رمز إعادة التعيين غير موجود في العنوان.",
    deadToken: "رابط إعادة التعيين غير صالح أو انتهت صلاحيته.",
    usedToken: "رابط إعادة التعيين غير صالح أو انتهت صلاحيته أو سبق استخدامه.",
    noSecret: "إعادة تعيين كلمة المرور غير متاحة من هذه البيئة.",
    requestNew: "اطلب رابط إعادة تعيين جديداً",
    backTo: "العودة إلى",
    genericError: "حدث خطأ غير متوقع. حاول مرة أخرى.",
  },
};

export function identityCopy(locale: IdentityLocale): IdentityDictionary {
  return locale === "ar" ? AR : EN;
}
