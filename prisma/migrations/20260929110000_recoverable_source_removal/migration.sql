ALTER TYPE "AlertResolutionReason" ADD VALUE 'SOURCE_REMOVED';

ALTER TABLE "DataSource" ADD COLUMN "removedAt" TIMESTAMPTZ(3);

ALTER TABLE "DataSource" DROP CONSTRAINT "DataSource_managed_owner_and_secret_check";
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_managed_owner_and_secret_check" CHECK (
    ("kind" = 'SYSTEM' AND "ownerUserId" IS NULL AND "removedAt" IS NULL
      AND "keyCiphertext" IS NULL AND "keyNonce" IS NULL AND "keyAuthTag" IS NULL AND "keyPreview" IS NULL)
    OR
    ("kind" = 'MANAGED' AND "ownerUserId" IS NOT NULL AND (
      ("removedAt" IS NULL AND "keyCiphertext" IS NOT NULL AND "keyNonce" IS NOT NULL
        AND "keyAuthTag" IS NOT NULL AND "keyPreview" IS NOT NULL)
      OR
      ("removedAt" IS NOT NULL AND "keyCiphertext" IS NULL AND "keyNonce" IS NULL
        AND "keyAuthTag" IS NULL AND "keyPreview" IS NULL)
    ))
);

CREATE INDEX "DataSource_removedAt_createdAt_id_idx"
ON "DataSource"("removedAt", "createdAt", "id");
