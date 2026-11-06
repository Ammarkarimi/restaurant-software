-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "banquetInvoiceSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "banquetSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BanquetHall" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 100,
    "rent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanquetHall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanquetPackage" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "foodType" TEXT NOT NULL DEFAULT 'veg',
    "pricePerPlate" DOUBLE PRECISION NOT NULL,
    "menu" TEXT NOT NULL DEFAULT '[]',
    "minGuests" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanquetPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanquetEvent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enquiry',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerGstin" TEXT,
    "company" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'Birthday',
    "title" TEXT,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '19:00',
    "endTime" TEXT NOT NULL DEFAULT '23:00',
    "hallId" TEXT,
    "guests" INTEGER NOT NULL DEFAULT 50,
    "guaranteedGuests" INTEGER NOT NULL DEFAULT 0,
    "finalGuests" INTEGER,
    "packageId" TEXT,
    "packageName" TEXT,
    "pricePerPlate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "menu" TEXT NOT NULL DEFAULT '[]',
    "extras" TEXT NOT NULL DEFAULT '[]',
    "hallRent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "foodTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "otherTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "taxMode" TEXT NOT NULL DEFAULT 'gst',
    "notes" TEXT,
    "cancelReason" TEXT,
    "invoiceNumber" TEXT,
    "invoicedAt" TIMESTAMP(3),
    "businessDate" TEXT,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BanquetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanquetPayment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "date" TEXT NOT NULL,
    "receivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanquetPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BanquetHall_restaurantId_idx" ON "BanquetHall"("restaurantId");

-- CreateIndex
CREATE INDEX "BanquetPackage_restaurantId_idx" ON "BanquetPackage"("restaurantId");

-- CreateIndex
CREATE INDEX "BanquetEvent_restaurantId_date_idx" ON "BanquetEvent"("restaurantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BanquetEvent_restaurantId_number_key" ON "BanquetEvent"("restaurantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "BanquetEvent_restaurantId_invoiceNumber_key" ON "BanquetEvent"("restaurantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "BanquetPayment_restaurantId_date_idx" ON "BanquetPayment"("restaurantId", "date");

-- CreateIndex
CREATE INDEX "BanquetPayment_restaurantId_eventId_idx" ON "BanquetPayment"("restaurantId", "eventId");

-- AddForeignKey
ALTER TABLE "BanquetHall" ADD CONSTRAINT "BanquetHall_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetPackage" ADD CONSTRAINT "BanquetPackage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetEvent" ADD CONSTRAINT "BanquetEvent_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "BanquetHall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetEvent" ADD CONSTRAINT "BanquetEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetPayment" ADD CONSTRAINT "BanquetPayment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "BanquetEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetPayment" ADD CONSTRAINT "BanquetPayment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

