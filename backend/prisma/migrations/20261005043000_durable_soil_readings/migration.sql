-- Additive storage only; no changes to existing rows or privileges.
CREATE UNIQUE INDEX "Station_id_dataSourceId_key" ON "Station"("id", "dataSourceId");

CREATE TABLE "SoilReading" (
  "dataSourceId" UUID NOT NULL,
  "stationId" UUID NOT NULL,
  "field" VARCHAR(16) NOT NULL CHECK ("field" IN ('temperature','moisture','ec','ph','nitrogen','phosphorus','potassium','light')),
  "observedAt" TIMESTAMPTZ(3) NOT NULL,
  "value" DOUBLE PRECISION NOT NULL CHECK ("value" > '-Infinity'::float8 AND "value" < 'Infinity'::float8),
  "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
  "origin" VARCHAR(16) NOT NULL CHECK ("origin" IN ('latest','rawHistory')),
  "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
  PRIMARY KEY ("dataSourceId", "stationId", "field", "observedAt"),
  FOREIGN KEY ("stationId", "dataSourceId") REFERENCES "Station"("id", "dataSourceId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SoilReading_observedAt_idx" ON "SoilReading"("observedAt");

CREATE TABLE "SoilLatestReading" (
  "dataSourceId" UUID NOT NULL,
  "stationId" UUID NOT NULL,
  "field" VARCHAR(16) NOT NULL CHECK ("field" IN ('temperature','moisture','ec','ph','nitrogen','phosphorus','potassium','light')),
  "observedAt" TIMESTAMPTZ(3) NOT NULL,
  "value" DOUBLE PRECISION NOT NULL CHECK ("value" > '-Infinity'::float8 AND "value" < 'Infinity'::float8),
  "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
  "origin" VARCHAR(16) NOT NULL CHECK ("origin" IN ('latest','rawHistory')),
  "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
  PRIMARY KEY ("dataSourceId", "stationId", "field"),
  FOREIGN KEY ("stationId", "dataSourceId") REFERENCES "Station"("id", "dataSourceId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SoilHistoryCoverage" (
  "dataSourceId" UUID NOT NULL,
  "stationId" UUID NOT NULL,
  "field" VARCHAR(16) NOT NULL CHECK ("field" IN ('temperature','moisture','ec','ph','nitrogen','phosphorus','potassium','light')),
  "begin" TIMESTAMPTZ(3) NOT NULL,
  "end" TIMESTAMPTZ(3) NOT NULL,
  "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("dataSourceId", "stationId", "field", "begin"),
  CHECK ("begin" <= "end"),
  FOREIGN KEY ("stationId", "dataSourceId") REFERENCES "Station"("id", "dataSourceId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SoilHistoryCoverage_end_idx" ON "SoilHistoryCoverage"("end");

CREATE TABLE "SoilCollectionCheckpoint" (
  "dataSourceId" UUID NOT NULL,
  "stationId" UUID PRIMARY KEY,
  "historyThrough" TIMESTAMPTZ(3),
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "failureCount" INTEGER NOT NULL DEFAULT 0 CHECK ("failureCount" >= 0),
  "lastResult" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "lastSuccessAt" TIMESTAMPTZ(3),
  FOREIGN KEY ("stationId", "dataSourceId") REFERENCES "Station"("id", "dataSourceId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SoilCollectionCheckpoint_nextAttemptAt_stationId_idx" ON "SoilCollectionCheckpoint"("nextAttemptAt", "stationId");
CREATE UNIQUE INDEX "SoilCollectionCheckpoint_stationId_dataSourceId_key" ON "SoilCollectionCheckpoint"("stationId", "dataSourceId");
