import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";

export const B2B_APPROVER_ROLES = ["COMPANY_ADMIN", "COMPANY_APPROVER"];

export async function getServerB2BContext() {
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
