-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "paidTo" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayClose" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "openingCash" DOUBLE PRECISION NOT NULL,
    "cashSales" DOUBLE PRECISION NOT NULL,
    "cashExpenses" DOUBLE PRECISION NOT NULL,
    "expectedCash" DOUBLE PRECISION NOT NULL,
    "countedCash" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "cashLeft" DOUBLE PRECISION NOT NULL,
    "sales" DOUBLE PRECISION NOT NULL,
    "bills" INTEGER NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "closedById" TEXT,
    "closedByName" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_restaurantId_date_idx" ON "Expense"("restaurantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DayClose_restaurantId_date_key" ON "DayClose"("restaurantId", "date");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayClose" ADD CONSTRAINT "DayClose_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
