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
    { rate: 5, taxable: 225, tax: 11.25 },
    { rate: 18, taxable: 75, tax: 13.5 },
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
