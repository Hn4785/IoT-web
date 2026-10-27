-- Farm and Plot labels are user-managed hierarchy identifiers. Reject a
-- migration when case-insensitive duplicates already exist instead of merging
-- unrelated resources silently.
ALTER TABLE "Farm" ALTER COLUMN "name" TYPE CITEXT;
ALTER TABLE "Plot" ALTER COLUMN "name" TYPE CITEXT;

CREATE UNIQUE INDEX "Farm_name_key" ON "Farm"("name");
