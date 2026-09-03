import { getLocale } from "next-intl/server";
import { platformName } from "@avenick/utils/portal-config";
import { b2bT, type B2BKey, type B2BT } from "./messages";
import { b2bFormats, type B2BFormats } from "./format";

/**
 * The buyer suite's translator and formatters, for Server Components.
 *
 * SERVER ONLY — this imports `next-intl/server`, which resolves to the
 * react-server condition. A client component must use `useB2BT()` from
 * ./use-b2b-t instead; importing this file from one breaks the build.
 *
 * The locale comes from next-intl rather than from a second cookie read, so the
 * buyer suite can never disagree with the header, the footer or the storefront
 * about which language the page is in.
 *
 * When the catalogue is folded into messages/{en,ar}.json (see messages.ts),
 * `getB2BT` becomes `getTranslations("b2b")` and every call site is unchanged.
 */
export async function getB2BT(): Promise<B2BT> {
  return b2bT(await getLocale());
}

/** Translator plus date formatters, so a page reads the locale once. */
export async function getB2B(): Promise<{ t: B2BT; f: B2BFormats; locale: string }> {
  const locale = await getLocale();
  return { t: b2bT(locale), f: b2bFormats(locale), locale };
}

/**
 * A page title, in the reader's language.
 *
 * A tab title is a user-visible string like any other, and it is the one the
 * reader keeps after they leave: the tab strip, the history entry, the bookmark.
 * Every page in this suite shipped `export const metadata = { title: "Purchase
 * Orders — …" }`, which is a STATIC export and therefore cannot read a cookie —
 * so an Arabic reader got an English tab above a fully Arabic page, which is the
 * same defect as an English column heading and rather harder to notice.
 *
 * `generateMetadata` is async and reads the same locale the page body does.
 * Every route in this suite is already dynamic (each one reads the session
 * cookie to resolve a company), so this costs no rendering that was not already
 * being paid for.
 *
 * The suffix is `shell.forBusiness`, the same line the masthead falls back to,
 * so the tab and the page agree about what this workspace is called.
 */
export async function b2bMetadata(key: B2BKey): Promise<{ title: string }> {
  const t = await getB2BT();
  return { title: `${t(key)} — ${t("shell.forBusiness", { platform: platformName() })}` };
}
