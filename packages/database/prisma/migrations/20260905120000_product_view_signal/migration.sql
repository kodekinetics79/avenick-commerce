-- The view signal that makes "Trending" a measurement instead of a claim.
--
-- One row per product per UTC day, holding a de-duplicated view count. Nothing
-- in this schema recorded attention before this migration, so every rail that
-- called itself trending would have been ranking on something else.
--
-- Purely additive: one new table, its two indexes and one foreign key. No
-- existing table, column, constraint or row is altered, dropped or backfilled,
-- so this migration cannot damage catalogue, order or pricing data and is safe
-- to apply to a live database. Applying it changes nothing that is running:
-- the table starts empty, and an empty signal means an empty Trending rail.
--
-- Written by hand rather than taken from `migrate diff`, for the reason the
-- shipping-zones migration gives: the generated script also carries unrelated
-- pre-existing drift, and a migration should contain exactly the change it is
-- named for.

-- CreateTable
CREATE TABLE "ProductViewSignal" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bucketDate" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductViewSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The write path's upsert target. Two concurrent views of the same product on
-- the same day must collide on this constraint and increment one row, rather
-- than insert two buckets that every reader would then have to know to add up.
CREATE UNIQUE INDEX "ProductViewSignal_productId_bucketDate_key" ON "ProductViewSignal"("productId", "bucketDate");

-- CreateIndex
-- The read path: "every bucket from the window start onward". bucketDate leads
-- because the window is the filter; the unique index above starts with
-- productId and therefore cannot serve a range scan on the date.
CREATE INDEX "ProductViewSignal_bucketDate_productId_idx" ON "ProductViewSignal"("bucketDate", "productId");

-- AddForeignKey
-- CASCADE so a hard-deleted product cannot leave orphaned signal behind it.
-- Products are normally soft-deleted (Product.deletedAt), and the read path
-- filters on the public catalogue predicate, so a withdrawn product drops out
-- of Trending without needing its history removed.
ALTER TABLE "ProductViewSignal" ADD CONSTRAINT "ProductViewSignal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
