-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "marketRentSetAt" TIMESTAMP(3),
ADD COLUMN     "marketRentSetById" TEXT,
ADD COLUMN     "marketRentSetByName" TEXT;
