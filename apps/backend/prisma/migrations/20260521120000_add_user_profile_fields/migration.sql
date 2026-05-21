-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT;
ALTER TABLE "users" ADD COLUMN     "coverImageUrl" TEXT;
ALTER TABLE "users" ADD COLUMN     "bio" TEXT;
ALTER TABLE "users" ADD COLUMN     "travelVibes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN     "favoriteCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
