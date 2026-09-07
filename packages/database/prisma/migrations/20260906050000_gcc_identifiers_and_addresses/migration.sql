-- GCC identifiers, national address fields, and the company review states.
--
-- This migration was missing: the schema carried every change below and no
-- migration created any of it, so `prisma migrate deploy` produced a database
-- the client could not query. The b2b-iam-audit integration test is what
-- surfaced it — "The column Company.unifiedNumber does not exist".
--
-- THE TWO DROPPED INDEXES ARE THE POINT, not collateral. A commercial
-- registration number is issued by ONE national registry and is unique inside
-- it; the global unique claimed it was unique across all six markets, which
-- would reject a genuine Saudi applicant whose CR string collided with an
-- Emirati company's. The composite uniques below replace them. Dropping a
-- stricter constraint for a looser one cannot fail on existing rows.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CompanyStatus" ADD VALUE 'REJECTED';
ALTER TYPE "CompanyStatus" ADD VALUE 'INFO_REQUESTED';

-- DropIndex
DROP INDEX "Company_crNumber_key";

-- DropIndex
DROP INDEX "Company_vatNumber_key";

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "additionalNumber" TEXT,
ADD COLUMN     "buildingNumber" TEXT,
ADD COLUMN     "cityAr" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "districtAr" TEXT,
ADD COLUMN     "line1Ar" TEXT,
ADD COLUMN     "shortAddress" TEXT;

-- AlterTable
ALTER TABLE "ApprovalPolicy" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "crExpiresOn" TIMESTAMP(3),
ADD COLUMN     "crExpiryAsEntered" TEXT,
ADD COLUMN     "crExpiryCalendar" TEXT,
ADD COLUMN     "crIssuedOn" TIMESTAMP(3),
ADD COLUMN     "legalForm" TEXT,
ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "unifiedNumber" TEXT,
ADD COLUMN     "vatEffectiveFrom" TIMESTAMP(3),
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- CreateTable
CREATE TABLE "CompanyDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "expiresOn" TIMESTAMP(3),
    "expiryCalendar" TEXT,
    "expiryAsEntered" TEXT,
    "rejectionReason" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyDocument_companyId_type_idx" ON "CompanyDocument"("companyId", "type");

-- CreateIndex
CREATE INDEX "CompanyDocument_status_uploadedAt_idx" ON "CompanyDocument"("status", "uploadedAt");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Company_status_submittedAt_idx" ON "Company"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Company_crExpiresOn_idx" ON "Company"("crExpiresOn");

-- CreateIndex
CREATE UNIQUE INDEX "Company_country_crNumber_key" ON "Company"("country", "crNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Company_country_vatNumber_key" ON "Company"("country", "vatNumber");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CommercialPriceSnapshot_tenantKey_productId_companyId_currency_" RENAME TO "CommercialPriceSnapshot_tenantKey_productId_companyId_curre_idx";

-- RenameIndex
ALTER INDEX "IntegrationCompanyRoute_tenantKey_companyId_connectionId_purpos" RENAME TO "IntegrationCompanyRoute_tenantKey_companyId_connectionId_pu_key";

