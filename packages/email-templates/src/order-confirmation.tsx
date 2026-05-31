import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

interface OrderItem {
  nameEn: string;
  nameAr: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface OrderConfirmationProps {
  orderNumber: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  vatAmount: number;
  shippingAmount: number;
  total: number;
  currency: string;
  locale?: "ar" | "en";
}

export function OrderConfirmationEmail({
  orderNumber,
  customerName,
  items,
  subtotal,
  vatAmount,
  shippingAmount,
  total,
  currency = "AED",
  locale = "en",
}: OrderConfirmationProps) {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const t = isAr
    ? {
        preview: `تم تأكيد طلبك #${orderNumber}`,
        title: "تأكيد الطلب",
        greeting: `مرحباً ${customerName}،`,
        body: "شكراً لطلبك! تم تأكيد طلبك وسيتم معالجته قريباً.",
        orderNum: "رقم الطلب",
        items: "المنتجات",
        product: "المنتج",
        qty: "الكمية",
        price: "السعر",
        subtotal: "المجموع الفرعي",
        vat: "ضريبة القيمة المضافة",
        shipping: "الشحن",
        total: "الإجمالي",
        footer: "شكراً لتسوقكم معنا في منزل.",
      }
    : {
        preview: `Your order #${orderNumber} has been confirmed`,
        title: "Order Confirmation",
        greeting: `Hi ${customerName},`,
        body: "Thank you for your order! Your order has been confirmed and will be processed shortly.",
        orderNum: "Order Number",
        items: "Items",
        product: "Product",
        qty: "Qty",
        price: "Price",
        subtotal: "Subtotal",
        vat: "VAT",
        shipping: "Shipping",
        total: "Total",
        footer: "Thank you for shopping with Avenick.",
      };

  return (
    <Html dir={dir} lang={isAr ? "ar" : "en"}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <Heading className="text-2xl font-bold text-orange-600 mb-2">{t.title}</Heading>
            <Text className="text-sm text-gray-500 mb-4">
              {t.orderNum}: <strong>{orderNumber}</strong>
            </Text>

            <Text className="text-base mb-4">{t.greeting}</Text>
            <Text className="text-base text-gray-700 mb-6">{t.body}</Text>

            <Hr />

            <Heading as="h2" className="text-lg font-semibold mt-4 mb-3">{t.items}</Heading>

            {items.map((item, i) => (
              <Row key={i} className="mb-2">
                <Column className="flex-1">
                  <Text className="text-sm font-medium m-0">
                    {isAr ? item.nameAr : item.nameEn}
                  </Text>
                  <Text className="text-xs text-gray-400 m-0">x{item.quantity}</Text>
                </Column>
                <Column>
                  <Text className="text-sm font-semibold m-0">
                    {currency} {item.total.toFixed(2)}
                  </Text>
                </Column>
              </Row>
            ))}

            <Hr className="my-4" />

            <Section>
              <Row>
                <Column><Text className="text-sm text-gray-600 m-0">{t.subtotal}</Text></Column>
                <Column className="text-end"><Text className="text-sm m-0">{currency} {subtotal.toFixed(2)}</Text></Column>
              </Row>
              <Row>
                <Column><Text className="text-sm text-gray-600 m-0">{t.vat}</Text></Column>
                <Column className="text-end"><Text className="text-sm m-0">{currency} {vatAmount.toFixed(2)}</Text></Column>
              </Row>
              {shippingAmount > 0 && (
                <Row>
                  <Column><Text className="text-sm text-gray-600 m-0">{t.shipping}</Text></Column>
                  <Column className="text-end"><Text className="text-sm m-0">{currency} {shippingAmount.toFixed(2)}</Text></Column>
                </Row>
              )}
              <Row className="mt-2">
                <Column><Text className="font-bold m-0">{t.total}</Text></Column>
                <Column className="text-end"><Text className="font-bold text-orange-600 m-0">{currency} {total.toFixed(2)}</Text></Column>
              </Row>
            </Section>

            <Hr className="my-6" />
            <Text className="text-sm text-gray-500 text-center">{t.footer}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
