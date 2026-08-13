"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, db, redriveIntegrationOutbox } from "@avenick/database";
import { requireAdminSession } from "@/lib/auth";

const SYSTEMS = new Set(["D365", "SAP", "ERP", "WMS", "PIM"]);
const STATUSES = new Set(["DISABLED", "ACTIVE", "DEGRADED"]);

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function safeBaseUrl(raw: string) {
  if (!raw) return null;
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) {
    throw new Error("Integration base URL must use HTTPS");
  }
  return url.toString().replace(/\/$/, "");
}

function safeCredentialReference(raw: string) {
  if (!raw) return null;
  // Never accept a likely raw token/password into the database. Store only a
  // pointer to the secret manager / deployment environment.
  if (!/^(env|secret|vercel|vault|aws-secrets|azure-keyvault):[A-Za-z0-9_./:-]{2,180}$/.test(raw)) {
    throw new Error("Credentials must be a secret reference such as env:D365_CLIENT_SECRET, not a raw secret");
  }
  return raw;
}

export async function createIntegrationConnection(formData: FormData) {
  const { userId } = await requireAdminSession();
  const system = value(formData, "system").toUpperCase();
  const connectionKey = value(formData, "connectionKey").toLowerCase();
  const name = value(formData, "name");
  if (!SYSTEMS.has(system)) throw new Error("Unsupported integration system");
  if (!/^[a-z0-9][a-z0-9_-]{1,48}$/.test(connectionKey)) throw new Error("Connection key must be 2-49 lowercase letters/numbers/_/-");
  if (name.length < 2 || name.length > 120) throw new Error("Connection name must be 2-120 characters");

  const baseUrl = safeBaseUrl(value(formData, "baseUrl"));
  const credentialsRef = safeCredentialReference(value(formData, "credentialsRef"));
  const connection = await db.integrationConnection.upsert({
    where: {
      tenantKey_system_connectionKey: {
        tenantKey: "default",
        system,
        connectionKey,
      },
    },
    update: {
      name,
      baseUrl,
      credentialsRef,
      // Editing connection metadata never silently makes it active.
      status: "DISABLED",
      lastError: null,
    },
    create: {
      tenantKey: "default",
      system,
      connectionKey,
      name,
      baseUrl,
      credentialsRef,
      status: "DISABLED",
    },
  });

  await db.auditLog.create({
    data: {
      actorId: userId,
      entityType: "IntegrationConnection",
      entityId: connection.id,
      action: AuditAction.UPDATE,
      after: {
        system,
        connectionKey,
        name,
        baseUrl,
        credentialsRef: credentialsRef ? "REFERENCE_SET" : "NOT_SET",
        status: "DISABLED",
      },
    },
  });
  revalidatePath("/integrations");
}

export async function setIntegrationConnectionStatus(id: string, status: string) {
  const { userId } = await requireAdminSession();
  const next = status.toUpperCase();
  if (!STATUSES.has(next)) throw new Error("Unsupported connection status");
  const connection = await db.integrationConnection.findUnique({ where: { id } });
  if (!connection) throw new Error("Integration connection not found");

  if (next === "ACTIVE") {
    if (!connection.baseUrl) throw new Error("A base URL is required before activation");
    if (!connection.credentialsRef) throw new Error("A secret-manager credential reference is required before activation");
  }

  await db.$transaction([
    db.integrationConnection.update({
      where: { id },
      data: {
        status: next,
        // Activation means administratively enabled, NOT connectivity verified.
        ...(next === "DISABLED" ? { lastError: null } : {}),
      },
    }),
    db.auditLog.create({
      data: {
        actorId: userId,
        entityType: "IntegrationConnection",
        entityId: id,
        action: AuditAction.STATUS_CHANGE,
        before: { status: connection.status },
        after: { status: next },
      },
    }),
  ]);
  revalidatePath("/integrations");
}

export async function redriveIntegrationMessage(id: string) {
  const { userId } = await requireAdminSession();
  await redriveIntegrationOutbox(id, userId);
  revalidatePath("/integrations");
}
