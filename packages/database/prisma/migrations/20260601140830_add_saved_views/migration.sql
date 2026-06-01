-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedView_sellerId_entity_idx" ON "SavedView"("sellerId", "entity");

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
