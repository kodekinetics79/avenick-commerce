import { getTranslations } from "next-intl/server";
import { listShippingZones } from "@avenick/database";
import { log } from "@avenick/observability";
import { MainLayout } from "@/components/layout/main-layout";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { toShippingCoverage, type ShippingCoverage } from "@/lib/checkout-shipping-coverage";

/**
 * The server shell around checkout.
 *
 * The form itself is client state — the cart lives in localStorage — but two
 * facts it needs to be honest with a buyer live only on the server:
 *
 *   · the delivery tariff's SHAPE (which countries are served, what a zone
 *     charges an unweighed basket), so an unserved destination is refused at
 *     the address step in words rather than as a 500 after submission;
 *   · whether the order route would accept a pilot MOCK payment, so the
 *     option is offered only where choosing it would not be a 409.
 *
 * Neither is a price. The tariff is read per request — a checkout must never
 * be prerendered against a zone table from build time — and a read that fails
 * yields null, in which case the browser pre-judges nothing and the server's
 * own refusal stands at submission, exactly as before this shell existed.
 * Authentication is enforced by the portal middleware, as for every route.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("checkout");
  return { title: t("title") };
}

async function loadShippingCoverage(): Promise<ShippingCoverage | null> {
  try {
    return toShippingCoverage(await listShippingZones());
  } catch (error) {
    log.error("checkout.shipping-coverage failed", error, { path: "/checkout" });
    return null;
  }
}

/** The order route's own gate for MOCK (pilotMockPaymentsEnabled), read from the same variables. */
function mockPaymentsEnabled(): boolean {
  return process.env.PILOT_MODE === "true" && process.env.ALLOW_MOCK_PAYMENTS === "true";
}

export default async function CheckoutPage() {
  const coverage = await loadShippingCoverage();
  return (
    <MainLayout>
      <CheckoutForm coverage={coverage} mockPaymentsEnabled={mockPaymentsEnabled()} />
    </MainLayout>
  );
}
