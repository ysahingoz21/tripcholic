/*
  Warnings:

  - Added the required column `updatedAt` to the `points_of_interest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `trip_stops` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "points_of_interest" ADD COLUMN     "address" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "estimatedMaxCostTl" DOUBLE PRECISION,
ADD COLUMN     "estimatedMinCostTl" DOUBLE PRECISION,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "trip_stops" ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "optimizedAt" TIMESTAMP(3),
ADD COLUMN     "routeName" TEXT,
ADD COLUMN     "routeTotalCostTl" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "displayName" TEXT;

-- CreateIndex
CREATE INDEX "points_of_interest_category_idx" ON "points_of_interest"("category");

-- CreateIndex
CREATE INDEX "points_of_interest_name_idx" ON "points_of_interest"("name");

-- CreateIndex
CREATE INDEX "trip_stops_poiId_idx" ON "trip_stops"("poiId");

-- CreateIndex
CREATE INDEX "trips_userId_idx" ON "trips"("userId");

-- CreateIndex
CREATE INDEX "trips_date_idx" ON "trips"("date");
