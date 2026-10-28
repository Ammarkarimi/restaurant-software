-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "creditLimit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "MenuCategory" ADD COLUMN     "station" TEXT;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "addonGroupIds" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "showOnline" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "complimentary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discountMax" DOUBLE PRECISION,
ADD COLUMN     "offerId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "addons" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "station" TEXT;

-- AlterTable
ALTER TABLE "RestaurantSettings" ADD COLUMN     "kitchenStations" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "AddonGroup" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 0,
    "options" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddonGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "adjustPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roundTo" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "areas" TEXT NOT NULL DEFAULT '[]',
    "orderTypes" TEXT NOT NULL DEFAULT '[]',
    "sources" TEXT NOT NULL DEFAULT '[]',
    "days" TEXT NOT NULL DEFAULT '[]',
    "startTime" TEXT,
    "endTime" TEXT,
    "categoryIds" TEXT NOT NULL DEFAULT '[]',
    "overrides" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL DEFAULT 'percent',
    "value" DOUBLE PRECISION NOT NULL,
    "maxDiscount" DOUBLE PRECISION,
    "minBill" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderTypes" TEXT NOT NULL DEFAULT '[]',
    "days" TEXT NOT NULL DEFAULT '[]',
    "startTime" TEXT,
    "endTime" TEXT,
    "validFrom" TEXT,
    "validTo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTxn" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "method" TEXT,
    "orderId" TEXT,
    "billNumber" TEXT,
    "note" TEXT,
    "date" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerTxn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AddonGroup_restaurantId_idx" ON "AddonGroup"("restaurantId");

-- CreateIndex
CREATE INDEX "PriceList_restaurantId_idx" ON "PriceList"("restaurantId");

-- CreateIndex
CREATE INDEX "Offer_restaurantId_idx" ON "Offer"("restaurantId");

-- CreateIndex
CREATE INDEX "CustomerTxn_restaurantId_customerId_createdAt_idx" ON "CustomerTxn"("restaurantId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerTxn_restaurantId_date_idx" ON "CustomerTxn"("restaurantId", "date");

-- AddForeignKey
ALTER TABLE "AddonGroup" ADD CONSTRAINT "AddonGroup_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTxn" ADD CONSTRAINT "CustomerTxn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTxn" ADD CONSTRAINT "CustomerTxn_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
