-- CreateIndex: the kitchen screen looks up takeaway / delivery orders paid in the last hours on every refresh.
CREATE INDEX "Order_restaurantId_status_settledAt_idx" ON "Order"("restaurantId", "status", "settledAt");
