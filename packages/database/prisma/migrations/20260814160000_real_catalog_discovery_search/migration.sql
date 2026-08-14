CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Product"
  ADD COLUMN "isPubliclyDiscoverable" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing public B2C discovery, explicitly exclude system fixtures,
-- and activate only ACTIVE client-pilot rows. Purchasing remains controlled by
-- isB2CEnabled, channel prices, and authoritative inventory.
UPDATE "Product" AS p
SET "isPubliclyDiscoverable" = true
WHERE p.status = 'ACTIVE'
  AND p."deletedAt" IS NULL
  AND NOT ('demo' = ANY(p.tags) OR 'certification' = ANY(p.tags))
  AND (
    p."isB2CEnabled" = true
    OR EXISTS (
      SELECT 1
      FROM "ProductCommercialMetadata" AS metadata
      WHERE metadata."productId" = p.id
        AND metadata."sourceSystem" = 'CLIENT_PILOT_CATALOG'
    )
  );

CREATE INDEX "Product_nameEn_trgm_idx"
  ON "Product" USING GIN ("nameEn" gin_trgm_ops);
CREATE INDEX "Product_nameAr_trgm_idx"
  ON "Product" USING GIN ("nameAr" gin_trgm_ops);
CREATE INDEX "Product_sku_trgm_idx"
  ON "Product" USING GIN (sku gin_trgm_ops);
CREATE INDEX "ProductCommercialMetadata_mpn_trgm_idx"
  ON "ProductCommercialMetadata" USING GIN ("manufacturerPartNumber" gin_trgm_ops);
CREATE INDEX "ProductCommercialMetadata_spn_trgm_idx"
  ON "ProductCommercialMetadata" USING GIN ("supplierPartNumber" gin_trgm_ops);
CREATE INDEX "ProductCommercialMetadata_external_trgm_idx"
  ON "ProductCommercialMetadata" USING GIN ("externalItemNumber" gin_trgm_ops);
CREATE INDEX "ProductCommercialMetadata_erp_trgm_idx"
  ON "ProductCommercialMetadata" USING GIN ("erpCode" gin_trgm_ops);
