CREATE TABLE "user_follows" (
  "id" TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_follows_followerId_followingId_key"
ON "user_follows"("followerId", "followingId");

CREATE INDEX "user_follows_followerId_idx"
ON "user_follows"("followerId");

CREATE INDEX "user_follows_followingId_idx"
ON "user_follows"("followingId");

ALTER TABLE "user_follows"
ADD CONSTRAINT "user_follows_followerId_fkey"
FOREIGN KEY ("followerId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_follows"
ADD CONSTRAINT "user_follows_followingId_fkey"
FOREIGN KEY ("followingId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
