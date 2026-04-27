-- CreateTable
CREATE TABLE "saved_trip_collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_trip_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_trip_collection_items" (
    "id" TEXT NOT NULL,
    "savedTripId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_trip_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_trip_collections_userId_name_key" ON "saved_trip_collections"("userId", "name");

-- CreateIndex
CREATE INDEX "saved_trip_collections_userId_idx" ON "saved_trip_collections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_trip_collection_items_savedTripId_collectionId_key" ON "saved_trip_collection_items"("savedTripId", "collectionId");

-- CreateIndex
CREATE INDEX "saved_trip_collection_items_savedTripId_idx" ON "saved_trip_collection_items"("savedTripId");

-- CreateIndex
CREATE INDEX "saved_trip_collection_items_collectionId_idx" ON "saved_trip_collection_items"("collectionId");

-- AddForeignKey
ALTER TABLE "saved_trip_collections" ADD CONSTRAINT "saved_trip_collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_trip_collection_items" ADD CONSTRAINT "saved_trip_collection_items_savedTripId_fkey" FOREIGN KEY ("savedTripId") REFERENCES "saved_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_trip_collection_items" ADD CONSTRAINT "saved_trip_collection_items_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "saved_trip_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
