"use client";

import { Badge } from "./badge";
import { type VariantProps } from "class-variance-authority";
import { type badgeVariants } from "./badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  // Order status
  PENDING_PAYMENT: "warning",
  CONFIRMED: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "error",
  REFUNDED: "secondary",
  // Payment status
  UNPAID: "error",
  PAID: "success",
  PARTIALLY_PAID: "warning",
  // Seller/document status
  PENDING_REVIEW: "warning",
  ACTIVE: "success",
  SUSPENDED: "error",
  REJECTED: "error",
  APPROVED: "success",
  EXPIRED: "error",
  // PO status
  DRAFT: "secondary",
  PENDING_APPROVAL: "warning",
  ORDERED: "info",
  // Seller tier
  STANDARD: "secondary",
  VERIFIED: "info",
  GOLD: "warning",
  PLATINUM: "success",
  // Company status
  PENDING_VERIFICATION: "warning",
  // Product status
  PENDING_REVIEW_PRODUCT: "warning",
};

const STATUS_LABEL_MAP: Record<string, { en: string; ar: string }> = {
  PENDING_PAYMENT: { en: "Pending Payment", ar: "في انتظار الدفع" },
  CONFIRMED: { en: "Confirmed", ar: "مؤكد" },
  PROCESSING: { en: "Processing", ar: "قيد المعالجة" },
  SHIPPED: { en: "Shipped", ar: "تم الشحن" },
  DELIVERED: { en: "Delivered", ar: "تم التوصيل" },
  CANCELLED: { en: "Cancelled", ar: "ملغى" },
  REFUNDED: { en: "Refunded", ar: "مُسترد" },
  UNPAID: { en: "Unpaid", ar: "غير مدفوع" },
  PAID: { en: "Paid", ar: "مدفوع" },
  ACTIVE: { en: "Active", ar: "نشط" },
  SUSPENDED: { en: "Suspended", ar: "موقوف" },
  PENDING_REVIEW: { en: "Under Review", ar: "قيد المراجعة" },
  APPROVED: { en: "Approved", ar: "مقبول" },
  REJECTED: { en: "Rejected", ar: "مرفوض" },
  EXPIRED: { en: "Expired", ar: "منتهي الصلاحية" },
  DRAFT: { en: "Draft", ar: "مسودة" },
  PENDING_APPROVAL: { en: "Pending Approval", ar: "في انتظار الموافقة" },
};

interface StatusBadgeProps {
  status: string;
  locale?: "ar" | "en";
  className?: string;
}

export function StatusBadge({ status, locale = "en", className }: StatusBadgeProps) {
  const variant = STATUS_VARIANT_MAP[status] ?? "secondary";
  const labels = STATUS_LABEL_MAP[status];
  const label = labels ? (locale === "ar" ? labels.ar : labels.en) : status;

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
