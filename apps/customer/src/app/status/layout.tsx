import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * This page is a client component, and a client component cannot export
 * metadata — so its tab read the layout's bare default, "Avenick". A segment
 * layout is the sanctioned place for the title. No platform suffix here: the
 * root layout's title template appends it, and adding it twice is the
 * "Privacy Policy — Avenick | Avenick" defect this same change removes.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("status");
  return { title: t("metaTitle") };
}

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
