import { cookies } from "next/headers";
import { b2bT, type B2BT } from "./messages";

/**
 * The buyer suite's translator, for Server Actions.
 *
 * A Server Action runs outside the page render, so it cannot use the page's
 * translator — and every string it returns is shown to the buyer at the exact
 * moment something has gone wrong or has just been committed, which is the worst
 * possible place for the one line on an Arabic page that is not in Arabic.
 *
 * The locale is read from the same cookie next-intl's request config reads,
 * rather than through next-intl itself: `cookies()` is the primitive both are
 * built on, it is unambiguously supported inside a Server Action, and it keeps
 * an action's error path free of a dependency that could throw in it.
 *
 * SERVER ONLY — `next/headers`. Never import this from a client component.
 *
 * NOTE ON WHAT IS *NOT* TRANSLATED: where an action has the SERVER's own reason
 * for a refusal — a validation message naming the offending field, an API's
 * "already decided" or "price changed, re-approval required" — that reason is
 * passed through verbatim. It is data, and replacing it with a generic
 * translated line throws away the only actionable part of the message.
 */
export function actionT(): B2BT {
  return b2bT(cookies().get("AVENICK_LOCALE")?.value);
}
