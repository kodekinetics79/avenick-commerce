-- Pre-digest deployments stored the canonical payload itself. Remove that PII;
-- legacy keyed retries fail closed and can be resubmitted with a new key.
UPDATE "Order" SET "requestFingerprint" = NULL
WHERE "requestFingerprint" IS NOT NULL AND length("requestFingerprint") <> 64;
ALTER TABLE "Order" ALTER COLUMN "requestFingerprint" TYPE VARCHAR(64);
