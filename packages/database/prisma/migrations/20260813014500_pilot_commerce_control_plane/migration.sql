-- Pilot commerce control-plane: governed catalog metadata, seller staff,
-- promotions/referrals, ERP truth, pricing/availability evidence and outbox/inbox.

CREATE TABLE "SellerMembership" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SellerMembership_userId_key" ON "SellerMembership"("userId");
CREATE INDEX "SellerMembership_sellerId_isActive_idx" ON "SellerMembership"("sellerId", "isActive");
ALTER TABLE "SellerMembership" ADD CONSTRAINT "SellerMembership_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerMembership" ADD CONSTRAINT "SellerMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductCommercialMetadata" (
  "id" TEXT NOT NULL, "productId" TEXT NOT NULL, "sourceSystem" TEXT NOT NULL DEFAULT 'CATALOG_IMPORT',
  "sourceSheet" TEXT, "sourceRow" INTEGER, "erpCode" TEXT, "externalItemNumber" TEXT,
  "manufacturerPartNumber" TEXT, "supplierPartNumber" TEXT, "uom" TEXT, "purchaseUom" TEXT,
  "moqPurchase" INTEGER, "deliveryLeadTimeDays" INTEGER, "leadTimeText" TEXT, "hsCode" TEXT, "incoterms" TEXT,
  "purchasePrice" DECIMAL(14,4), "purchaseCurrencyCode" TEXT, "landedCost" DECIMAL(14,4),
  "packQty" INTEGER, "palletQty" INTEGER, "vendorCode" TEXT, "vendorLegalName" TEXT, "productGroup" TEXT,
  "sourcePayload" JSONB, "sourceFingerprint" TEXT NOT NULL, "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ProductCommercialMetadata_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductCommercialMetadata_productId_key" ON "ProductCommercialMetadata"("productId");
CREATE INDEX "ProductCommercialMetadata_erpCode_idx" ON "ProductCommercialMetadata"("erpCode");
CREATE INDEX "ProductCommercialMetadata_manufacturerPartNumber_idx" ON "ProductCommercialMetadata"("manufacturerPartNumber");
CREATE INDEX "ProductCommercialMetadata_externalItemNumber_idx" ON "ProductCommercialMetadata"("externalItemNumber");
CREATE INDEX "ProductCommercialMetadata_sourceSystem_observedAt_idx" ON "ProductCommercialMetadata"("sourceSystem", "observedAt");
ALTER TABLE "ProductCommercialMetadata" ADD CONSTRAINT "ProductCommercialMetadata_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommercePromotion" (
  "id" TEXT NOT NULL, "tenantKey" TEXT NOT NULL DEFAULT 'default', "name" TEXT NOT NULL, "description" TEXT,
  "type" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "scope" TEXT NOT NULL DEFAULT 'PLATFORM',
  "sellerId" TEXT, "companyId" TEXT, "currency" "Currency", "value" DECIMAL(14,4) NOT NULL,
  "minOrderAmount" DECIMAL(14,2), "maxDiscountAmount" DECIMAL(14,2), "usageLimit" INTEGER, "perCustomerLimit" INTEGER,
  "stackable" BOOLEAN NOT NULL DEFAULT false, "priority" INTEGER NOT NULL DEFAULT 100, "eligibility" JSONB,
  "campaignBudget" DECIMAL(14,2), "accountingTreatment" TEXT, "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3),
  "createdById" TEXT, "approvedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CommercePromotion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommercePromotion_tenantKey_status_startsAt_endsAt_idx" ON "CommercePromotion"("tenantKey", "status", "startsAt", "endsAt");
CREATE INDEX "CommercePromotion_sellerId_idx" ON "CommercePromotion"("sellerId");
CREATE INDEX "CommercePromotion_companyId_idx" ON "CommercePromotion"("companyId");

CREATE TABLE "PromotionCoupon" (
  "id" TEXT NOT NULL, "promotionId" TEXT NOT NULL, "code" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "usageLimit" INTEGER, "perCustomerLimit" INTEGER, "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionCoupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromotionCoupon_code_key" ON "PromotionCoupon"("code");
CREATE INDEX "PromotionCoupon_promotionId_status_idx" ON "PromotionCoupon"("promotionId", "status");

CREATE TABLE "PromotionRedemption" (
  "id" TEXT NOT NULL, "promotionId" TEXT NOT NULL, "couponId" TEXT, "userId" TEXT NOT NULL, "companyId" TEXT,
  "orderId" TEXT NOT NULL, "discountAmount" DECIMAL(14,2) NOT NULL, "currency" "Currency" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromotionRedemption_promotionId_orderId_key" ON "PromotionRedemption"("promotionId", "orderId");
CREATE INDEX "PromotionRedemption_couponId_userId_idx" ON "PromotionRedemption"("couponId", "userId");
CREATE INDEX "PromotionRedemption_companyId_idx" ON "PromotionRedemption"("companyId");

CREATE TABLE "ReferralProgram" (
  "id" TEXT NOT NULL, "tenantKey" TEXT NOT NULL DEFAULT 'default', "name" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "referrerRewardType" TEXT NOT NULL, "referrerRewardValue" DECIMAL(14,4) NOT NULL, "refereeRewardType" TEXT NOT NULL,
  "refereeRewardValue" DECIMAL(14,4) NOT NULL, "currency" "Currency", "maxUsesPerCode" INTEGER,
  "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3), "eligibility" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralProgram_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReferralProgram_tenantKey_status_idx" ON "ReferralProgram"("tenantKey", "status");

CREATE TABLE "ReferralCode" (
  "id" TEXT NOT NULL, "programId" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "uses" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_programId_ownerUserId_idx" ON "ReferralCode"("programId", "ownerUserId");

CREATE TABLE "ReferralAttribution" (
  "id" TEXT NOT NULL, "referralCodeId" TEXT NOT NULL, "referredUserId" TEXT NOT NULL, "orderId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ATTRIBUTED', "rewardAmount" DECIMAL(14,2), "currency" "Currency",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "rewardedAt" TIMESTAMP(3),
  CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralAttribution_referralCodeId_referredUserId_key" ON "ReferralAttribution"("referralCodeId", "referredUserId");
CREATE INDEX "ReferralAttribution_orderId_idx" ON "ReferralAttribution"("orderId");

CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL, "tenantKey" TEXT NOT NULL DEFAULT 'default', "system" TEXT NOT NULL, "connectionKey" TEXT NOT NULL,
  "name" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DISABLED', "baseUrl" TEXT, "credentialsRef" TEXT, "settings" JSONB,
  "lastHealthCheckAt" TIMESTAMP(3), "lastSuccessAt" TIMESTAMP(3), "lastFailureAt" TIMESTAMP(3), "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntegrationConnection_tenantKey_system_connectionKey_key" ON "IntegrationConnection"("tenantKey", "system", "connectionKey");
CREATE INDEX "IntegrationConnection_tenantKey_status_idx" ON "IntegrationConnection"("tenantKey", "status");

CREATE TABLE "ExternalAccountLink" (
  "id" TEXT NOT NULL, "tenantKey" TEXT NOT NULL DEFAULT 'default', "companyId" TEXT NOT NULL, "system" TEXT NOT NULL,
  "externalCustomerId" TEXT NOT NULL, "salesArea" TEXT, "priceGroup" TEXT, "metadata" JSONB, "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ExternalAccountLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExternalAccountLink_tenantKey_companyId_system_key" ON "ExternalAccountLink"("tenantKey", "companyId", "system");
CREATE INDEX "ExternalAccountLink_system_externalCustomerId_idx" ON "ExternalAccountLink"("system", "externalCustomerId");

CREATE TABLE "ExternalProductLink" (
  "id" TEXT NOT NULL, "tenantKey" TEXT NOT NULL DEFAULT 'default', "productId" TEXT NOT NULL, "system" TEXT NOT NULL,
  "externalProductId" TEXT NOT NULL, "externalSku" TEXT, "metadata" JSONB, "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ExternalProductLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExternalProductLink_tenantKey_productId_system_key" ON "ExternalProductLink"("tenantKey", "productId", "system");
CREATE INDEX "ExternalProductLink_system_externalProductId_idx" ON "ExternalProductLink"("system", "externalProductId");

CREATE TABLE "AvailabilitySnapshot" (
  "id" TEXT NOT NULL, "tenantKey" TEXT NOT NULL DEFAULT 'default', "productId" TEXT NOT NULL, "variantId" TEXT,
  "warehouseCode" TEXT, "sourceSystem" TEXT NOT NULL, "state" TEXT NOT NULL, "availableQty" INTEGER, "reservedQty" INTEGER,
  "expectedRestockAt" TIMESTAMP(3), "provenance" JSONB, "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AvailabilitySnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AvailabilitySnapshot_tenantKey_productId_observedAt_idx" ON "AvailabilitySnapshot"("tenantKey", "productId", "observedAt");
CREATE INDEX "AvailabilitySnapshot_expiresAt_idx" ON "AvailabilitySnapshot"("expiresAt");

CREATE TABLE "CommercialPriceSnapshot" (
  "id" TEXT NOT NULL, "tenantKey" TEXT NOT NULL DEFAULT 'default', "productId" TEXT NOT NULL, "variantId" TEXT, "companyId" TEXT,
  "source" TEXT NOT NULL, "sourceSystem" TEXT, "sourceReference" TEXT, "currency" "Currency" NOT NULL, "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(14,4) NOT NULL, "explanation" JSONB NOT NULL, "validFrom" TIMESTAMP(3), "validUntil" TIMESTAMP(3),
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommercialPriceSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommercialPriceSnapshot_tenantKey_productId_companyId_currency_observedAt_idx" ON "CommercialPriceSnapshot"("tenantKey", "productId", "companyId", "currency", "observedAt");

CREATE TABLE "IntegrationOutbox" (
  "id" TEXT NOT NULL, "tenantKey" TEXT NOT NULL DEFAULT 'default', "aggregateType" TEXT NOT NULL, "aggregateId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL, "destination" TEXT NOT NULL, "payload" JSONB NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3), "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMP(3), CONSTRAINT "IntegrationOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntegrationOutbox_idempotencyKey_key" ON "IntegrationOutbox"("idempotencyKey");
CREATE INDEX "IntegrationOutbox_status_nextAttemptAt_createdAt_idx" ON "IntegrationOutbox"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "IntegrationOutbox_aggregateType_aggregateId_idx" ON "IntegrationOutbox"("aggregateType", "aggregateId");

CREATE TABLE "IntegrationInbox" (
  "id" TEXT NOT NULL, "tenantKey" TEXT NOT NULL DEFAULT 'default', "source" TEXT NOT NULL, "externalEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL, "payload" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMP(3), "lastError" TEXT,
  CONSTRAINT "IntegrationInbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntegrationInbox_tenantKey_source_externalEventId_key" ON "IntegrationInbox"("tenantKey", "source", "externalEventId");
CREATE INDEX "IntegrationInbox_status_receivedAt_idx" ON "IntegrationInbox"("status", "receivedAt");

CREATE TABLE "OrderIntegrationState" (
  "id" TEXT NOT NULL, "tenantKey" TEXT NOT NULL DEFAULT 'default', "orderId" TEXT NOT NULL, "system" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING_VALIDATION', "externalOrderId" TEXT, "correlationId" TEXT, "lastValidatedAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3), "acceptedAt" TIMESTAMP(3), "rejectedAt" TIMESTAMP(3), "rejectionReason" TEXT,
  "authoritativeTotals" JSONB, "updatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderIntegrationState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderIntegrationState_tenantKey_orderId_system_key" ON "OrderIntegrationState"("tenantKey", "orderId", "system");
CREATE INDEX "OrderIntegrationState_state_updatedAt_idx" ON "OrderIntegrationState"("state", "updatedAt");

CREATE TABLE "OrderLinePriceTrace" (
  "id" TEXT NOT NULL, "orderItemId" TEXT NOT NULL, "currency" "Currency" NOT NULL, "listPrice" DECIMAL(14,4),
  "contractPrice" DECIMAL(14,4), "volumeAdjustment" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "promotionDiscount" DECIMAL(14,4) NOT NULL DEFAULT 0, "couponDiscount" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "referralCredit" DECIMAL(14,4) NOT NULL DEFAULT 0, "finalUnitPrice" DECIMAL(14,4) NOT NULL, "sourceSystem" TEXT,
  "explanation" JSONB NOT NULL, "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderLinePriceTrace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderLinePriceTrace_orderItemId_key" ON "OrderLinePriceTrace"("orderItemId");
