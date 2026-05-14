-- CreateEnum
CREATE TYPE "TripVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- AlterTable
ALTER TABLE "trips" ADD COLUMN "visibility" "TripVisibility";

-- Backfill existing trips to match the pre-visibility owner-only behavior.
UPDATE "trips"
SET "visibility" = 'PRIVATE'
WHERE "visibility" IS NULL;

-- AlterTable
ALTER TABLE "trips"
ALTER COLUMN "visibility" SET DEFAULT 'PRIVATE',
ALTER COLUMN "visibility" SET NOT NULL;

-- CreateIndex
CREATE INDEX "trips_visibility_idx" ON "trips"("visibility");
