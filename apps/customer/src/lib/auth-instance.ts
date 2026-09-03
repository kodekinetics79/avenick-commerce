import { createAuth } from "@avenick/auth";
import { resolveRemotePortalSession } from "@avenick/auth/remote-session";
import { headers } from "next/headers";

const instance = createAuth("customer");

export const { handlers, signIn, signOut } = instance;

export async function auth() {
  try {
    const session = await instance.auth();
    if (session) return session;
  } catch {
    // Vercel delegates authentication to Render and may not decode its JWT.
  }
  return resolveRemotePortalSession("customer", headers().get("cookie"));
}
