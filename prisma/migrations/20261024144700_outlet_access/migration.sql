-- CreateTable
CREATE TABLE "OutletAccess" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutletAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutletAccess_restaurantId_idx" ON "OutletAccess"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "OutletAccess_staffId_restaurantId_key" ON "OutletAccess"("staffId", "restaurantId");

-- AddForeignKey
ALTER TABLE "OutletAccess" ADD CONSTRAINT "OutletAccess_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletAccess" ADD CONSTRAINT "OutletAccess_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
