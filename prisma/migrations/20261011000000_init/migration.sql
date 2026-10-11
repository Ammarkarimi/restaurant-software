-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "city" TEXT,
    "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingStart" TEXT NOT NULL,
    "notes" TEXT,
    "orderSeq" INTEGER NOT NULL DEFAULT 0,
    "billSeq" INTEGER NOT NULL DEFAULT 0,
    "kotSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "clearsMonth" BOOLEAN NOT NULL DEFAULT true,
    "method" TEXT NOT NULL DEFAULT 'upi',
    "reference" TEXT,
    "notes" TEXT,
    "paidOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL DEFAULT 'My Restaurant',
    "legalName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "fssai" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "taxMode" TEXT NOT NULL DEFAULT 'gst',
    "taxName" TEXT NOT NULL DEFAULT 'Tax',
    "defaultTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false,
    "serviceChargePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roundOff" BOOLEAN NOT NULL DEFAULT true,
    "billPrefix" TEXT NOT NULL DEFAULT '',
    "upiId" TEXT,
    "logoPath" TEXT,
    "billTemplate" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningTable" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT 'Main hall',
    "seats" INTEGER NOT NULL DEFAULT 4,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "variants" TEXT NOT NULL DEFAULT '[]',
    "foodType" TEXT NOT NULL DEFAULT 'veg',
    "taxRate" DOUBLE PRECISION,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'dine_in',
    "status" TEXT NOT NULL DEFAULT 'open',
    "tableId" TEXT,
    "activeTableId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerAddress" TEXT,
    "guests" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'percent',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "taxMode" TEXT NOT NULL DEFAULT 'gst',
    "taxName" TEXT NOT NULL DEFAULT 'Tax',
    "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false,
    "serviceChargePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roundOff" BOOLEAN NOT NULL DEFAULT true,
    "billNumber" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serviceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roundOffAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "businessDate" TEXT,
    "cancelReason" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "billedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "variant" TEXT,
    "categoryName" TEXT,
    "foodType" TEXT NOT NULL DEFAULT 'veg',
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "kotNumber" INTEGER,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "receivedBy" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "staffId" TEXT,
    "staffName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_restaurantId_month_idx" ON "SubscriptionPayment"("restaurantId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE INDEX "Staff_restaurantId_idx" ON "Staff"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSettings_restaurantId_key" ON "RestaurantSettings"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_restaurantId_name_key" ON "DiningTable"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "MenuCategory_restaurantId_idx" ON "MenuCategory"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_categoryId_idx" ON "MenuItem"("restaurantId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_activeTableId_key" ON "Order"("activeTableId");

-- CreateIndex
CREATE INDEX "Order_restaurantId_status_idx" ON "Order"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "Order_restaurantId_businessDate_idx" ON "Order"("restaurantId", "businessDate");

-- CreateIndex
CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_number_key" ON "Order"("restaurantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_billNumber_key" ON "Order"("restaurantId", "billNumber");

-- CreateIndex
CREATE INDEX "OrderItem_restaurantId_orderId_idx" ON "OrderItem"("restaurantId", "orderId");

-- CreateIndex
CREATE INDEX "Payment_restaurantId_paidAt_idx" ON "Payment"("restaurantId", "paidAt");

-- CreateIndex
CREATE INDEX "ActivityLog_restaurantId_createdAt_idx" ON "ActivityLog"("restaurantId", "createdAt");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSettings" ADD CONSTRAINT "RestaurantSettings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_activeTableId_fkey" FOREIGN KEY ("activeTableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
