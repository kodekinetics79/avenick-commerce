"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, db } from "@avenick/database";
import { requireSellerSession } from "@/lib/auth";

const ENTITIES = ["orders", "products"] as const;
type Entity = (typeof ENTITIES)[number];

function pathFor(entity: Entity) {
  return entity === "orders" ? "/orders" : "/products";
}

/** Save the current filter/sort (a URL query string) as a named view. */
export async function createSavedView(entity: string, name: string, query: string): Promise<void> {
  const { seller, userId } = await requireSellerSession();
  if (!(ENTITIES as readonly string[]).includes(entity)) throw new Error("Invalid entity");
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error("Name required");

  // Normalize: strip a leading "?" so apply can re-prepend consistently.
  const q = query.replace(/^\?/, "").slice(0, 300);

  await db.$transaction(async (tx) => {
    const view = await tx.savedView.create({ data: { sellerId: seller.id, entity, name: clean, query: q } });
    await tx.auditLog.create({ data: { actorId: userId, sellerId: seller.id, entityType: "SavedView", entityId: view.id, action: AuditAction.CREATE, after: { entity, name: clean } } });
  });
  revalidatePath(pathFor(entity as Entity));
}

export async function deleteSavedView(id: string): Promise<void> {
  const { seller, userId } = await requireSellerSession();
  // Scope the delete to the caller's own views.
  const view = await db.savedView.findFirst({ where: { id, sellerId: seller.id } });
  if (!view) return;
  await db.$transaction([
    db.savedView.delete({ where: { id } }),
    db.auditLog.create({ data: { actorId: userId, sellerId: seller.id, entityType: "SavedView", entityId: id, action: AuditAction.DELETE, before: { entity: view.entity, name: view.name } } }),
  ]);
  revalidatePath(pathFor(view.entity as Entity));
}
