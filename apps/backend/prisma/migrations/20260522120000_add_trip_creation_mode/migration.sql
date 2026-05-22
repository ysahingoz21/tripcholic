-- CreateEnum
CREATE TYPE "TripCreationMode" AS ENUM ('MANUAL', 'OPTIMIZED');

-- AlterTable
ALTER TABLE "trips" ADD COLUMN "creationMode" "TripCreationMode" NOT NULL DEFAULT 'OPTIMIZED';
