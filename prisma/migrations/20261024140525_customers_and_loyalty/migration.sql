-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "pointsEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pointsRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RestaurantSettings" ADD COLUMN     "loyaltyEarnPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN     "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loyaltyMinRedeem" DOUBLE PRECISION NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "email" TEXT,
    "birthday" TEXT,
    "notes" TEXT,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastVisitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_restaurantId_lastVisitAt_idx" ON "Customer"("restaurantId", "lastVisitAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_restaurantId_phone_key" ON "Customer"("restaurantId", "phone");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
