-- CreateTable
CREATE TABLE "trip_likes" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_comments" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_trips" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_likes_tripId_userId_key" ON "trip_likes"("tripId", "userId");

-- CreateIndex
CREATE INDEX "trip_likes_tripId_idx" ON "trip_likes"("tripId");

-- CreateIndex
CREATE INDEX "trip_likes_userId_idx" ON "trip_likes"("userId");

-- CreateIndex
CREATE INDEX "trip_comments_tripId_createdAt_idx" ON "trip_comments"("tripId", "createdAt");

-- CreateIndex
CREATE INDEX "trip_comments_userId_idx" ON "trip_comments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_trips_tripId_userId_key" ON "saved_trips"("tripId", "userId");

-- CreateIndex
CREATE INDEX "saved_trips_tripId_idx" ON "saved_trips"("tripId");

-- CreateIndex
CREATE INDEX "saved_trips_userId_idx" ON "saved_trips"("userId");

-- AddForeignKey
ALTER TABLE "trip_likes" ADD CONSTRAINT "trip_likes_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_likes" ADD CONSTRAINT "trip_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_comments" ADD CONSTRAINT "trip_comments_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_comments" ADD CONSTRAINT "trip_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_trips" ADD CONSTRAINT "saved_trips_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_trips" ADD CONSTRAINT "saved_trips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
