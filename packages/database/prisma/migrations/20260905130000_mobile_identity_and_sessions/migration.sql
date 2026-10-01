-- Identity a native client can actually use: rotating refresh tokens, phone
-- OTP, and push device tokens.
--
-- The web apps authenticate with a NextAuth cookie session. A Flutter client
-- cannot participate in that — it has no cookie jar shared with a browser, it
-- backgrounds for days, and it must be able to sign one device out without
-- signing the account out everywhere. Nothing in this schema stored a refresh
-- token, an OTP challenge or a push token before this migration, so the mobile
-- contract in packages/contracts/src/auth.ts describes endpoints that have no
-- storage to sit on. This migration is that storage and nothing else.
--
-- Purely additive: three new enums, three new tables, their indexes and three
-- foreign keys. No existing table, column, constraint, default or row is
-- altered, dropped or backfilled, so this migration cannot damage identity,
-- catalogue, order or pricing data and is safe to apply to a live database.
-- Applying it changes nothing that is running: the three tables start empty,
-- and no code path reads them yet.
--
-- Written by hand rather than taken from `migrate diff`, for the reason the
-- shipping-zones migration gives in its own header: the generated script also
-- carries unrelated pre-existing drift (an ApprovalPolicy default), and a
-- migration should contain exactly the change it is named for. That drift is
-- deliberately NOT touched here.

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('SIGN_IN', 'VERIFY_PHONE');

-- CreateEnum
-- Why a stored reason at all: "this token no longer works" and "this token was
-- replayed after it had already been rotated" are the same row to a nullable
-- revokedAt, and only the second one means the account is under attack.
CREATE TYPE "RefreshTokenRevokedReason" AS ENUM ('ROTATED', 'REUSE_DETECTED', 'SIGNED_OUT', 'ALL_SESSIONS_REVOKED', 'PASSWORD_RESET', 'ADMIN_REVOKED', 'USER_DEACTIVATED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateTable
-- One issued refresh token. Rotation means a row is used at most once: redeeming
-- it mints a successor, stamps this row revoked with reason ROTATED, and points
-- replacedById at the successor. A presented token that is ALREADY revoked is
-- therefore a replay, and the whole familyId is revoked in response.
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    -- SHA-256 hex of the opaque token, never the token. A fast digest is the
    -- CORRECT choice here and the wrong one for the OTP below: this input is
    -- 256 bits of randomness, so there is no search space to exhaust, and the
    -- refresh path needs an indexed exact-match lookup on every call.
    "tokenHash" VARCHAR(64) NOT NULL,
    -- Rotation lineage. Every successor inherits its predecessor's familyId, so
    -- detecting one replayed token revokes every token descended from the same
    -- original sign-in with a single indexed UPDATE.
    "familyId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" "RefreshTokenRevokedReason",
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- A phone OTP challenge. Phone-first identity is what a GCC consumer app leads
-- with, and User.phone is already @unique with User.phoneVerified alongside it,
-- so neither is duplicated here.
--
-- DELIBERATELY NO userId. The challenge is keyed by the phone number as typed,
-- whether or not it belongs to an account. Resolving a user at request time and
-- storing the result would make this table an account-enumeration oracle: the
-- endpoint must answer identically for a registered and an unregistered number,
-- and it cannot do that while its own storage records which one it was.
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    -- The code under a KEYED or DELIBERATELY SLOW hash — an HMAC-SHA-256 with a
    -- server-side secret, or bcrypt — never a bare digest. A six-digit code has
    -- a search space of one million, so a plain SHA-256 stored here is
    -- recoverable by exhaustion in milliseconds by anyone who can read this
    -- table, which defeats the point of not storing the code. The column is
    -- TEXT rather than VARCHAR(64) precisely so the algorithm can change
    -- without a migration; bcrypt is 60 characters, an HMAC hex digest is 64.
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    -- Verification attempts against THIS challenge. The cap is what stops a
    -- million-guess walk of a six-digit code; the per-phone and per-IP indexes
    -- below stop the attacker simply requesting a fresh challenge each guess.
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    -- Binds the challenge to the installation that asked for it: the mobile
    -- contract sends deviceId on both the request and the verify, so a
    -- challenge issued to one device cannot be redeemed from another.
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- One push registration for one installation.
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    -- The device's own BCP-47 tag, e.g. "ar-AE". Not the Language enum: this is
    -- the OS locale a notification must be composed in, and it is frequently
    -- neither AR nor EN. The account's Language stays the fallback.
    "locale" TEXT,
    "appVersion" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The hot path. Every refresh presents a token, which is hashed and looked up
-- here exactly once. Unique because two rows sharing a hash would make "which
-- session is this" unanswerable, and it is the constraint that makes a
-- concurrent double-redeem of the same token collide instead of both winning.
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
-- One successor per predecessor, enforced rather than assumed: a fork in the
-- lineage would mean one token was rotated twice, which is the replay this
-- table exists to detect.
CREATE UNIQUE INDEX "RefreshToken_replacedById_key" ON "RefreshToken"("replacedById");

-- CreateIndex
-- "Sign out of all devices", and the device list a user is shown. revokedAt
-- trails because the predicate is "still live" on a userId that is already
-- highly selective.
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- CreateIndex
-- Reuse detection's response: revoke the entire lineage in one UPDATE.
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
-- The pruning sweep. Without it, deleting expired tokens seq-scans a table that
-- grows with every refresh of every installation.
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
-- Rate limiting per PHONE: how many challenges has this number been sent in the
-- last window. createdAt trails so the window is a range scan inside one phone.
CREATE INDEX "OtpChallenge_phone_createdAt_idx" ON "OtpChallenge"("phone", "createdAt");

-- CreateIndex
-- Rate limiting per IP, which is the separate question: one address walking
-- many numbers never trips a per-phone limit. Both limits are needed, so both
-- indexes are.
CREATE INDEX "OtpChallenge_ipAddress_createdAt_idx" ON "OtpChallenge"("ipAddress", "createdAt");

-- CreateIndex
-- The pruning sweep. Consumed and expired challenges have no value and every
-- retained one is a hash of a live-ish credential.
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");

-- CreateIndex
-- A push token identifies a device, not a person: reinstalling or switching
-- accounts hands the same token to a different user. Unique on the token so
-- registering it again MOVES it rather than creating a second row that would
-- deliver one notification twice, or deliver it to the previous account.
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
-- The fan-out: every live push target for one user.
CREATE INDEX "DeviceToken_userId_revokedAt_idx" ON "DeviceToken"("userId", "revokedAt");

-- AddForeignKey
-- CASCADE so an erased user (services/data-rights.ts) cannot leave a token
-- behind that still authenticates as them.
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL, not CASCADE: pruning an expired successor must not delete the
-- ancestor rows that record the lineage, and a dangling id would make reuse
-- detection read a fork that is not there.
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
