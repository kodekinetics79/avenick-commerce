import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";

/** Return shape for B2B form server actions (used with useActionState). */
export type B2BActionState = { error?: string; ok?: boolean; message?: string };

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
    include: { company: true },
  });
  if (!member) return null;

  return { userId, member, company: member.company, companyId: member.companyId };
}
