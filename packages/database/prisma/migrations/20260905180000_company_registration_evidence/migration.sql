-- A company registration that can carry its own evidence.
--
-- Today a Company holds a name, a CR number, a VAT number, an industry, a size,
-- a country and a city. It cannot record when its commercial registration
-- expires, cannot hold a Saudi national address, cannot store the scan of the
-- certificate a reviewer is meant to read, and cannot say who verified it or
-- why it was refused. This migration adds exactly those things.
--
-- ADDITIVE except for two constraint changes, both named below and both checked
-- against the live table first: there are 2 companies, each with a distinct
-- (country, crNumber) and a distinct vatNumber, so neither change can collide.
--
-- Written by hand rather than taken from `migrate diff`, following the
-- convention set by 20260903200000_shipping_zones: a migration should contain
-- exactly the change it is named for.

-- ─── CR and VAT identity ──────────────────────────────────────────────────
--
-- crExpiresOn is the ONE canonical instant. Everything that queries, indexes or
-- sweeps for expiry reads this column and nothing else.
--
-- The other two exist because a GCC certificate states its expiry in the Hijri
-- calendar, and the reference implementation this was modelled on captured
-- Hijri AND Gregorian as two independent fields. They drift the moment anything
-- writes one without the other, and once they disagree nothing in the system
-- can adjudicate which date the ministry actually issued. So: one canonical
-- Gregorian instant, plus the verbatim string the applicant typed and which
-- calendar they read it in. Those two are display and audit only and are never
-- re-parsed — a reviewer holding the paper certificate can compare what the
-- applicant saw with what we stored.
ALTER TABLE "Company"
  ADD COLUMN "unifiedNumber"      TEXT,
  ADD COLUMN "legalForm"          TEXT,
  ADD COLUMN "crIssuedOn"         TIMESTAMP(3),
  ADD COLUMN "crExpiresOn"        TIMESTAMP(3),
  ADD COLUMN "crExpiryCalendar"   TEXT,
  ADD COLUMN "crExpiryAsEntered"  TEXT,
  -- Deliberately NO vatExpiresOn: a GCC VAT registration does not expire.
  ADD COLUMN "vatEffectiveFrom"   TIMESTAMP(3);

-- ─── Review trail ─────────────────────────────────────────────────────────
--
-- submittedAt distinguishes "started an application" from "waiting for a
-- reviewer". verifiedAt and verifiedById make the decision readable without
-- scanning AuditLog for entityType='Company'. reviewNotes is why it was refused
-- — setCompanyStatus already accepts a reason and writes it only into the audit
-- payload, where the applicant can never be shown it.
ALTER TABLE "Company"
  ADD COLUMN "submittedAt"  TIMESTAMP(3),
  ADD COLUMN "verifiedAt"   TIMESTAMP(3),
  ADD COLUMN "verifiedById" TEXT,
  ADD COLUMN "reviewNotes"  TEXT;

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Company_status_submittedAt_idx" ON "Company"("status", "submittedAt");
CREATE INDEX "Company_crExpiresOn_idx" ON "Company"("crExpiresOn");

-- ─── A refusal is not a suspension ────────────────────────────────────────
--
-- Three statuses today mean a rejected application is indistinguishable from a
-- suspended trading company, so the only way to refuse an applicant is to
-- suspend them — which reads to that applicant as punishment for something they
-- were never granted.
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'INFO_REQUESTED';

-- ─── A CR is unique within its issuing jurisdiction, not globally ─────────
--
-- A Bahraini "12345-1" and an Omani "1234567" are unrelated namespaces. A
-- global unique constraint means the first company to claim a short numeric CR
-- locks that string out of all six markets.
ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_crNumber_key";
DROP INDEX IF EXISTS "Company_crNumber_key";
CREATE UNIQUE INDEX "Company_country_crNumber_key" ON "Company"("country", "crNumber");

ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_vatNumber_key";
DROP INDEX IF EXISTS "Company_vatNumber_key";
CREATE UNIQUE INDEX "Company_country_vatNumber_key" ON "Company"("country", "vatNumber");

-- ─── The address a registry actually holds ────────────────────────────────
--
-- Only Saudi Arabia publishes a structured National Address, and its components
-- are not optional there: a shipment without buildingNumber and additionalNumber
-- fails SPL validation. The columns are nullable because the other five markets
-- do not have them, not because they are decorative.
--
-- The Arabic columns are DATA, not translation. GCC e-invoicing wants the
-- Arabic address as filed; it is not a rendering of the English line.
ALTER TABLE "Address"
  ADD COLUMN "district"         TEXT,
  ADD COLUMN "buildingNumber"   TEXT,
  ADD COLUMN "additionalNumber" TEXT,
  ADD COLUMN "shortAddress"     TEXT,
  ADD COLUMN "line1Ar"          TEXT,
  ADD COLUMN "districtAr"       TEXT,
  ADD COLUMN "cityAr"           TEXT;

-- buildingNumber and additionalNumber are TEXT and never INTEGER: they are
-- exactly four digits and a leading zero is significant.

-- ─── The evidence itself ──────────────────────────────────────────────────
--
-- A company literally cannot store a CR scan today. SellerDocument is hard-keyed
-- to sellerId, so this mirrors it rather than bending it — the same DocumentType
-- and DocumentStatus enums, which already carry COMMERCIAL_REGISTRATION,
-- VAT_CERTIFICATE and TRADE_LICENSE.
--
-- reviewedById is a real foreign key. SellerDocument.reviewedBy is a bare string
-- with no relation, which is the one part of that model not worth copying.
CREATE TABLE "CompanyDocument" (
    "id"              TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    "type"            "DocumentType" NOT NULL,
    "fileUrl"         TEXT NOT NULL,
    "fileName"        TEXT NOT NULL,
    "fileSize"        INTEGER NOT NULL,
    "mimeType"        TEXT NOT NULL,
    "status"          "DocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "expiresOn"       TIMESTAMP(3),
    "expiryCalendar"  TEXT,
    "expiryAsEntered" TEXT,
    "rejectionReason" TEXT,
    "uploadedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt"      TIMESTAMP(3),
    "reviewedById"    TEXT,

    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyDocument_companyId_type_idx" ON "CompanyDocument"("companyId", "type");
CREATE INDEX "CompanyDocument_status_uploadedAt_idx" ON "CompanyDocument"("status", "uploadedAt");

ALTER TABLE "CompanyDocument"
  ADD CONSTRAINT "CompanyDocument_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyDocument"
  ADD CONSTRAINT "CompanyDocument_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Audit ────────────────────────────────────────────────────────────────
--
-- AuditLog has actorId and sellerId but nothing for a company, so a company's
-- verification history is findable only by scanning on entityType.
ALTER TABLE "AuditLog" ADD COLUMN "companyId" TEXT;
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
