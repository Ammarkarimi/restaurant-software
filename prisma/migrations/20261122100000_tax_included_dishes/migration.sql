-- Dishes whose price already includes tax (e.g. a fixed-price thali), while the rest of the menu adds tax.
ALTER TABLE "MenuItem" ADD COLUMN "priceIncludesTax" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "taxIncluded" BOOLEAN NOT NULL DEFAULT false;
