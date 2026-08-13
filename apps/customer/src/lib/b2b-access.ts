export type DurableB2BMember = {
  role: string;
  isActive: boolean;
  company: { status: string; deletedAt: Date | null };
  user: { role: string; status: string; deletedAt: Date | null };
};

export function isDurableB2BMember(member: DurableB2BMember | null | undefined): member is DurableB2BMember {
  return Boolean(
    member && member.isActive && member.company.status === "ACTIVE" && !member.company.deletedAt &&
    member.user.status === "ACTIVE" && !member.user.deletedAt && member.user.role === member.role,
  );
}
