-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryStatus" TEXT,
ADD COLUMN     "outAt" TIMESTAMP(3),
ADD COLUMN     "riderName" TEXT,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "purchaseSeq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RestaurantSettings" ADD COLUMN     "appCommission" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "deliveryRiders" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "onlineBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlineDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlineMinOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "onlineOrderingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "permissions" TEXT NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 2,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "tableId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "source" TEXT NOT NULL DEFAULT 'phone',
    "occasion" TEXT,
    "notes" TEXT,
    "orderId" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "gstin" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ordered',
    "invoiceNo" TEXT,
    "orderedOn" TEXT NOT NULL,
    "receivedOn" TEXT,
    "lines" TEXT NOT NULL DEFAULT '[]',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "rating" INTEGER NOT NULL,
    "food" INTEGER,
    "service" INTEGER,
    "ambience" INTEGER,
    "comment" TEXT,
    "followedUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipients" TEXT NOT NULL DEFAULT '[]',
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "inAt" TIMESTAMP(3) NOT NULL,
    "outAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reservation_restaurantId_date_idx" ON "Reservation"("restaurantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_restaurantId_name_key" ON "Supplier"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "Purchase_restaurantId_status_idx" ON "Purchase"("restaurantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_restaurantId_number_key" ON "Purchase"("restaurantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_orderId_key" ON "Feedback"("orderId");

-- CreateIndex
CREATE INDEX "Feedback_restaurantId_createdAt_idx" ON "Feedback"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Campaign_restaurantId_createdAt_idx" ON "Campaign"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Attendance_restaurantId_date_idx" ON "Attendance"("restaurantId", "date");

-- CreateIndex
CREATE INDEX "Attendance_restaurantId_staffId_date_idx" ON "Attendance"("restaurantId", "staffId", "date");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
