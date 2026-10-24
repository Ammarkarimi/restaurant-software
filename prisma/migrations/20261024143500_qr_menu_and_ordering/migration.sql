-- AlterTable
ALTER TABLE "DiningTable" ADD COLUMN     "callAt" TIMESTAMP(3),
ADD COLUMN     "callType" TEXT,
ADD COLUMN     "qrToken" TEXT;

-- Existing tables get a random QR token; new ones get one from the app.
UPDATE "DiningTable" SET "qrToken" = md5(random()::text || clock_timestamp()::text || "id") WHERE "qrToken" IS NULL;
ALTER TABLE "DiningTable" ALTER COLUMN "qrToken" SET NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "byGuest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RestaurantSettings" ADD COLUMN     "qrMenuEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "qrOrderingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_qrToken_key" ON "DiningTable"("qrToken");
