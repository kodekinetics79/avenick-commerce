import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * The cart page is a client component and a client component cannot export
 * metadata, so its tab title was the layout's bare default — "Avenick" — on
 * the one page where a buyer most often has several tabs open. A segment
 * layout is the sanctioned place for it. No platform suffix: the root layout's
 * title template appends that.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart");
  return { title: t("title") };
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
