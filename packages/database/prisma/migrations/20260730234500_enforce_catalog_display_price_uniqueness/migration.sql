-- A catalog card must have one stable quantity-one price per channel/currency.
-- Fail explicitly if legacy data violates the invariant; operators must resolve
-- conflicting prices instead of letting a migration silently choose one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ProductPrice"
    WHERE "isActive" = true
      AND "productId" IS NOT NULL
      AND "minQty" <= 1
      AND ("maxQty" IS NULL OR "maxQty" >= 1)
    GROUP BY "productId", "type", "currency"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Conflicting active quantity-one product prices must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ProductPrice"
    WHERE "isActive" = true
      AND "variantId" IS NOT NULL
      AND "minQty" <= 1
      AND ("maxQty" IS NULL OR "maxQty" >= 1)
    GROUP BY "variantId", "type", "currency"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Conflicting active quantity-one variant prices must be resolved before migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "ProductPrice_active_unit_product_channel_currency_key"
ON "ProductPrice" ("productId", "type", "currency")
WHERE "isActive" = true
  AND "productId" IS NOT NULL
  AND "minQty" <= 1
  AND ("maxQty" IS NULL OR "maxQty" >= 1);

CREATE UNIQUE INDEX "ProductPrice_active_unit_variant_channel_currency_key"
ON "ProductPrice" ("variantId", "type", "currency")
WHERE "isActive" = true
  AND "variantId" IS NOT NULL
  AND "minQty" <= 1
  AND ("maxQty" IS NULL OR "maxQty" >= 1);
