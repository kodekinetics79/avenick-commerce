-- CreateTable
CREATE TABLE "RequisitionList" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequisitionList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "productId" TEXT,
    "sku" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisitionListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequisitionList_companyId_idx" ON "RequisitionList"("companyId");

-- CreateIndex
CREATE INDEX "RequisitionListItem_listId_idx" ON "RequisitionListItem"("listId");

-- AddForeignKey
ALTER TABLE "RequisitionList" ADD CONSTRAINT "RequisitionList_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionListItem" ADD CONSTRAINT "RequisitionListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "RequisitionList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionListItem" ADD CONSTRAINT "RequisitionListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
