import * as React from "react";
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text, Tailwind,
} from "@react-email/components";

interface SellerWelcomeProps {
  sellerName: string;
  businessName: string;
  locale?: "ar" | "en";
  /** Platform display name; the sender passes platformName() from portal-config. */
  platformName?: string;
}

export function SellerWelcomeEmail({
  sellerName,
  businessName,
  locale = "en",
  platformName,
}: SellerWelcomeProps) {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  // The brand name is the one permitted literal; the sender can override it.
  const name = platformName ?? (isAr ? "منزل" : "Avenick");

  return (
    <Html dir={dir} lang={isAr ? "ar" : "en"}>
      <Head />
      <Preview>{isAr ? `مرحباً بك في ${name}، ${businessName}` : `Welcome to ${name}, ${businessName}`}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <Heading className="text-2xl font-bold text-orange-600 mb-4">
              {isAr ? `مرحباً بك في ${name}!` : `Welcome to ${name}!`}
            </Heading>

            <Text className="text-base mb-4">
              {isAr ? `مرحباً ${sellerName}،` : `Hi ${sellerName},`}
            </Text>

            <Text className="text-base text-gray-700 mb-4">
              {isAr
                ? `شكراً لتسجيلك كبائع في منصة ${name}. طلب ${businessName} قيد المراجعة حالياً.`
                : `Thank you for registering as a seller on ${name}. Your application for ${businessName} is currently under review.`}
            </Text>

            <Section className="rounded-xl bg-orange-50 p-4 mb-4">
              <Heading as="h2" className="text-base font-semibold text-orange-700 mt-0 mb-2">
                {isAr ? "الخطوات التالية" : "Next Steps"}
              </Heading>
              <ul className="list-disc ps-5 text-sm text-gray-700 space-y-1">
                {/* No review turnaround is published and no approval email is wired,
                    so neither is promised here. */}
                <li>{isAr ? "سيراجع فريقنا وثائقك" : "Our team will review your documents"}</li>
                <li>{isAr ? "يمكنك متابعة حالة طلبك من بوابة البائع" : "You can follow the status of your application in the seller portal"}</li>
                <li>{isAr ? "بعد الموافقة، يمكنك البدء في إضافة منتجاتك" : "After approval, you can start adding your products"}</li>
              </ul>
            </Section>

            <Hr className="my-6" />
            <Text className="text-xs text-gray-400 text-center">
              {isAr ? `منصة ${name} للتجارة الإلكترونية في منطقة الخليج` : `${name} — GCC Marketplace Platform`}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
