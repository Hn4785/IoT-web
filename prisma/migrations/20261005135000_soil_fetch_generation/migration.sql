-- Owner-approved local F-data amendment. Preserve all recorded capture times.
BEGIN;

ALTER TABLE "SoilReading" ADD COLUMN "lastFetchedAt" TIMESTAMPTZ(3);
ALTER TABLE "SoilLatestReading" ADD COLUMN "lastFetchedAt" TIMESTAMPTZ(3);

UPDATE "SoilReading" SET "lastFetchedAt" = "fetchedAt";
UPDATE "SoilLatestReading" SET "lastFetchedAt" = "fetchedAt";

ALTER TABLE "SoilReading" ALTER COLUMN "lastFetchedAt" SET NOT NULL;
ALTER TABLE "SoilLatestReading" ALTER COLUMN "lastFetchedAt" SET NOT NULL;

COMMIT;
