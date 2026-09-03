ALTER TABLE "ApprovalPolicy" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PurchaseOrder"
  ADD COLUMN "approvalSnapshot" JSONB,
  ADD COLUMN "approvedCommercialFingerprint" TEXT,
  ADD COLUMN "approvalVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

ALTER TABLE "Order" ADD COLUMN "requestFingerprint" TEXT;
