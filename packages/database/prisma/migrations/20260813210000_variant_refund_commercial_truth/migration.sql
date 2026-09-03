-- Persist exact returned-line commercial/tax facts and recognize completed
-- refunds from their own immutable ledger values.
ALTER TABLE "Refund"
  ADD COLUMN "returnRequestId" TEXT,
  ADD COLUMN "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Preserve the former proportional semantics for historical refunds. New
-- itemized refunds are written from immutable returned-line snapshots.
UPDATE "Refund" r
SET "vatAmount" = CASE
      WHEN o.total > 0 THEN ROUND((r.amount * o."vatAmount" / o.total)::numeric, 2)
      ELSE 0
    END,
    "netAmount" = r.amount - CASE
      WHEN o.total > 0 THEN ROUND((r.amount * o."vatAmount" / o.total)::numeric, 2)
      ELSE 0
    END
FROM "Order" o
WHERE o.id = r."orderId";

CREATE UNIQUE INDEX "Refund_returnRequestId_key" ON "Refund"("returnRequestId");

CREATE TABLE "ReturnRequestItem" (
  "id" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "netAmount" DECIMAL(12,2) NOT NULL,
  "vatAmount" DECIMAL(12,2) NOT NULL,
  "grossAmount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReturnRequestItem_returnRequestId_orderItemId_key"
  ON "ReturnRequestItem"("returnRequestId", "orderItemId");
CREATE INDEX "ReturnRequestItem_orderItemId_idx" ON "ReturnRequestItem"("orderItemId");

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
