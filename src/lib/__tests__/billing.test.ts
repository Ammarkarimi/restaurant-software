import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateBill, discountAmount, taxRowsFor } from "../billing";

const gst = { taxMode: "gst", pricesIncludeTax: false, serviceChargePercent: 0, roundOff: false };

test("GST is added on top of menu prices", () => {
  const t = calculateBill(
    [
      { price: 280, quantity: 2, taxRate: 5 }, // 560
      { price: 40, quantity: 3, taxRate: 5 }, // 120
    ],
    gst
  );
  assert.equal(t.itemsTotal, 680);
  assert.equal(t.taxable, 680);
  assert.equal(t.tax, 34);
  assert.equal(t.total, 714);
  assert.equal(t.itemCount, 5);
  assert.deepEqual(taxRowsFor(t, "gst"), [
    { label: "CGST @2.5%", amount: 17 },
    { label: "SGST @2.5%", amount: 17 },
  ]);
});

test("prices that already include tax are not taxed twice", () => {
  const t = calculateBill([{ price: 105, quantity: 1, taxRate: 5 }], { ...gst, pricesIncludeTax: true });
  assert.equal(t.taxable, 100);
  assert.equal(t.tax, 5);
  assert.equal(t.total, 105);
});

test("discount comes off before service charge and tax", () => {
  const t = calculateBill([{ price: 1000, quantity: 1, taxRate: 5 }], { ...gst, serviceChargePercent: 10 }, { type: "percent", value: 10 });
  assert.equal(t.discount, 100);
  assert.equal(t.serviceCharge, 90); // 10% of 900
  assert.equal(t.taxable, 990);
  assert.equal(t.tax, 49.5); // GST on food and service charge
  assert.equal(t.serviceChargeTax, 4.5);
  assert.equal(t.total, 1039.5);
});

test("a flat discount is spread across items with different tax rates", () => {
  const t = calculateBill(
    [
      { price: 300, quantity: 1, taxRate: 5 },
      { price: 100, quantity: 1, taxRate: 18 },
    ],
    gst,
    { type: "amount", value: 100 }
  );
  // 25% off every line: 225 @5% and 75 @18%
  assert.deepEqual(t.taxLines, [
    { rate: 5, taxable: 225, tax: 11.25, included: 0 },
    { rate: 18, taxable: 75, tax: 13.5, included: 0 },
  ]);
  assert.equal(t.total, 324.75);
});

test("round-off to the nearest whole amount", () => {
  const t = calculateBill([{ price: 99, quantity: 1, taxRate: 5 }], { ...gst, roundOff: true });
  assert.equal(t.exactTotal, 103.95);
  assert.equal(t.total, 104);
  assert.equal(t.roundOff, 0.05);
  const down = calculateBill([{ price: 101, quantity: 1, taxRate: 5 }], { ...gst, roundOff: true });
  assert.equal(down.total, 106);
  assert.equal(down.roundOff, -0.05);
});

test("no tax mode ignores item tax rates", () => {
  const t = calculateBill([{ price: 250, quantity: 2, taxRate: 5 }], { ...gst, taxMode: "none" });
  assert.equal(t.tax, 0);
  assert.deepEqual(t.taxLines, []);
  assert.equal(t.total, 500);
  assert.deepEqual(taxRowsFor(t, "none"), []);
});

test("simple tax mode prints one line with the tax name", () => {
  const t = calculateBill([{ price: 200, quantity: 1, taxRate: 12.5 }], { ...gst, taxMode: "simple" });
  assert.deepEqual(taxRowsFor(t, "simple", "VAT"), [{ label: "VAT @12.5%", amount: 25 }]);
});

test("discounts never exceed the bill", () => {
  assert.equal(discountAmount(500, { type: "amount", value: 900 }), 500);
  assert.equal(discountAmount(500, { type: "percent", value: 150 }), 500);
  assert.equal(discountAmount(500, { type: "percent", value: -5 }), 0);
  assert.equal(discountAmount(0, { type: "percent", value: 10 }), 0);
  const t = calculateBill([{ price: 100, quantity: 1, taxRate: 5 }], gst, { type: "percent", value: 100 });
  assert.equal(t.total, 0);
});

test("empty orders total zero", () => {
  const t = calculateBill([], { ...gst, serviceChargePercent: 10, roundOff: true });
  assert.equal(t.total, 0);
  assert.equal(t.itemCount, 0);
});

test("packing and delivery charges are taxed but never discounted", () => {
  const t = calculateBill([{ price: 400, quantity: 1, taxRate: 5 }], { ...gst, serviceChargePercent: 10 }, { type: "percent", value: 50 }, {
    charges: [
      { name: "Packing charge", amount: 20, taxRate: 5 },
      { name: "Delivery charge", amount: 40, taxRate: 5 },
    ],
  });
  assert.equal(t.discount, 200);
  assert.equal(t.serviceCharge, 20); // only on the food
  assert.equal(t.chargesTotal, 60);
  assert.deepEqual(t.charges, [
    { name: "Packing charge", amount: 20 },
    { name: "Delivery charge", amount: 40 },
  ]);
  assert.equal(t.taxable, 280); // 200 food + 20 service + 60 charges
  assert.equal(t.tax, 14);
  assert.equal(t.total, 294);
});

test("charges of zero are left off the bill, and include tax when menu prices do", () => {
  const t = calculateBill([{ price: 105, quantity: 1, taxRate: 5 }], { ...gst, pricesIncludeTax: true }, null, {
    charges: [
      { name: "Packing charge", amount: 21, taxRate: 5 },
      { name: "Delivery charge", amount: 0, taxRate: 5 },
    ],
  });
  assert.deepEqual(t.charges, [{ name: "Packing charge", amount: 21 }]);
  assert.equal(t.taxable, 120);
  assert.equal(t.tax, 6);
  assert.equal(t.total, 126);
});

test("loyalty points come off like a discount, never more than the items", () => {
  const t = calculateBill([{ price: 500, quantity: 1, taxRate: 5 }], gst, { type: "amount", value: 100 }, { pointsDiscount: 50 });
  assert.equal(t.discount, 150);
  assert.equal(t.pointsDiscount, 50);
  assert.equal(t.taxable, 350);
  assert.equal(t.total, 367.5);
  const capped = calculateBill([{ price: 100, quantity: 1, taxRate: 5 }], gst, { type: "percent", value: 80 }, { pointsDiscount: 500 });
  assert.equal(capped.pointsDiscount, 20);
  assert.equal(capped.discount, 100);
  assert.equal(capped.total, 0);
});

test("a fixed-price dish includes tax while the rest of the menu adds it", () => {
  const rules = { taxMode: "gst", pricesIncludeTax: false, serviceChargePercent: 0, roundOff: false };
  const thali = { price: 100, quantity: 1, taxRate: 5, taxIncluded: true };
  const paneer = { price: 200, quantity: 1, taxRate: 5 };

  // The truck driver's thali alone: pays exactly ₹100, of which ₹4.76 is GST.
  const alone = calculateBill([thali], rules);
  assert.equal(alone.total, 100);
  assert.equal(alone.tax, 4.76);
  assert.equal(alone.includedTax, 4.76);
  assert.deepEqual(taxRowsFor(alone, "gst", "GST", "added"), []);
  assert.deepEqual(taxRowsFor(alone, "gst", "GST", "included"), [{ label: "CGST @2.5%", amount: 2.38 }, { label: "SGST @2.5%", amount: 2.38 }]);

  // With a normal dish: GST is added only on the paneer.
  const mixed = calculateBill([thali, paneer], rules);
  assert.equal(mixed.total, 310);
  assert.equal(mixed.itemsTotal, 300);
  assert.equal(mixed.tax, 14.76);
  assert.equal(mixed.includedTax, 4.76);
  assert.deepEqual(taxRowsFor(mixed, "gst", "GST", "added"), [{ label: "CGST @2.5%", amount: 5 }, { label: "SGST @2.5%", amount: 5 }]);
  // The GST summary still shows all the tax on the bill.
  assert.deepEqual(mixed.taxLines, [{ rate: 5, taxable: 295.24, tax: 14.76, included: 4.76 }]);
  // What the bill shows adds up: items + tax added on top = total.
  assert.equal(Math.round((mixed.itemsTotal + mixed.tax - mixed.includedTax) * 100) / 100, mixed.total);

  // A 10% discount comes off both; the thali still carries its tax inside.
  const disc = calculateBill([thali, paneer], rules, { type: "percent", value: 10 });
  assert.equal(disc.total, 279);
  assert.equal(disc.includedTax, 4.29);

  // Service charge is added on top, so its tax is too.
  const sc = calculateBill([thali], { ...rules, serviceChargePercent: 10 });
  assert.equal(sc.total, 110);
  assert.equal(sc.includedTax, 4.76);
  assert.equal(Math.round((sc.itemsTotal + sc.serviceCharge + sc.tax - sc.includedTax) * 100) / 100, 110);

  // No tax at all: the flag changes nothing.
  assert.equal(calculateBill([thali, paneer], { ...rules, taxMode: "none" }).total, 300);
});

test("when every price includes tax, bills are worked out as before", () => {
  const rules = { taxMode: "gst", pricesIncludeTax: true, serviceChargePercent: 0, roundOff: false };
  const t = calculateBill([{ price: 105, quantity: 2, taxRate: 5 }, { price: 50, quantity: 1, taxRate: 5, taxIncluded: true }], rules, null, { charges: [{ name: "Packing charge", amount: 21, taxRate: 5 }] });
  assert.equal(t.total, 281);
  assert.equal(t.tax, 13.38);
  assert.equal(t.includedTax, t.tax, "all of it is inside the prices");
  assert.deepEqual(taxRowsFor(t, "gst", "GST", "added"), []);
  assert.deepEqual(taxRowsFor(t, "gst"), taxRowsFor(t, "gst", "GST", "included"));
});
