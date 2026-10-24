-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "kitchenStatus" TEXT NOT NULL DEFAULT 'new',
ADD COLUMN     "readyAt" TIMESTAMP(3);
