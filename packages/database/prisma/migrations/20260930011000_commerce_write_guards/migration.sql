-- Add fail-closed guards for new writes without taking a long validation lock
-- on existing marketplace rows. Production rollout must audit/backfill any
-- legacy violations, then VALIDATE each constraint in a later migration.

ALTER TABLE "InventoryStock"
  ADD CONSTRAINT "InventoryStock_product_required_check"
  CHECK ("productId" IS NOT NULL) NOT VALID,
  ADD CONSTRAINT "InventoryStock_quantities_check"
  CHECK (qty >= 0 AND "reservedQty" >= 0 AND "reorderPoint" >= 0 AND "reservedQty" <= qty) NOT VALID;

ALTER TABLE "ProductPrice"
  ADD CONSTRAINT "ProductPrice_owner_check"
  CHECK ("productId" IS NOT NULL OR "variantId" IS NOT NULL) NOT VALID,
  ADD CONSTRAINT "ProductPrice_quantity_range_check"
  CHECK ("minQty" > 0 AND ("maxQty" IS NULL OR "maxQty" >= "minQty")) NOT VALID,
  ADD CONSTRAINT "ProductPrice_amount_check"
  CHECK (price > 0 AND "vatRate" >= 0 AND "vatRate" <= 100) NOT VALID;

ALTER TABLE "Cart"
  ADD CONSTRAINT "Cart_owner_check"
  CHECK (("userId" IS NOT NULL) <> ("sessionId" IS NOT NULL)) NOT VALID;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_context_check"
  CHECK ("threadId" IS NOT NULL OR "rfqId" IS NOT NULL) NOT VALID;
