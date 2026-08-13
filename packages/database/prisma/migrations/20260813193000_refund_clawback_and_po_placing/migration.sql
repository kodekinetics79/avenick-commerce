ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'PLACING' BEFORE 'ORDERED';

CREATE TYPE "SellerFinancialAdjustmentStatus" AS ENUM ('OPEN', 'APPLIED');

ALTER TABLE "Refund" ADD COLUMN "gatewayRef" TEXT;
CREATE UNIQUE INDEX "Refund_gatewayRef_key" ON "Refund"("gatewayRef");

CREATE TABLE "SellerFinancialAdjustment" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" "Currency" NOT NULL,
  "status" "SellerFinancialAdjustmentStatus" NOT NULL DEFAULT 'OPEN',
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "SellerFinancialAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerFinancialAdjustment_amount_negative" CHECK ("amount" < 0),
  CONSTRAINT "SellerFinancialAdjustment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SellerFinancialAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SellerFinancialAdjustment_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SellerFinancialAdjustment_refundId_sellerId_key" ON "SellerFinancialAdjustment"("refundId", "sellerId");
CREATE INDEX "SellerFinancialAdjustment_sellerId_status_idx" ON "SellerFinancialAdjustment"("sellerId", "status");
CREATE INDEX "SellerFinancialAdjustment_orderId_idx" ON "SellerFinancialAdjustment"("orderId");
