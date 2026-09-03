"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { b2bT, type B2BT } from "./messages";

/**
 * The buyer suite's translator, for Client Components.
 *
 * Reads the locale from the NextIntlClientProvider the root layout already
 * mounts, so a client island and the server page around it can never disagree.
 *
 * LAW 9 NOTE: this module carries the "use client" directive because it exports
 * a hook, and a hook may only ever be called from client code. The catalogue and
 * the `b2bT` factory deliberately live in ./messages, which carries NO directive,
 * so a Server Component can call `b2bT` without Next replacing it with a client
 * reference.
 */
export function useB2BT(): B2BT {
  const locale = useLocale();
  return useMemo(() => b2bT(locale), [locale]);
}
