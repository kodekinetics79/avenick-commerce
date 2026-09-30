-- Expand-only foundation for invitation-scoped, multi-supplier RFQs.
-- Legacy RFQRequest.sellerId/totalQuoted/quoteVersion and RFQItem.unitQuoted
-- remain in place until every reader has cut over to RFQQuote.

CREATE TYPE "RFQSupplierInvitationStatus" AS ENUM (
  'INVITED', 'VIEWED', 'DECLINED', 'QUOTED', 'CLOSED'
);

CREATE TYPE "RFQQuoteStatus" AS ENUM (
  'DRAFT', 'SUBMITTED', 'SUPERSEDED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'
);

CREATE TABLE "RFQSupplierInvitation" (
  "id" TEXT NOT NULL,
  "rfqId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "status" "RFQSupplierInvitationStatus" NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "viewedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "RFQSupplierInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RFQSupplierInvitation_timestamps_check" CHECK (
    ("viewedAt" IS NULL OR "viewedAt" >= "invitedAt")
    AND ("respondedAt" IS NULL OR "respondedAt" >= "invitedAt")
    AND ("closedAt" IS NULL OR "closedAt" >= "invitedAt")
  )
);

CREATE TABLE "RFQQuote" (
  "id" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "rfqId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" "RFQQuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" "Currency" NOT NULL,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "vatAmount" DECIMAL(14,2) NOT NULL,
  "freightAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "freightVatRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "freightVatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "leadTimeDays" INTEGER NOT NULL,
  "paymentTermsDays" INTEGER NOT NULL,
  "notes" TEXT,
  "commercialFingerprint" VARCHAR(64) NOT NULL,
  "submissionKey" TEXT NOT NULL,
  "requestFingerprint" VARCHAR(64) NOT NULL,
  "submittedById" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "acceptedById" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "supersededById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RFQQuote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RFQQuote_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "RFQQuote_amounts_check" CHECK (
    "subtotal" >= 0
    AND "vatAmount" >= 0
    AND "freightAmount" >= 0
    AND "freightVatRate" >= 0
    AND "freightVatRate" <= 100
    AND "freightVatAmount" >= 0
    AND "total" = "subtotal" + "vatAmount" + "freightAmount" + "freightVatAmount"
  ),
  CONSTRAINT "RFQQuote_terms_check" CHECK (
    (("status" = 'DRAFT' AND "submittedAt" IS NULL)
      OR ("status" <> 'DRAFT' AND "submittedAt" IS NOT NULL AND "validUntil" > "submittedAt"))
    AND "leadTimeDays" >= 0
    AND "paymentTermsDays" >= 0
  ),
  CONSTRAINT "RFQQuote_acceptance_check" CHECK (
    ("status" = 'ACCEPTED' AND "acceptedById" IS NOT NULL AND "acceptedAt" IS NOT NULL)
    OR ("status" <> 'ACCEPTED' AND "acceptedById" IS NULL AND "acceptedAt" IS NULL)
  ),
  CONSTRAINT "RFQQuote_supersession_check" CHECK (
    ("status" = 'SUPERSEDED' AND "supersededById" IS NOT NULL)
    OR ("status" <> 'SUPERSEDED' AND "supersededById" IS NULL)
  )
);

CREATE TABLE "RFQQuoteItem" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "rfqItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "sku" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(14,4) NOT NULL,
  "vatRate" DECIMAL(5,2) NOT NULL,
  "lineSubtotal" DECIMAL(14,2) NOT NULL,
  "lineVatAmount" DECIMAL(14,2) NOT NULL,
  "lineTotal" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RFQQuoteItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RFQQuoteItem_commercial_check" CHECK (
    "quantity" > 0
    AND "unitPrice" >= 0
    AND "vatRate" >= 0
    AND "vatRate" <= 100
    AND "lineSubtotal" >= 0
    AND "lineVatAmount" >= 0
    AND "lineTotal" = "lineSubtotal" + "lineVatAmount"
  )
);

ALTER TABLE "RFQRequest"
  ADD COLUMN "acceptedQuoteId" TEXT,
  ADD COLUMN "creationKey" TEXT,
  ADD COLUMN "responseDueAt" TIMESTAMP(3),
  ADD COLUMN "awardByAt" TIMESTAMP(3),
  ADD CONSTRAINT "RFQRequest_creation_key_check" CHECK (
    "creationKey" IS NULL OR char_length("creationKey") BETWEEN 1 AND 200
  ),
  ADD CONSTRAINT "RFQRequest_deadlines_check" CHECK (
    ("responseDueAt" IS NULL OR "awardByAt" IS NULL OR "responseDueAt" <= "awardByAt")
    AND ("awardByAt" IS NULL OR "expiresAt" IS NULL OR "awardByAt" <= "expiresAt")
  );

ALTER TABLE "PurchaseOrder"
  ALTER COLUMN "total" TYPE DECIMAL(14,2),
  ADD COLUMN "subtotal" DECIMAL(14,2),
  ADD COLUMN "vatAmount" DECIMAL(14,2),
  ADD COLUMN "freightAmount" DECIMAL(14,2),
  ADD COLUMN "freightVatRate" DECIMAL(5,2),
  ADD COLUMN "freightVatAmount" DECIMAL(14,2),
  ADD COLUMN "sourceRfqQuoteId" TEXT,
  ADD CONSTRAINT "PurchaseOrder_quote_amounts_check" CHECK (
    "sourceRfqQuoteId" IS NULL
    OR (
      "subtotal" IS NOT NULL
      AND "vatAmount" IS NOT NULL
      AND "freightAmount" IS NOT NULL
      AND "freightVatRate" IS NOT NULL
      AND "freightVatAmount" IS NOT NULL
      AND "total" = "subtotal" + "vatAmount" + "freightAmount" + "freightVatAmount"
    )
  );

ALTER TABLE "PurchaseOrderItem" ADD COLUMN "sourceRfqQuoteItemId" TEXT;

CREATE UNIQUE INDEX "RFQSupplierInvitation_rfqId_sellerId_key"
  ON "RFQSupplierInvitation"("rfqId", "sellerId");
CREATE UNIQUE INDEX "RFQSupplierInvitation_id_rfqId_sellerId_key"
  ON "RFQSupplierInvitation"("id", "rfqId", "sellerId");
CREATE INDEX "RFQSupplierInvitation_sellerId_status_invitedAt_idx"
  ON "RFQSupplierInvitation"("sellerId", "status", "invitedAt");
CREATE INDEX "RFQSupplierInvitation_rfqId_status_idx"
  ON "RFQSupplierInvitation"("rfqId", "status");
CREATE INDEX "RFQSupplierInvitation_invitedById_idx"
  ON "RFQSupplierInvitation"("invitedById");

CREATE UNIQUE INDEX "RFQQuote_rfqId_sellerId_revision_key"
  ON "RFQQuote"("rfqId", "sellerId", "revision");
CREATE UNIQUE INDEX "RFQQuote_sellerId_submissionKey_key"
  ON "RFQQuote"("sellerId", "submissionKey");
CREATE UNIQUE INDEX "RFQQuote_supersededById_key" ON "RFQQuote"("supersededById");
CREATE INDEX "RFQQuote_invitationId_rfqId_sellerId_idx"
  ON "RFQQuote"("invitationId", "rfqId", "sellerId");
CREATE INDEX "RFQQuote_invitationId_status_submittedAt_idx"
  ON "RFQQuote"("invitationId", "status", "submittedAt");
CREATE INDEX "RFQQuote_rfqId_status_submittedAt_idx"
  ON "RFQQuote"("rfqId", "status", "submittedAt");
CREATE INDEX "RFQQuote_sellerId_status_submittedAt_idx"
  ON "RFQQuote"("sellerId", "status", "submittedAt");
CREATE INDEX "RFQQuote_submittedById_idx" ON "RFQQuote"("submittedById");
CREATE INDEX "RFQQuote_acceptedById_idx" ON "RFQQuote"("acceptedById");
CREATE UNIQUE INDEX "RFQQuote_one_submitted_per_supplier_idx"
  ON "RFQQuote"("rfqId", "sellerId") WHERE "status" = 'SUBMITTED';
CREATE UNIQUE INDEX "RFQQuote_one_accepted_per_rfq_idx"
  ON "RFQQuote"("rfqId") WHERE "status" = 'ACCEPTED';

CREATE UNIQUE INDEX "RFQQuoteItem_quoteId_rfqItemId_key"
  ON "RFQQuoteItem"("quoteId", "rfqItemId");
CREATE INDEX "RFQQuoteItem_rfqItemId_idx" ON "RFQQuoteItem"("rfqItemId");
CREATE INDEX "RFQQuoteItem_productId_idx" ON "RFQQuoteItem"("productId");
CREATE INDEX "RFQQuoteItem_variantId_idx" ON "RFQQuoteItem"("variantId");

CREATE UNIQUE INDEX "RFQRequest_acceptedQuoteId_key" ON "RFQRequest"("acceptedQuoteId");
CREATE UNIQUE INDEX "RFQRequest_companyId_creationKey_key"
  ON "RFQRequest"("companyId", "creationKey");
CREATE UNIQUE INDEX "PurchaseOrder_sourceRfqQuoteId_key" ON "PurchaseOrder"("sourceRfqQuoteId");
CREATE UNIQUE INDEX "PurchaseOrderItem_sourceRfqQuoteItemId_key"
  ON "PurchaseOrderItem"("sourceRfqQuoteItemId");

ALTER TABLE "RFQSupplierInvitation"
  ADD CONSTRAINT "RFQSupplierInvitation_rfqId_fkey"
    FOREIGN KEY ("rfqId") REFERENCES "RFQRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RFQSupplierInvitation_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RFQSupplierInvitation_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RFQQuote"
  ADD CONSTRAINT "RFQQuote_invitationId_rfqId_sellerId_fkey"
    FOREIGN KEY ("invitationId", "rfqId", "sellerId")
    REFERENCES "RFQSupplierInvitation"("id", "rfqId", "sellerId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RFQQuote_rfqId_fkey"
    FOREIGN KEY ("rfqId") REFERENCES "RFQRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RFQQuote_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RFQQuote_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RFQQuote_acceptedById_fkey"
    FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RFQQuote_supersededById_fkey"
    FOREIGN KEY ("supersededById") REFERENCES "RFQQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RFQQuoteItem"
  ADD CONSTRAINT "RFQQuoteItem_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "RFQQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RFQQuoteItem_rfqItemId_fkey"
    FOREIGN KEY ("rfqItemId") REFERENCES "RFQItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RFQQuoteItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RFQQuoteItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RFQRequest"
  ADD CONSTRAINT "RFQRequest_acceptedQuoteId_fkey"
    FOREIGN KEY ("acceptedQuoteId") REFERENCES "RFQQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_sourceRfqQuoteId_fkey"
    FOREIGN KEY ("sourceRfqQuoteId") REFERENCES "RFQQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_sourceRfqQuoteItemId_fkey"
    FOREIGN KEY ("sourceRfqQuoteItemId") REFERENCES "RFQQuoteItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing rows are validated in a later contract migration after orphan
-- reporting/backfill. PostgreSQL still enforces these NOT VALID constraints on
-- every new or changed row from this migration onward.
ALTER TABLE "RFQRequest"
  ADD CONSTRAINT "RFQRequest_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "PurchaseOrder_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- Once submitted, a quote revision's commercial facts are immutable. Only its
-- finite-state status and acceptance attribution may change.
CREATE OR REPLACE FUNCTION "guard_rfq_quote_immutability"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'submitted RFQ quotes are immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" <> 'DRAFT' AND (
    NEW."invitationId" IS DISTINCT FROM OLD."invitationId"
    OR NEW."rfqId" IS DISTINCT FROM OLD."rfqId"
    OR NEW."sellerId" IS DISTINCT FROM OLD."sellerId"
    OR NEW."revision" IS DISTINCT FROM OLD."revision"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."subtotal" IS DISTINCT FROM OLD."subtotal"
    OR NEW."vatAmount" IS DISTINCT FROM OLD."vatAmount"
    OR NEW."freightAmount" IS DISTINCT FROM OLD."freightAmount"
    OR NEW."freightVatRate" IS DISTINCT FROM OLD."freightVatRate"
    OR NEW."freightVatAmount" IS DISTINCT FROM OLD."freightVatAmount"
    OR NEW."total" IS DISTINCT FROM OLD."total"
    OR NEW."validUntil" IS DISTINCT FROM OLD."validUntil"
    OR NEW."leadTimeDays" IS DISTINCT FROM OLD."leadTimeDays"
    OR NEW."paymentTermsDays" IS DISTINCT FROM OLD."paymentTermsDays"
    OR NEW."notes" IS DISTINCT FROM OLD."notes"
    OR NEW."commercialFingerprint" IS DISTINCT FROM OLD."commercialFingerprint"
    OR NEW."submissionKey" IS DISTINCT FROM OLD."submissionKey"
    OR NEW."requestFingerprint" IS DISTINCT FROM OLD."requestFingerprint"
    OR NEW."submittedById" IS DISTINCT FROM OLD."submittedById"
    OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
  ) THEN
    RAISE EXCEPTION 'submitted RFQ quote commercial terms are immutable';
  END IF;

  IF OLD."status" = 'ACCEPTED' AND (
    NEW."acceptedById" IS DISTINCT FROM OLD."acceptedById"
    OR NEW."acceptedAt" IS DISTINCT FROM OLD."acceptedAt"
  ) THEN
    RAISE EXCEPTION 'accepted RFQ quote attribution is immutable';
  END IF;

  IF (NEW."acceptedById" IS DISTINCT FROM OLD."acceptedById"
      OR NEW."acceptedAt" IS DISTINCT FROM OLD."acceptedAt")
    AND NOT (OLD."status" = 'SUBMITTED' AND NEW."status" = 'ACCEPTED')
  THEN
    RAISE EXCEPTION 'RFQ quote acceptance attribution may only be set while accepting';
  END IF;

  IF NEW."supersededById" IS DISTINCT FROM OLD."supersededById"
    AND NOT (OLD."status" = 'SUBMITTED' AND NEW."status" = 'SUPERSEDED')
  THEN
    RAISE EXCEPTION 'RFQ quote supersession may only be set while superseding';
  END IF;

  IF OLD."status" = 'SUBMITTED' AND NEW."status" = 'SUPERSEDED' AND NOT EXISTS (
    SELECT 1 FROM "RFQQuote" successor
    WHERE successor."id" = NEW."supersededById"
      AND successor."invitationId" = OLD."invitationId"
      AND successor."rfqId" = OLD."rfqId"
      AND successor."sellerId" = OLD."sellerId"
      AND successor."revision" = OLD."revision" + 1
      AND successor."status" = 'DRAFT'
  ) THEN
    RAISE EXCEPTION 'superseding quote must be the next draft revision in the same invitation scope';
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" = 'SUBMITTED')
    OR (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('SUPERSEDED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'))
  ) THEN
    RAISE EXCEPTION 'invalid RFQ quote transition: % -> %', OLD."status", NEW."status";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RFQQuote_immutable_guard"
  BEFORE UPDATE OR DELETE ON "RFQQuote"
  FOR EACH ROW EXECUTE FUNCTION "guard_rfq_quote_immutability"();

CREATE OR REPLACE FUNCTION "guard_rfq_quote_item_immutability"()
RETURNS trigger AS $$
DECLARE prior_quote_status "RFQQuoteStatus";
DECLARE target_quote_status "RFQQuoteStatus";
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT "status" INTO prior_quote_status FROM "RFQQuote" WHERE "id" = OLD."quoteId";
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT "status" INTO target_quote_status FROM "RFQQuote" WHERE "id" = NEW."quoteId";
  END IF;
  IF (TG_OP <> 'INSERT' AND prior_quote_status <> 'DRAFT')
    OR (TG_OP <> 'DELETE' AND target_quote_status <> 'DRAFT')
  THEN
    RAISE EXCEPTION 'submitted RFQ quote items are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RFQQuoteItem_immutable_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "RFQQuoteItem"
  FOR EACH ROW EXECUTE FUNCTION "guard_rfq_quote_item_immutability"();

-- The accepted quote pointer must name an accepted revision of this RFQ.
CREATE OR REPLACE FUNCTION "guard_rfq_accepted_quote"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."acceptedQuoteId" IS NOT NULL
    AND NEW."acceptedQuoteId" IS DISTINCT FROM OLD."acceptedQuoteId"
  THEN
    RAISE EXCEPTION 'an accepted RFQ quote cannot be replaced or cleared';
  END IF;
  IF NEW."acceptedQuoteId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "RFQQuote"
    WHERE "id" = NEW."acceptedQuoteId"
      AND "rfqId" = NEW."id"
      AND "status" = 'ACCEPTED'
  ) THEN
    RAISE EXCEPTION 'accepted quote must be an accepted revision of this RFQ';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RFQRequest_accepted_quote_guard"
  BEFORE INSERT OR UPDATE OF "acceptedQuoteId" ON "RFQRequest"
  FOR EACH ROW EXECUTE FUNCTION "guard_rfq_accepted_quote"();

-- A quote-sourced PO is an exact, immutable copy of the accepted quote's money.
CREATE OR REPLACE FUNCTION "guard_quote_sourced_purchase_order"()
RETURNS trigger AS $$
DECLARE source_quote "RFQQuote";
DECLARE source_company_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."sourceRfqQuoteId" IS DISTINCT FROM OLD."sourceRfqQuoteId" THEN
    RAISE EXCEPTION 'quote provenance may only be assigned when a purchase order is created';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."sourceRfqQuoteId" IS NOT NULL AND (
    NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."subtotal" IS DISTINCT FROM OLD."subtotal"
    OR NEW."vatAmount" IS DISTINCT FROM OLD."vatAmount"
    OR NEW."freightAmount" IS DISTINCT FROM OLD."freightAmount"
    OR NEW."freightVatRate" IS DISTINCT FROM OLD."freightVatRate"
    OR NEW."freightVatAmount" IS DISTINCT FROM OLD."freightVatAmount"
    OR NEW."total" IS DISTINCT FROM OLD."total"
  ) THEN
    RAISE EXCEPTION 'quote-sourced purchase order commercial terms are immutable';
  END IF;

  IF NEW."sourceRfqQuoteId" IS NOT NULL THEN
    SELECT q, r."companyId" INTO source_quote, source_company_id
    FROM "RFQQuote" q
    JOIN "RFQRequest" r ON r."id" = q."rfqId"
    WHERE q."id" = NEW."sourceRfqQuoteId";
    IF source_quote."status" <> 'ACCEPTED'
      OR source_company_id IS DISTINCT FROM NEW."companyId"
      OR source_quote."currency" IS DISTINCT FROM NEW."currency"
      OR source_quote."subtotal" IS DISTINCT FROM NEW."subtotal"
      OR source_quote."vatAmount" IS DISTINCT FROM NEW."vatAmount"
      OR source_quote."freightAmount" IS DISTINCT FROM NEW."freightAmount"
      OR source_quote."freightVatRate" IS DISTINCT FROM NEW."freightVatRate"
      OR source_quote."freightVatAmount" IS DISTINCT FROM NEW."freightVatAmount"
      OR source_quote."total" IS DISTINCT FROM NEW."total"
    THEN
      RAISE EXCEPTION 'purchase order must exactly snapshot its accepted quote';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PurchaseOrder_quote_source_guard"
  BEFORE INSERT OR UPDATE ON "PurchaseOrder"
  FOR EACH ROW EXECUTE FUNCTION "guard_quote_sourced_purchase_order"();

-- The deferred check runs after nested line inserts and prevents an incomplete
-- quote snapshot from ever committing.
CREATE OR REPLACE FUNCTION "ensure_quote_purchase_order_complete"()
RETURNS trigger AS $$
DECLARE expected_lines INTEGER;
DECLARE actual_lines INTEGER;
BEGIN
  IF NEW."sourceRfqQuoteId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO expected_lines FROM "RFQQuoteItem"
    WHERE "quoteId" = NEW."sourceRfqQuoteId";
  SELECT COUNT(*) INTO actual_lines FROM "PurchaseOrderItem"
    WHERE "purchaseOrderId" = NEW."id";
  IF expected_lines = 0 OR actual_lines <> expected_lines OR EXISTS (
    SELECT 1 FROM "RFQQuoteItem" quote_line
    WHERE quote_line."quoteId" = NEW."sourceRfqQuoteId"
      AND NOT EXISTS (
        SELECT 1 FROM "PurchaseOrderItem" po_line
        WHERE po_line."purchaseOrderId" = NEW."id"
          AND po_line."sourceRfqQuoteItemId" = quote_line."id"
      )
  ) THEN
    RAISE EXCEPTION 'quote-sourced purchase order must contain every accepted quote line exactly once';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "PurchaseOrder_quote_lines_complete_guard"
  AFTER INSERT OR UPDATE ON "PurchaseOrder"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "ensure_quote_purchase_order_complete"();

CREATE OR REPLACE FUNCTION "guard_quote_sourced_purchase_order_item"()
RETURNS trigger AS $$
DECLARE po_quote_id TEXT;
DECLARE prior_po_quote_id TEXT;
DECLARE quote_line "RFQQuoteItem";
DECLARE quote_seller_id TEXT;
DECLARE target_po_id TEXT;
BEGIN
  target_po_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."purchaseOrderId" ELSE NEW."purchaseOrderId" END;
  SELECT "sourceRfqQuoteId" INTO po_quote_id
  FROM "PurchaseOrder" WHERE "id" = target_po_id;

  IF TG_OP = 'UPDATE' THEN
    SELECT "sourceRfqQuoteId" INTO prior_po_quote_id
    FROM "PurchaseOrder" WHERE "id" = OLD."purchaseOrderId";
    IF prior_po_quote_id IS NOT NULL OR po_quote_id IS NOT NULL
      OR OLD."sourceRfqQuoteItemId" IS NOT NULL OR NEW."sourceRfqQuoteItemId" IS NOT NULL
    THEN
      RAISE EXCEPTION 'quote-sourced purchase order lines cannot be changed';
    END IF;
  END IF;

  IF po_quote_id IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'quote-sourced purchase order lines cannot be deleted';
    END IF;
    IF NEW."sourceRfqQuoteItemId" IS NULL THEN
      RAISE EXCEPTION 'quote-sourced purchase order lines require quote item provenance';
    END IF;
    SELECT * INTO quote_line FROM "RFQQuoteItem" WHERE "id" = NEW."sourceRfqQuoteItemId";
    SELECT "sellerId" INTO quote_seller_id FROM "RFQQuote" WHERE "id" = quote_line."quoteId";
    IF quote_line."quoteId" IS DISTINCT FROM po_quote_id
      OR quote_seller_id IS DISTINCT FROM NEW."sellerId"
      OR quote_line."productId" IS DISTINCT FROM NEW."productId"
      OR quote_line."variantId" IS DISTINCT FROM NEW."variantId"
      OR quote_line."sku" IS DISTINCT FROM NEW."sku"
      OR quote_line."nameEn" IS DISTINCT FROM NEW."nameEn"
      OR quote_line."quantity" IS DISTINCT FROM NEW."quantity"
      OR quote_line."unitPrice" IS DISTINCT FROM NEW."unitPrice"
      OR quote_line."vatRate" IS DISTINCT FROM NEW."vatRate"
      OR quote_line."lineSubtotal" IS DISTINCT FROM NEW."lineSubtotal"
    THEN
      RAISE EXCEPTION 'purchase order line must exactly snapshot its quote item';
    END IF;
  ELSIF (TG_OP = 'DELETE' AND OLD."sourceRfqQuoteItemId" IS NOT NULL)
    OR (TG_OP <> 'DELETE' AND NEW."sourceRfqQuoteItemId" IS NOT NULL)
  THEN
    RAISE EXCEPTION 'quote item provenance requires a quote-sourced purchase order';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PurchaseOrderItem_quote_source_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "PurchaseOrderItem"
  FOR EACH ROW EXECUTE FUNCTION "guard_quote_sourced_purchase_order_item"();
