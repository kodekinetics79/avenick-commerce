export type DurableB2BMember = {
  role: string;
  isActive: boolean;
  company: { status: string; deletedAt: Date | null };
  user: { role: string; status: string; deletedAt: Date | null };
};

/**
 * Returns a plain boolean, deliberately NOT a `member is DurableB2BMember` type
 * predicate. The check tests runtime STATE (active membership, active company,
 * active user, matching role) — not shape. A member that fails it is still a
 * member-shaped row, so a type predicate would narrow the false branch to
 * `null | undefined` and collapse every field access on a non-durable member to
 * `never`. Callers that need non-null narrowing should guard `member` itself.
 */
export function isDurableB2BMember(member: DurableB2BMember | null | undefined): boolean {
  return Boolean(
    member && member.isActive && member.company.status === "ACTIVE" && !member.company.deletedAt &&
    member.user.status === "ACTIVE" && !member.user.deletedAt && member.user.role === member.role,
  );
}
