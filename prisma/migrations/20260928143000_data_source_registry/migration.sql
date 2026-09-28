CREATE TYPE "DataSourceKind" AS ENUM ('SYSTEM', 'MANAGED');
CREATE TYPE "DataSourceConnectionStatus" AS ENUM ('CONNECTED', 'FAILED');

CREATE TABLE "DataSource" (
    "id" UUID NOT NULL,
    "kind" "DataSourceKind" NOT NULL DEFAULT 'MANAGED',
    "ownerUserId" UUID,
    "name" VARCHAR(160) NOT NULL,
    "baseUrl" VARCHAR(2048) NOT NULL,
    "keyCiphertext" TEXT,
    "keyNonce" VARCHAR(64),
    "keyAuthTag" VARCHAR(64),
    "keyPreview" VARCHAR(4),
    "connectionStatus" "DataSourceConnectionStatus" NOT NULL,
    "lastCheckedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DataSource_managed_owner_and_secret_check" CHECK (
        ("kind" = 'SYSTEM' AND "ownerUserId" IS NULL AND "keyCiphertext" IS NULL AND "keyNonce" IS NULL AND "keyAuthTag" IS NULL AND "keyPreview" IS NULL)
        OR
        ("kind" = 'MANAGED' AND "ownerUserId" IS NOT NULL AND "keyCiphertext" IS NOT NULL AND "keyNonce" IS NOT NULL AND "keyAuthTag" IS NOT NULL AND "keyPreview" IS NOT NULL)
    )
);

CREATE TABLE "DataSourceGrant" (
    "dataSourceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataSourceGrant_pkey" PRIMARY KEY ("dataSourceId", "userId")
);

INSERT INTO "DataSource" (
    "id", "kind", "name", "baseUrl", "connectionStatus", "lastCheckedAt", "updatedAt"
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'SYSTEM',
    'System Weather Source',
    'runtime://weather',
    'CONNECTED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

ALTER TABLE "Station" ADD COLUMN "dataSourceId" UUID;
UPDATE "Station"
SET "dataSourceId" = '00000000-0000-0000-0000-000000000001'
WHERE "dataSourceId" IS NULL;
ALTER TABLE "Station" ALTER COLUMN "dataSourceId" SET NOT NULL;

DROP INDEX "Station_upstreamCode_key";
CREATE UNIQUE INDEX "Station_dataSourceId_upstreamCode_key"
    ON "Station"("dataSourceId", "upstreamCode");
CREATE INDEX "Station_dataSourceId_idx" ON "Station"("dataSourceId");
CREATE INDEX "DataSource_ownerUserId_createdAt_id_idx"
    ON "DataSource"("ownerUserId", "createdAt", "id");
CREATE INDEX "DataSource_connectionStatus_updatedAt_idx"
    ON "DataSource"("connectionStatus", "updatedAt");
CREATE INDEX "DataSourceGrant_userId_createdAt_idx"
    ON "DataSourceGrant"("userId", "createdAt");

ALTER TABLE "DataSource"
    ADD CONSTRAINT "DataSource_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataSourceGrant"
    ADD CONSTRAINT "DataSourceGrant_dataSourceId_fkey"
    FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataSourceGrant"
    ADD CONSTRAINT "DataSourceGrant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Station"
    ADD CONSTRAINT "Station_dataSourceId_fkey"
    FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
