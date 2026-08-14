ALTER TABLE "IntegrationOutbox" ADD COLUMN "connectionId" TEXT;
ALTER TABLE "IntegrationInbox" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3), ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3), ADD COLUMN "fencingToken" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "IntegrationInbox_status_nextAttemptAt_leaseExpiresAt_idx" ON "IntegrationInbox"("status", "nextAttemptAt", "leaseExpiresAt");
ALTER TABLE "ExternalAccountLink" ADD CONSTRAINT "ExternalAccountLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalProductLink" ADD CONSTRAINT "ExternalProductLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilitySnapshot" ADD CONSTRAINT "AvailabilitySnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilitySnapshot" ADD CONSTRAINT "AvailabilitySnapshot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderIntegrationState" ADD CONSTRAINT "OrderIntegrationState_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationOutbox" ADD CONSTRAINT "IntegrationOutbox_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "IntegrationOutbox_connectionId_idx" ON "IntegrationOutbox"("connectionId");
CREATE TABLE "IntegrationWorkerHealth" (
  "workerId" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL, "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
  "lastClaimAt" TIMESTAMP(3), "lastSuccessAt" TIMESTAMP(3), "lastFailureAt" TIMESTAMP(3), "lastError" TEXT,
  "processedCount" INTEGER NOT NULL DEFAULT 0, "failedCount" INTEGER NOT NULL DEFAULT 0, "metadata" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "IntegrationWorkerHealth_pkey" PRIMARY KEY ("workerId")
);
CREATE INDEX "IntegrationWorkerHealth_lastHeartbeatAt_idx" ON "IntegrationWorkerHealth"("lastHeartbeatAt");
