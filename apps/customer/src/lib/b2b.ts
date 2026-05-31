import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";

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
