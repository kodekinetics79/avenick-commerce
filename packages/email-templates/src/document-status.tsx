import * as React from "react";
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Text, Tailwind,
} from "@react-email/components";

interface DocumentStatusProps {
  recipientName: string;
  documentType: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
  locale?: "ar" | "en";
  /** Platform display name; the sender passes platformName() from portal-config. */
  platformName?: string;
}

export function DocumentStatusEmail({
  recipientName,
  documentType,
  status,
  rejectionReason,
  locale = "en",
  platformName,
}: DocumentStatusProps) {
  const isAr = locale === "ar";
  // The brand name is the one permitted literal; the sender can override it.
  const name = platformName ?? (isAr ? "منزل" : "Avenick");
  const isApproved = status === "APPROVED";
  const dir = isAr ? "rtl" : "ltr";

  const title = isApproved
    ? isAr ? "تمت الموافقة على وثيقتك" : "Document Approved"
    : isAr ? "تم رفض وثيقتك" : "Document Rejected";

  return (
    <Html dir={dir} lang={isAr ? "ar" : "en"}>
      <Head />
      <Preview>{title}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <Heading className={`text-2xl font-bold mb-4 ${isApproved ? "text-green-600" : "text-red-600"}`}>
              {title}
            </Heading>

            <Text className="text-base mb-4">
              {isAr ? `مرحباً ${recipientName}،` : `Hi ${recipientName},`}
            </Text>

            <Text className="text-base text-gray-700 mb-4">
              {isApproved
                ? isAr
                  ? `يسعدنا إبلاغك بأنه تمت الموافقة على وثيقة "${documentType}".`
                  : `We are pleased to inform you that your "${documentType}" document has been approved.`
                : isAr
                  ? `نأسف لإبلاغك بأنه تم رفض وثيقة "${documentType}".`
                  : `We regret to inform you that your "${documentType}" document has been rejected.`}
            </Text>

            {!isApproved && rejectionReason && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-4 mb-4">
                <Text className="text-sm font-semibold text-red-700 m-0 mb-1">
                  {isAr ? "سبب الرفض:" : "Rejection reason:"}
                </Text>
                <Text className="text-sm text-red-600 m-0">{rejectionReason}</Text>
              </div>
            )}

            {!isApproved && (
              <Text className="text-sm text-gray-600">
                {isAr
                  ? "يرجى تحميل وثيقة صحيحة ومحدثة لاستئناف مراجعة حسابك."
                  : "Please upload a valid, up-to-date document to resume your account review."}
              </Text>
            )}

            <Hr className="my-6" />
            <Text className="text-xs text-gray-400 text-center">
              {isAr ? `منصة ${name} للتجارة الإلكترونية` : `${name} Marketplace`}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
