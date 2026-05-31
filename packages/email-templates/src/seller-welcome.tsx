import * as React from "react";
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text, Tailwind,
} from "@react-email/components";

interface SellerWelcomeProps {
  sellerName: string;
  businessName: string;
  locale?: "ar" | "en";
}

export function SellerWelcomeEmail({
  sellerName,
  businessName,
  locale = "en",
}: SellerWelcomeProps) {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";

  return (
    <Html dir={dir} lang={isAr ? "ar" : "en"}>
      <Head />
      <Preview>{isAr ? `مرحباً بك في منزل، ${businessName}` : `Welcome to Avenick, ${businessName}`}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <Heading className="text-2xl font-bold text-orange-600 mb-4">
              {isAr ? "مرحباً بك في منزل!" : "Welcome to Avenick!"}
            </Heading>

            <Text className="text-base mb-4">
              {isAr ? `مرحباً ${sellerName}،` : `Hi ${sellerName},`}
            </Text>

            <Text className="text-base text-gray-700 mb-4">
              {isAr
                ? `شكراً لتسجيلك كبائع في منصة منزل. طلب ${businessName} قيد المراجعة حالياً.`
                : `Thank you for registering as a seller on Avenick. Your application for ${businessName} is currently under review.`}
            </Text>

            <Section className="rounded-xl bg-orange-50 p-4 mb-4">
              <Heading as="h2" className="text-base font-semibold text-orange-700 mt-0 mb-2">
                {isAr ? "الخطوات التالية" : "Next Steps"}
              </Heading>
              <ul className="list-disc ps-5 text-sm text-gray-700 space-y-1">
                <li>{isAr ? "سيتحقق فريقنا من وثائقك خلال 1-3 أيام عمل" : "Our team will verify your documents within 1-3 business days"}</li>
                <li>{isAr ? "ستتلقى إشعاراً بالبريد الإلكتروني عند الموافقة" : "You will receive an email notification upon approval"}</li>
                <li>{isAr ? "بعد الموافقة، يمكنك البدء في إضافة منتجاتك" : "After approval, you can start adding your products"}</li>
              </ul>
            </Section>

            <Hr className="my-6" />
            <Text className="text-xs text-gray-400 text-center">
              {isAr ? "منصة منزل للتجارة الإلكترونية في منطقة الخليج" : "Avenick — GCC Marketplace Platform"}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
