-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowAt" DOUBLE PRECISION,
    "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEntry" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION,
    "supplier" TEXT,
    "note" TEXT,
    "orderId" TEXT,
    "date" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLine" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "variant" TEXT,
    "stockItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_restaurantId_name_key" ON "StockItem"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "StockEntry_restaurantId_stockItemId_createdAt_idx" ON "StockEntry"("restaurantId", "stockItemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockEntry_restaurantId_date_idx" ON "StockEntry"("restaurantId", "date");

-- CreateIndex
CREATE INDEX "StockEntry_restaurantId_orderId_idx" ON "StockEntry"("restaurantId", "orderId");

-- CreateIndex
CREATE INDEX "RecipeLine_restaurantId_menuItemId_idx" ON "RecipeLine"("restaurantId", "menuItemId");

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
