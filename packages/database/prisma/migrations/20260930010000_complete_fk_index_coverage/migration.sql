-- Foreign-key indexes are not created automatically by PostgreSQL. These
-- indexes keep parent deletes, relation lookups, and integration cleanup from
-- degrading into table scans as the marketplace grows.
CREATE INDEX "IntegrationCompanyRoute_companyId_idx"
  ON "IntegrationCompanyRoute"("companyId");

CREATE INDEX "ExternalAccountLink_companyId_idx"
  ON "ExternalAccountLink"("companyId");

CREATE INDEX "ExternalProductLink_productId_idx"
  ON "ExternalProductLink"("productId");

CREATE INDEX "AvailabilitySnapshot_productId_idx"
  ON "AvailabilitySnapshot"("productId");

CREATE INDEX "AvailabilitySnapshot_variantId_idx"
  ON "AvailabilitySnapshot"("variantId");

CREATE INDEX "OrderIntegrationState_orderId_idx"
  ON "OrderIntegrationState"("orderId");

CREATE INDEX "PurchaseOrderItem_variantId_idx"
  ON "PurchaseOrderItem"("variantId");

CREATE INDEX "Company_verifiedById_idx"
  ON "Company"("verifiedById");

CREATE INDEX "CompanyDocument_reviewedById_idx"
  ON "CompanyDocument"("reviewedById");
