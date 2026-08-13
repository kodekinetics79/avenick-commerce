import { mkdir, rm, writeFile } from "node:fs/promises";

const sellerServer = `import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";

const SELLER_ROLES = new Set(["SELLER_OWNER", "SELLER_STAFF"]);

/**
 * Canonical seller organization boundary for API/server code.
 *
 * SellerProfile.userId belongs to the seller owner only. Staff must resolve
 * through SellerMembership; otherwise SELLER_STAFF can authenticate but every
 * seller API rejects them. All callers receive seller scope derived from server
 * membership, never from request payload/query parameters.
 */
export async function getServerSellerContext() {
  const session = await auth();
  const user = session?.user as { id: string; role: string } | undefined;
  if (!user?.id || !SELLER_ROLES.has(user.role)) return null;

  if (user.role === "SELLER_OWNER") {
    const seller = await db.sellerProfile.findUnique({ where: { userId: user.id } });
    if (!seller || seller.status !== "ACTIVE" || seller.deletedAt) return null;
    return {
      session,
      user,
      userId: user.id,
      sellerId: seller.id,
      seller,
      membership: {
        userId: user.id,
        sellerId: seller.id,
        title: "Owner",
        permissions: ["*"],
        isActive: true,
      },
    };
  }

  const membership = await db.sellerMembership.findUnique({
    where: { userId: user.id },
    include: { seller: true },
  });
  if (!membership?.isActive || membership.seller.status !== "ACTIVE" || membership.seller.deletedAt) {
    return null;
  }

  return {
    session,
    user,
    userId: user.id,
    sellerId: membership.sellerId,
    seller: membership.seller,
    membership,
  };
}

export function sellerHasPermission(
  context: { user: { role: string }; membership?: { permissions?: string[] } | null },
  permission: string,
) {
  if (context.user.role === "SELLER_OWNER") return true;
  const permissions = context.membership?.permissions ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}
`;

await writeFile("apps/seller/src/lib/seller-server.ts", sellerServer);

for (const path of [
  ".github/workflows/diagnose-typecheck.yml",
  "docs/qa/typecheck-diagnostic.txt",
]) {
  await rm(path, { force: true });
}

await mkdir("docs/qa", { recursive: true });
console.log("Seller API membership boundary patched; temporary diagnostics removed.");
