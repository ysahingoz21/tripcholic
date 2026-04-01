-- CreateEnum
CREATE TYPE "POICategory" AS ENUM ('HISTORICAL', 'SCENIC', 'FOOD', 'SHOPPING', 'NATURE', 'NEIGHBORHOOD', 'ENTERTAINMENT');

-- CreateEnum
CREATE TYPE "BudgetLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PENDING', 'OPTIMIZED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "timeStart" TEXT,
    "timeEnd" TEXT,
    "budgetTl" DOUBLE PRECISION,
    "categories" TEXT[],
    "weather" TEXT,
    "walkingToleranceKm" DOUBLE PRECISION,
    "maxPois" INTEGER,
    "status" "TripStatus" NOT NULL DEFAULT 'PENDING',
    "routeTotalDistanceKm" DOUBLE PRECISION,
    "routeTotalDurationMin" INTEGER,
    "routeAlgorithmUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_stops" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "poiId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "arrivalTime" TEXT NOT NULL,
    "departureTime" TEXT NOT NULL,
    "travelTimeToNextMin" INTEGER,
    "estimatedCostTl" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "trip_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_of_interest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "POICategory" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "avgDurationMin" INTEGER NOT NULL,
    "budgetLevel" "BudgetLevel" NOT NULL,
    "openingHoursOpen" TEXT NOT NULL,
    "openingHoursClose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_of_interest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "trip_stops_tripId_order_key" ON "trip_stops"("tripId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "points_of_interest_name_key" ON "points_of_interest"("name");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "points_of_interest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
