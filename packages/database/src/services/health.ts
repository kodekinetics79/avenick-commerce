import { db } from "../index";

export interface DbHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/** Lightweight connectivity probe for readiness checks. */
export async function checkDatabaseHealth(timeoutMs = 2000): Promise<DbHealth> {
  const started = Date.now();
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database probe timed out")), timeoutMs),
      ),
    ]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : "Unknown database error",
    };
  }
}
