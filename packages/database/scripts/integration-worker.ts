import { randomUUID } from "node:crypto";
import { runGovernedIntegrationWorkerOnce } from "../src/services/integration-worker";

const workerId = process.env.INTEGRATION_WORKER_ID ?? `integration-${randomUUID()}`;
const pollMs = Math.max(500, Number(process.env.INTEGRATION_POLL_MS ?? 2000));
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

while (!stopping) {
  await runGovernedIntegrationWorkerOnce(workerId).catch((error) => console.error("integration worker cycle failed", error));
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}
