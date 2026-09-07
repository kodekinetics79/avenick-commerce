-- A colleague of an existing member can apply to join their company.
--
-- Until now a second person at a company that is already registered had exactly
-- one route in: their admin typed their address into the team page. If nobody
-- did that, the CR check refused them ("A company is already registered with
-- that commercial registration number") and the journey ended there.
--
-- This migration adds the two things that route needed and did not have:
--
--   Company.emailDomains  — the domains a company is recognised at, so that
--                           "does this person actually work there?" has an
--                           answer before a human is asked to look.
--   CompanyJoinRequest    — the application itself, which is NOT a membership.
--                           A membership row is authority (getB2BContext reads
--                           it to decide whose prices a user sees); this row is
--                           a request, and it grants nothing until a company
--                           admin promotes it.
--
-- ADDITIVE. No column is dropped, no constraint is narrowed, and the backfill
-- below only ever writes to a column added in this same file.

-- ─── The domains a company is recognised at ───────────────────────────────
--
-- text[] rather than a CompanyDomain table: the only question ever asked of it
-- is "is this address's domain in the list", the list is short, and a join
-- table would buy a uniqueness constraint the flow does not rely on — an
-- application is looked up by CR first and the domain is checked against THAT
-- company, never used to find one.
--
-- NOT NULL DEFAULT '{}': an empty list means "no self-service joining", which
-- is the correct and safe reading for every company that predates this column.
ALTER TABLE "Company"
  ADD COLUMN "emailDomains" TEXT[] NOT NULL DEFAULT '{}';

-- ─── Backfill: recognise each company at its founding admin's own domain ───
--
-- Without this, every company that already exists starts with an empty list and
-- the feature is dark for all of them until someone edits a row by hand.
--
-- Two conditions, both load-bearing:
--
--   1. COMPANY_ADMIN members only. A buyer invited from a personal address must
--      not be able to teach the company a domain.
--   2. NOT a public mailbox provider. A company whose admin registered with a
--      gmail.com address must never come to claim gmail.com — that would let
--      any Gmail user on earth apply to join it, which is precisely the hole
--      this whole feature exists to close. Such companies keep an empty list
--      and stay invite-only, which is the right answer, not a gap.
--
-- The list is duplicated in isPublicMailboxDomain() in packages/utils; that is
-- deliberate. SQL running once at migration time cannot import TypeScript, and
-- the alternative — leaving the backfill out — is worse than two copies of a
-- list that changes about once a decade.
UPDATE "Company" c
SET "emailDomains" = ARRAY[sub.domain]
FROM (
  SELECT DISTINCT ON (m."companyId")
         m."companyId",
         lower(split_part(u."email", '@', 2)) AS domain
  FROM "CompanyMember" m
  JOIN "User" u ON u."id" = m."userId"
  WHERE m."role" = 'COMPANY_ADMIN'
    AND m."isActive" = true
    AND position('@' in u."email") > 0
  ORDER BY m."companyId", m."joinedAt" ASC
) sub
WHERE c."id" = sub."companyId"
  AND sub.domain <> ''
  AND sub.domain NOT IN (
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com',
    'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
    'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com',
    'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'yandex.com', 'yandex.ru',
    'qq.com', '163.com', '126.com', 'naver.com', 'hushmail.com',
    'mailinator.com', 'yopmail.com', 'guerrillamail.com', '10minutemail.com',
    'tempmail.com', 'temp-mail.org', 'trashmail.com', 'sharklasers.com',
    'dispostable.com', 'getnada.com', 'maildrop.cc', 'fakeinbox.com'
  );

-- ─── The application ──────────────────────────────────────────────────────
CREATE TYPE "CompanyJoinRequestStatus" AS ENUM (
  'PENDING_EMAIL_VERIFICATION',
  'PENDING_ADMIN_APPROVAL',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "CompanyJoinRequest" (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "status"          "CompanyJoinRequestStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
  "requestedRole"   "UserRole" NOT NULL DEFAULT 'COMPANY_BUYER',
  "department"      TEXT,
  "emailDomain"     TEXT NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3),
  "decidedById"     TEXT,
  "decidedAt"       TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyJoinRequest_pkey" PRIMARY KEY ("id")
);

-- One live application per person, mirroring CompanyMember.userId: a user
-- belongs to at most one company, so they can be applying to at most one.
CREATE UNIQUE INDEX "CompanyJoinRequest_userId_key"
  ON "CompanyJoinRequest" ("userId");

-- The company admin's queue: "everything awaiting my decision", newest first.
CREATE INDEX "CompanyJoinRequest_companyId_status_createdAt_idx"
  ON "CompanyJoinRequest" ("companyId", "status", "createdAt");

ALTER TABLE "CompanyJoinRequest"
  ADD CONSTRAINT "CompanyJoinRequest_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyJoinRequest"
  ADD CONSTRAINT "CompanyJoinRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
