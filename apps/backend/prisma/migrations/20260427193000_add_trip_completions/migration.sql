-- CreateTable
CREATE TABLE "trip_completions" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_completions_tripId_userId_key" ON "trip_completions"("tripId", "userId");

-- CreateIndex
CREATE INDEX "trip_completions_tripId_idx" ON "trip_completions"("tripId");

-- CreateIndex
CREATE INDEX "trip_completions_userId_idx" ON "trip_completions"("userId");

-- AddForeignKey
ALTER TABLE "trip_completions" ADD CONSTRAINT "trip_completions_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_completions" ADD CONSTRAINT "trip_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
