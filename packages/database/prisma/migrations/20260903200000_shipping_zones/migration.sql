-- Delivery priced by zone and weight, the way a carrier prices it.
--
-- Purely additive: two new tables, their indexes and one foreign key. Nothing
-- existing is altered or dropped, so this migration cannot damage catalogue,
-- order or pricing data, and it is safe to run against a live database.
--
-- Written by hand rather than taken from `migrate diff`, because the generated
-- script also carried unrelated pre-existing drift (an ApprovalPolicy default).
-- A migration should contain exactly the change it is named for; folding
-- somebody else's drift into it makes both impossible to review or revert.

-- CreateTable
CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "countries" TEXT[],
    "fallbackPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "freeOverSubtotal" DECIMAL(12,2),
    "etaMinDays" INTEGER,
    "etaMaxDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "minWeightKg" DECIMAL(10,3) NOT NULL,
    "maxWeightKg" DECIMAL(10,3),
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingZone_code_key" ON "ShippingZone"("code");

-- CreateIndex
CREATE INDEX "ShippingZone_isActive_sortOrder_idx" ON "ShippingZone"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ShippingRate_zoneId_currency_isActive_minWeightKg_idx" ON "ShippingRate"("zoneId", "currency", "isActive", "minWeightKg");

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
