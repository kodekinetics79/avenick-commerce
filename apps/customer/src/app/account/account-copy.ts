/**
 * Copy for the signed-in account surfaces — orders, returns — plus the public
 * system-status page, in two languages.
 *
 * Same contract and the same caveat as `../auth/identity-copy`: this is shaped
 * exactly like a next-intl namespace so it can be lifted into
 * `apps/customer/messages/{en,ar}.json` verbatim once that file is not being
 * edited by another track. No JSX, no "use client" directive (law 9 — a server
 * page calls these functions directly), interpolation by argument.
 *
 * TWO RULES THAT ARE NOT STYLE, AND WHICH THE NEXT EDITOR MUST KEEP:
 *
 * 1. STATUS KEYS ARE NEVER TRANSLATED — only their labels are. `ORDER.status`,
 *    `Return.status` and the return REASON are values the platform stores and a
 *    seller and an operator read back. A localised value written into the
 *    database is a data defect that looks like a translation.
 *
 * 2. NOTHING HERE PROMISES A TIME. No delivery window, no review SLA, no
 *    response time, no refund date. The platform measures none of them, so
 *    neither language may state one, and the two languages may never differ
 *    about which facts exist.
 */

import type { IdentityLocale } from "../auth/identity-copy";

interface AccountDictionary {
  readonly orders: {
    readonly eyebrow: string;
    readonly title: string;
    readonly returnsAction: string;
    readonly dateline: (shown: number) => string;
    readonly datelineFiltered: (status: string, shown: number) => string;
    readonly bandInProgress: string;
    readonly bandShipped: string;
    readonly bandDelivered: string;
    readonly bandBasis: string;
    readonly filterLabel: string;
    readonly filterAll: string;
    readonly emptyEyebrow: string;
    readonly emptyHeadline: string;
    readonly emptyHeadlineFiltered: (status: string) => string;
    readonly emptyBody: string;
    readonly emptyBodyFiltered: string;
    readonly emptyAction: string;
    readonly emptyActionFiltered: string;
    readonly moreItems: (count: number) => string;
    readonly statusLabels: Readonly<Record<string, string>>;
  };
  readonly returns: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly signInEyebrow: string;
    readonly signInHeadline: string;
    readonly signInBody: string;
    readonly signInAction: string;
    readonly listHeading: string;
    readonly outcome: string;
    readonly refundBasis: string;
    readonly newHeading: string;
    readonly newBody: string;
    readonly noneEyebrow: string;
    readonly noneHeadline: string;
    readonly noneBody: string;
    readonly noneAction: string;
    readonly statusLabels: Readonly<Record<string, string>>;
    readonly form: {
      readonly order: string;
      readonly orderPlaceholder: string;
      readonly items: string;
      readonly itemsHint: string;
      readonly quantityFor: (item: string) => string;
      readonly reason: string;
      readonly reasonPlaceholder: string;
      readonly reasonLabels: Readonly<Record<string, string>>;
      readonly notes: string;
      readonly notesPlaceholder: string;
      readonly optional: string;
      readonly submit: string;
      readonly submitting: string;
    };
  };
  readonly status: {
    readonly eyebrow: string;
    readonly title: string;
    readonly unreachable: string;
    readonly processHealth: (label: string) => string;
    readonly journeys: (label: string) => string;
    readonly noJourneySynthetic: string;
    readonly components: string;
    readonly polled: (time: string, seconds: number) => string;
    readonly waiting: string;
    readonly labels: Readonly<Record<string, string>>;
  };
}

/**
 * The seven return reasons. THE KEY IS THE STORED VALUE and it is English on
 * purpose: it is written to `Return.reason` and read back by a seller and an
 * operator who may be working in the other language. Only the label localises.
 */
export const RETURN_REASON_VALUES = [
  "Wrong item received",
  "Item damaged / defective",
  "Item not as described",
  "Changed my mind",
  "Order arrived too late",
  "Missing parts / accessories",
  "Other",
] as const;

const EN: AccountDictionary = {
  orders: {
    eyebrow: "Account",
    title: "My orders",
    returnsAction: "Returns",
    // LAW E. The list is ordered and scoped; saying so is what makes the count
    // mean something. Under a filter the scope has to name the filter, or
    // "N shown" reads as the number of orders on the account, which it is not.
    dateline: (shown) => `Orders recorded against this account, newest first · ${shown} shown`,
    datelineFiltered: (status, shown) =>
      `Orders recorded against this account with status “${status}”, newest first · ${shown} shown`,
    bandInProgress: "In progress",
    bandShipped: "Shipped",
    bandDelivered: "Delivered",
    bandBasis: "Counted across every order on this account",
    filterLabel: "Filter orders by status",
    filterAll: "All orders",
    emptyEyebrow: "Nothing recorded",
    emptyHeadline: "No orders on this account yet.",
    emptyHeadlineFiltered: (status) => `No ${status} orders on this account.`,
    emptyBody: "An order appears here as soon as it is placed, with the status currently recorded against it.",
    emptyBodyFiltered: "Clear the filter to see every order recorded against this account.",
    emptyAction: "Browse products",
    emptyActionFiltered: "Show all orders",
    moreItems: (count) => `+ ${count} more item${count === 1 ? "" : "s"}`,
    statusLabels: {
      PENDING_PAYMENT: "Pending payment",
      CONFIRMED: "Confirmed",
      PROCESSING: "Processing",
      READY_FOR_PICKUP: "Ready for pickup",
      SHIPPED: "Shipped",
      DELIVERED: "Delivered",
      CANCELLED: "Cancelled",
      RETURNED: "Returned",
    },
  },
  returns: {
    eyebrow: "Account",
    title: "Returns and refunds",
    description: "Request a return for a delivered order, then follow its review here.",
    signInEyebrow: "Sign in required",
    signInHeadline: "A return belongs to the account that placed the order.",
    signInBody: "Sign in to request a return for a delivered order, or to follow one already under review.",
    signInAction: "Sign in",
    listHeading: "Your return requests",
    outcome: "Outcome",
    refundBasis:
      "Refund amounts as recorded against each return, each in the order’s own currency · no conversion applied",
    newHeading: "Start a new return",
    newBody: "Choose a delivered order, pick the items, and say what went wrong.",
    noneEyebrow: "Nothing eligible",
    noneHeadline: "No delivered order on this account can be returned right now.",
    noneBody: "A return can only be started from an order that has been marked delivered.",
    noneAction: "View your orders",
    statusLabels: {
      REQUESTED: "Under review",
      APPROVED: "Approved",
      REJECTED: "Rejected",
      IN_TRANSIT: "In transit",
      RECEIVED: "Received",
      REFUNDED: "Refunded",
    },
    form: {
      order: "Order",
      orderPlaceholder: "Select a delivered order…",
      items: "Items and quantities",
      itemsHint: "Tick each item you are returning. The quantity may not exceed what was ordered.",
      quantityFor: (item) => `Return quantity for ${item}`,
      reason: "Reason",
      reasonPlaceholder: "Select a reason…",
      reasonLabels: {
        "Wrong item received": "Wrong item received",
        "Item damaged / defective": "Item damaged or defective",
        "Item not as described": "Item not as described",
        "Changed my mind": "Changed my mind",
        "Order arrived too late": "Order arrived too late",
        "Missing parts / accessories": "Missing parts or accessories",
        Other: "Other",
      },
      notes: "Details",
      notesPlaceholder: "Which items, what happened, photos to follow…",
      optional: "Optional.",
      submit: "Submit return request",
      submitting: "Submitting…",
    },
  },
  status: {
    eyebrow: "System",
    title: "System status",
    unreachable: "Unable to reach the status endpoint",
    // Scoped deliberately. "All systems operational" claimed health for customer
    // journeys and integrations this endpoint never measures.
    processHealth: (label) => `Process health: ${label}`,
    journeys: (label) => `Customer journeys: ${label}`,
    noJourneySynthetic: "no journey synthetic has run against this deployment",
    components: "Components",
    polled: (time, seconds) => `Last polled ${time} · refreshed every ${seconds}s`,
    waiting: "Waiting for the first poll",
    labels: {
      operational: "Operational",
      degraded: "Degraded",
      down: "Down",
      unverified: "Unverified",
      not_configured: "Not configured",
    },
  },
};

const AR: AccountDictionary = {
  orders: {
    eyebrow: "الحساب",
    title: "طلباتي",
    returnsAction: "المرتجعات",
    dateline: (shown) => `الطلبات المسجّلة على هذا الحساب، الأحدث أولاً · ${shown} معروضة`,
    datelineFiltered: (status, shown) =>
      `الطلبات المسجّلة على هذا الحساب بحالة «${status}»، الأحدث أولاً · ${shown} معروضة`,
    bandInProgress: "قيد التنفيذ",
    bandShipped: "تم الشحن",
    bandDelivered: "تم التسليم",
    bandBasis: "محسوبة على كل طلبات هذا الحساب",
    filterLabel: "تصفية الطلبات حسب الحالة",
    filterAll: "كل الطلبات",
    emptyEyebrow: "لا يوجد سجل",
    emptyHeadline: "لا توجد طلبات على هذا الحساب بعد.",
    emptyHeadlineFiltered: (status) => `لا توجد طلبات بحالة «${status}» على هذا الحساب.`,
    emptyBody: "يظهر الطلب هنا فور تقديمه، مع الحالة المسجّلة عليه حالياً.",
    emptyBodyFiltered: "أزل التصفية لعرض كل الطلبات المسجّلة على هذا الحساب.",
    emptyAction: "تصفّح المنتجات",
    emptyActionFiltered: "عرض كل الطلبات",
    moreItems: (count) => `+ ${count} منتج آخر`,
    statusLabels: {
      PENDING_PAYMENT: "بانتظار الدفع",
      CONFIRMED: "مؤكَّد",
      PROCESSING: "قيد المعالجة",
      READY_FOR_PICKUP: "جاهز للاستلام",
      SHIPPED: "تم الشحن",
      DELIVERED: "تم التسليم",
      CANCELLED: "ملغى",
      RETURNED: "مُرتجع",
    },
  },
  returns: {
    eyebrow: "الحساب",
    title: "المرتجعات والاستردادات",
    description: "اطلب إرجاع طلب تم تسليمه، ثم تابع مراجعته هنا.",
    signInEyebrow: "يلزم تسجيل الدخول",
    signInHeadline: "طلب الإرجاع مرتبط بالحساب الذي قدّم الطلب.",
    signInBody: "سجّل الدخول لطلب إرجاع طلب تم تسليمه، أو لمتابعة طلب إرجاع قيد المراجعة.",
    signInAction: "تسجيل الدخول",
    listHeading: "طلبات الإرجاع الخاصة بك",
    outcome: "النتيجة",
    refundBasis: "مبالغ الاسترداد كما هي مسجّلة على كل طلب إرجاع، كلٌّ بعملة طلبه · دون أي تحويل",
    newHeading: "بدء طلب إرجاع",
    newBody: "اختر طلباً تم تسليمه، وحدّد المنتجات، واذكر ما حدث.",
    noneEyebrow: "لا يوجد طلب مؤهّل",
    noneHeadline: "لا يوجد طلب تم تسليمه على هذا الحساب يمكن إرجاعه حالياً.",
    noneBody: "لا يمكن بدء الإرجاع إلا من طلب تم تسجيله كمُسلَّم.",
    noneAction: "عرض طلباتك",
    statusLabels: {
      REQUESTED: "قيد المراجعة",
      APPROVED: "تمت الموافقة",
      REJECTED: "مرفوض",
      IN_TRANSIT: "قيد الشحن",
      RECEIVED: "تم الاستلام",
      REFUNDED: "تم الاسترداد",
    },
    form: {
      order: "الطلب",
      orderPlaceholder: "اختر طلباً تم تسليمه…",
      items: "المنتجات والكميات",
      itemsHint: "حدّد كل منتج ترغب في إرجاعه. لا يجوز أن تتجاوز الكمية ما تم طلبه.",
      quantityFor: (item) => `كمية الإرجاع من ${item}`,
      reason: "السبب",
      reasonPlaceholder: "اختر السبب…",
      reasonLabels: {
        "Wrong item received": "استلمت منتجاً خاطئاً",
        "Item damaged / defective": "المنتج تالف أو به عيب",
        "Item not as described": "المنتج لا يطابق الوصف",
        "Changed my mind": "غيّرت رأيي",
        "Order arrived too late": "وصل الطلب متأخراً",
        "Missing parts / accessories": "أجزاء أو ملحقات ناقصة",
        Other: "سبب آخر",
      },
      notes: "التفاصيل",
      notesPlaceholder: "أي منتجات، وما الذي حدث، وهل ستُرفق صور…",
      optional: "اختياري.",
      submit: "إرسال طلب الإرجاع",
      submitting: "جارٍ الإرسال…",
    },
  },
  status: {
    eyebrow: "النظام",
    title: "حالة النظام",
    unreachable: "تعذّر الوصول إلى نقطة حالة النظام",
    processHealth: (label) => `حالة التشغيل: ${label}`,
    journeys: (label) => `رحلات العملاء: ${label}`,
    noJourneySynthetic: "لم يُنفَّذ أي فحص آلي لرحلات العملاء على هذا الإصدار",
    components: "المكوّنات",
    polled: (time, seconds) => `آخر استعلام ${time} · يُحدَّث كل ${seconds} ثانية`,
    waiting: "بانتظار أول استعلام",
    labels: {
      operational: "تعمل",
      degraded: "متدهورة",
      down: "متوقفة",
      unverified: "غير مُتحقَّق منها",
      not_configured: "غير مُهيّأة",
    },
  },
};

export function accountCopy(locale: IdentityLocale): AccountDictionary {
  return locale === "ar" ? AR : EN;
}
