import type { IntegrationConnection, Prisma } from "@prisma/client";
import { db } from "../index";
import {
  lockCompanyIntegrationRoutes,
  lockIntegrationConnections,
  lockIntegrationRegistry,
  requireCurrentAdminActor,
} from "./checkout-invariants";
import { governedIntegrationPolicy } from "./integration-policy";

const ORDER_SYSTEMS = ["D365", "SAP", "ERP"];

/** Resolve the one governed outbound ERP route while its registry is fenced. */
export async function resolveCompanyOrderIntegration(
  tx: Prisma.TransactionClient,
  input: { tenantKey?: string; companyId: string; afterRoutingLocks?: () => Promise<void> },
): Promise<IntegrationConnection | null> {
  const tenantKey = input.tenantKey ?? "default";
  await lockIntegrationRegistry(tx, tenantKey);
  await lockCompanyIntegrationRoutes(tx, [input.companyId]);
  const routes = await tx.integrationCompanyRoute.findMany({
    where: { tenantKey, companyId: input.companyId, purpose: "ORDER_SUBMISSION" },
    select: { connectionId: true },
  });
  if (routes.length > 1) throw new Error("ERP routing is ambiguous for this company");
  if (routes.length === 0) {
    await input.afterRoutingLocks?.();
    // An external-account link is the company's explicit ERP opt-in. Companies
    // with no ERP identity remain local; linked companies never fall back to an
    // arbitrary tenant-wide connector when their route is missing.
    const governed = await tx.externalAccountLink.count({
      where: { tenantKey, companyId: input.companyId, system: { in: ORDER_SYSTEMS } },
    });
    if (governed > 0) throw new Error("ERP routing is not configured for this company");
    return null;
  }

  const connectionId = routes[0]!.connectionId;
  await lockIntegrationConnections(tx, [connectionId]);
  await input.afterRoutingLocks?.();
  const connection = await tx.integrationConnection.findFirst({
    where: { id: connectionId, tenantKey },
  });
  if (!connection || !ORDER_SYSTEMS.includes(connection.system) || connection.status !== "ACTIVE") {
    throw new Error("ERP_DISCONNECTED_PILOT: governed company ERP route is unavailable");
  }
  return connection;
}

export async function setGovernedIntegrationConnectionStatus(input: {
  id: string;
  status: string;
  actorId: string;
  afterGovernanceLocks?: () => Promise<void>;
}) {
  return db.$transaction(async (tx) => {
    await lockIntegrationRegistry(tx);
    await lockIntegrationConnections(tx, [input.id]);
    await requireCurrentAdminActor(tx, input.actorId);
    await input.afterGovernanceLocks?.();
    const connection = await tx.integrationConnection.findUnique({ where: { id: input.id } });
    if (!connection) throw new Error("Integration connection not found");
    if (input.status === "ACTIVE") {
      if (!connection.baseUrl) throw new Error("A base URL is required before activation");
      if (!connection.credentialsRef) throw new Error("A secret-manager credential reference is required before activation");
      governedIntegrationPolicy({ system: connection.system, baseUrl: connection.baseUrl, credentialsRef: connection.credentialsRef });
    }
    if (input.status === "DISABLED") {
      const unresolved = await tx.integrationOutbox.count({
        where: { connectionId: input.id, status: { in: ["PENDING", "PROCESSING", "RETRY"] } },
      });
      if (unresolved > 0) throw new Error("Integration connection cannot be disabled while outbound work is unresolved");
    }
    const updated = await tx.integrationConnection.update({
      where: { id: input.id },
      data: { status: input.status, ...(input.status === "DISABLED" ? { lastError: null } : {}) },
    });
    await tx.auditLog.create({ data: {
      actorId: input.actorId,
      entityType: "IntegrationConnection",
      entityId: input.id,
      action: "STATUS_CHANGE",
      before: { status: connection.status },
      after: { status: input.status },
    } });
    return updated;
  });
}

export async function setCompanyIntegrationRoute(input: {
  tenantKey?: string;
  companyId: string;
  connectionId: string;
  enabled: boolean;
  actorId: string;
}) {
  const tenantKey = input.tenantKey ?? "default";
  return db.$transaction(async (tx) => {
    await lockIntegrationRegistry(tx, tenantKey);
    await lockCompanyIntegrationRoutes(tx, [input.companyId]);
    await lockIntegrationConnections(tx, [input.connectionId]);
    await requireCurrentAdminActor(tx, input.actorId);
    const [company, connection] = await Promise.all([
      tx.company.findUnique({ where: { id: input.companyId }, select: { id: true, deletedAt: true } }),
      tx.integrationConnection.findFirst({ where: { id: input.connectionId, tenantKey } }),
    ]);
    if (!company || company.deletedAt) throw new Error("Company not found");
    if (!connection || !ORDER_SYSTEMS.includes(connection.system)) throw new Error("Governed ERP connection not found");
    if (input.enabled) {
      await tx.integrationCompanyRoute.upsert({
        where: { tenantKey_companyId_connectionId_purpose: {
          tenantKey, companyId: input.companyId, connectionId: input.connectionId, purpose: "ORDER_SUBMISSION",
        } },
        update: {},
        create: { tenantKey, companyId: input.companyId, connectionId: input.connectionId, purpose: "ORDER_SUBMISSION" },
      });
    } else {
      await tx.integrationCompanyRoute.deleteMany({
        where: { tenantKey, companyId: input.companyId, connectionId: input.connectionId, purpose: "ORDER_SUBMISSION" },
      });
    }
    await tx.auditLog.create({ data: {
      actorId: input.actorId,
      entityType: "IntegrationCompanyRoute",
      entityId: `${input.companyId}:${input.connectionId}`,
      action: "STATUS_CHANGE",
      after: { companyId: input.companyId, connectionId: input.connectionId, purpose: "ORDER_SUBMISSION", enabled: input.enabled },
    } });
  });
}
