-- AlterTable
ALTER TABLE "MessageThread" ADD COLUMN     "firstResponseAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "promisedBy" TIMESTAMP(3);
