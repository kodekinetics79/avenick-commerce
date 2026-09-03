import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { isDurableB2BMember } from "./b2b-access";

export const B2B_APPROVER_ROLES = ["COMPANY_ADMIN", "COMPANY_APPROVER"];

export async function getServerB2BContext() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const member = await db.companyMember.findUnique({
    where: { userId },
    include: { company: true, user: { select: { role: true, status: true, deletedAt: true } } },
  });
  // `member &&` does the null-narrowing the guard used to do as a type predicate.
  if (!member || !isDurableB2BMember(member)) {
    return null;
  }

  return { userId, member, company: member.company, companyId: member.companyId };
}
