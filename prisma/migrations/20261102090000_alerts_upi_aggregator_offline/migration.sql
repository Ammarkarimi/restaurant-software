-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "aggregatorStatus" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "customerGstin" TEXT,
ADD COLUMN     "offline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "printedTotal" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "RestaurantSettings" ADD COLUMN     "aggregatorAutoAccept" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aggregatorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aggregatorToken" TEXT,
ADD COLUMN     "alertEmail" TEXT,
ADD COLUMN     "alertPhone" TEXT,
ADD COLUMN     "alertRules" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "dailyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dailyReportSentFor" TEXT,
ADD COLUMN     "razorpayKeyId" TEXT,
ADD COLUMN     "razorpayKeySecret" TEXT,
ADD COLUMN     "razorpayWebhookSecret" TEXT,
ADD COLUMN     "sacCode" TEXT NOT NULL DEFAULT '996331',
ADD COLUMN     "urbanpiperApiKey" TEXT,
ADD COLUMN     "urbanpiperUser" TEXT;

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "orderId" TEXT,
    "staffName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sentVia" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpiRequest" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "qrId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "UpiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_restaurantId_createdAt_idx" ON "Alert"("restaurantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UpiRequest_qrId_key" ON "UpiRequest"("qrId");

-- CreateIndex
CREATE INDEX "UpiRequest_restaurantId_orderId_idx" ON "UpiRequest"("restaurantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_clientId_key" ON "Order"("restaurantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSettings_aggregatorToken_key" ON "RestaurantSettings"("aggregatorToken");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpiRequest" ADD CONSTRAINT "UpiRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

