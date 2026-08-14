ALTER TABLE "IntegrationOutbox"
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "fencingToken" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "IntegrationOutbox_status_leaseExpiresAt_idx"
  ON "IntegrationOutbox"("status", "leaseExpiresAt");
