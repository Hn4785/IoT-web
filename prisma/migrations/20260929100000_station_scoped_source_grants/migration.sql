CREATE TABLE "DataSourceGrantStation" (
    "dataSourceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "stationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSourceGrantStation_pkey" PRIMARY KEY ("dataSourceId", "userId", "stationId")
);

CREATE INDEX "DataSourceGrantStation_stationId_userId_idx"
ON "DataSourceGrantStation"("stationId", "userId");

ALTER TABLE "DataSourceGrantStation"
ADD CONSTRAINT "DataSourceGrantStation_dataSourceId_userId_fkey"
FOREIGN KEY ("dataSourceId", "userId")
REFERENCES "DataSourceGrant"("dataSourceId", "userId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DataSourceGrantStation"
ADD CONSTRAINT "DataSourceGrantStation_stationId_fkey"
FOREIGN KEY ("stationId") REFERENCES "Station"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the effective scope of grants created before station-level sharing.
INSERT INTO "DataSourceGrantStation" ("dataSourceId", "userId", "stationId")
SELECT grant_row."dataSourceId", grant_row."userId", station."id"
FROM "DataSourceGrant" AS grant_row
JOIN "Station" AS station
  ON station."dataSourceId" = grant_row."dataSourceId";
