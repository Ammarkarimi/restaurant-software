-- Indexes for the links between tables (an order's dishes and payments, a customer's bills, ...).
-- Without them, loading one order scanned every dish and payment ever saved.

CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");
CREATE INDEX "Order_tableId_idx" ON "Order"("tableId");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_restaurantId_kitchenStatus_idx" ON "OrderItem"("restaurantId", "kitchenStatus");
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX "ActivityLog_staffId_idx" ON "ActivityLog"("staffId");
CREATE INDEX "Expense_supplierId_idx" ON "Expense"("supplierId");
CREATE INDEX "StockEntry_stockItemId_idx" ON "StockEntry"("stockItemId");
CREATE INDEX "RecipeLine_stockItemId_idx" ON "RecipeLine"("stockItemId");
CREATE INDEX "RecipeLine_menuItemId_idx" ON "RecipeLine"("menuItemId");
CREATE INDEX "CustomerTxn_customerId_idx" ON "CustomerTxn"("customerId");
CREATE INDEX "Reservation_tableId_idx" ON "Reservation"("tableId");
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");
CREATE INDEX "BanquetEvent_hallId_idx" ON "BanquetEvent"("hallId");
CREATE INDEX "BanquetPayment_eventId_idx" ON "BanquetPayment"("eventId");
CREATE INDEX "SalaryAdvance_employeeId_idx" ON "SalaryAdvance"("employeeId");
CREATE INDEX "GiftCardTxn_giftCardId_idx" ON "GiftCardTxn"("giftCardId");
CREATE INDEX "UpiRequest_orderId_idx" ON "UpiRequest"("orderId");
