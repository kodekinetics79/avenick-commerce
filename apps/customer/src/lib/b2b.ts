import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { cookies } from "next/headers";
import { cookieHeaderFromStore, fetchBackendJsonWithCookies } from "@/lib/backend";
import { isDurableB2BMember } from "./b2b-access";

/** Return shape for B2B form server actions (used with useActionState). */
export type B2BActionState = { error?: string; ok?: boolean; message?: string };

export async function fetchB2BJson<T>(path: string, init?: RequestInit) {
  const cookieStore = cookies();
  return fetchBackendJsonWithCookies<T>(path, init, cookieHeaderFromStore(cookieStore));
}

/**
 * Resolve the signed-in user's B2B context (their company membership).
 * Returns null for users who aren't part of a company.
 */
export async function getB2BContext() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const member = await db.companyMember.findUnique({
    where: { userId },
    include: { company: true, user: { select: { role: true, status: true, deletedAt: true } } },
  });
  if (!isDurableB2BMember(member)) return null;

  return { userId, member, company: member.company, companyId: member.companyId };
}
