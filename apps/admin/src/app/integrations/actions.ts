"use server";

import { revalidatePath } from "next/cache";
import {
  governedIntegrationPolicy,
  redriveIntegrationInbox,
  redriveIntegrationOutbox,
  saveGovernedIntegrationConnection,
  setCompanyIntegrationRoute,
  setGovernedIntegrationConnectionStatus,
} from "@avenick/database";
import { getTranslations } from "next-intl/server";
import { requireAdminSession } from "@/lib/auth";

const SYSTEMS = new Set(["D365", "SAP", "ERP", "WMS", "PIM"]);
const STATUSES = new Set(["DISABLED", "ACTIVE", "DEGRADED"]);

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function createIntegrationConnection(formData: FormData) {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.integrationActions");
  const system = value(formData, "system").toUpperCase();
  const connectionKey = value(formData, "connectionKey").toLowerCase();
  const name = value(formData, "name");
  if (!SYSTEMS.has(system)) throw new Error(t("unsupportedSystem"));
  if (!/^[a-z0-9][a-z0-9_-]{1,48}$/.test(connectionKey)) throw new Error(t("invalidConnectionKey"));
  if (name.length < 2 || name.length > 120) throw new Error(t("invalidName"));

  const rawBaseUrl = value(formData, "baseUrl");
  const rawCredentialsRef = value(formData, "credentialsRef");
  const configured = rawBaseUrl || rawCredentialsRef
    ? governedIntegrationPolicy({ system, baseUrl: rawBaseUrl, credentialsRef: rawCredentialsRef })
    : null;
  const baseUrl = configured?.baseUrl ?? null;
  const credentialsRef = configured?.credentialsRef ?? null;
  await saveGovernedIntegrationConnection({
    system, connectionKey, name, baseUrl, credentialsRef, actorId: userId,
  });
  revalidatePath("/integrations");
}

export async function setIntegrationConnectionStatus(id: string, status: string) {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.integrationActions");
  const next = status.toUpperCase();
  if (!STATUSES.has(next)) throw new Error(t("unsupportedStatus"));
  await setGovernedIntegrationConnectionStatus({ id, status: next, actorId: userId });
  revalidatePath("/integrations");
}

export async function configureCompanyOrderRoute(connectionId: string, formData: FormData) {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.integrationActions");
  const companyId = value(formData, "companyId");
  const enabled = value(formData, "enabled") === "true";
  if (!companyId) throw new Error(t("companyRequired"));
  await setCompanyIntegrationRoute({ companyId, connectionId, enabled, actorId: userId });
  revalidatePath("/integrations");
}

export async function redriveIntegrationMessage(id: string) {
  const { userId } = await requireAdminSession();
  await redriveIntegrationOutbox(id, userId);
  revalidatePath("/integrations");
}

export async function redriveInboundIntegrationMessage(id: string) {
  const { userId } = await requireAdminSession();
  await redriveIntegrationInbox(id, userId);
  revalidatePath("/integrations");
}
