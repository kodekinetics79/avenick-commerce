-- Close the last three differences between the migration history and schema.prisma.
--
-- WHY THIS EXISTS RATHER THAN A REWRITE OF 20260905180000.
--
-- Two branches independently wrote a migration for the same schema change: the
-- hand-written 20260905180000_company_registration_evidence, and a generated
-- 20260906050000_gcc_identifiers_and_addresses. They cannot both run — the
-- generated one has no idempotency guards, so after the hand-written one it hits
-- ALTER TYPE ADD VALUE on an existing label and CREATE TABLE on an existing
-- table.
--
-- Measured on a scratch database, the hand-written one left three differences
-- from schema.prisma and the generated one left none, so the generated one
-- looked like the keeper. THAT WAS THE WRONG READING, and only checking the
-- live database settled it: production has already applied 20260905180000 and
-- has never seen 20260906050000. Deleting the migration production has run
-- would make `prisma migrate deploy` refuse to start there ("migration recorded
-- in the database but missing from the migrations directory"), and running the
-- generated one on top of it would fail on its first statement.
--
-- So the applied migration stays, the never-applied one is deleted, and this
-- closes the three differences it left. Production applies only this and the
-- join-requests migration; a database built from scratch applies all of them and
-- arrives at the same place. `prisma migrate diff` reports no drift either way.
--
-- Each statement below was checked against the live schema before it was
-- written, and each is safe to re-run.

-- ─── 1. ApprovalPolicy.updatedAt carries a DEFAULT it should not ──────────
--
-- The column is `@updatedAt` in schema.prisma, which Prisma maintains from the
-- client on every write and declares with no database default. Production has
-- DEFAULT CURRENT_TIMESTAMP on it, left by an earlier migration.
--
-- Dropping a default that is not there is a no-op in PostgreSQL, so this needs
-- no guard. It also cannot lose data: the column is NOT NULL and every existing
-- row already holds a value.
ALTER TABLE "ApprovalPolicy" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ─── 2 & 3. Two indexes carry PostgreSQL's 63-byte truncation of an older,
--            longer name than the one Prisma now generates ─────────────────
--
-- An identifier longer than 63 bytes is silently truncated by PostgreSQL, and
-- Prisma later shortened how it derives these names — so the database holds
-- `..._currency_` and `..._purpos` where the schema now asks for `..._curre_idx`
-- and `..._pu_key`. Nothing functional depends on the name; leaving them means
-- `migrate diff` reports drift forever and the next `migrate dev` writes a
-- spurious migration for it.
--
-- Guarded rather than bare: a database built from scratch by the migration set
-- reaches this point with the old names, but one that has been repaired by hand
-- may already carry the new ones, and a bare ALTER INDEX would fail there. The
-- rename is skipped when the target already exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'CommercialPriceSnapshot_tenantKey_productId_companyId_currency_')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'CommercialPriceSnapshot_tenantKey_productId_companyId_curre_idx')
  THEN
    ALTER INDEX "CommercialPriceSnapshot_tenantKey_productId_companyId_currency_"
      RENAME TO "CommercialPriceSnapshot_tenantKey_productId_companyId_curre_idx";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IntegrationCompanyRoute_tenantKey_companyId_connectionId_purpos')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IntegrationCompanyRoute_tenantKey_companyId_connectionId_pu_key')
  THEN
    ALTER INDEX "IntegrationCompanyRoute_tenantKey_companyId_connectionId_purpos"
      RENAME TO "IntegrationCompanyRoute_tenantKey_companyId_connectionId_pu_key";
  END IF;
END $$;
