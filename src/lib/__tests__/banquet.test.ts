import { test } from "node:test";
import assert from "node:assert/strict";
import { banquetTotals, clashes, slotsOverlap } from "../banquet";

const base = { guests: 100, guaranteedGuests: 0, finalGuests: null, pricePerPlate: 650, hallRent: 20000, extras: [{ name: "Decoration", amount: 10000 }], discount: 0, foodTaxRate: 5, otherTaxRate: 18, taxMode: "gst" };

test("food at 5%, hall rent and extras at 18%", () => {
  const t = banquetTotals(base);
  assert.equal(t.plates, 100);
  assert.equal(t.food, 65000);
  assert.equal(t.subtotal, 95000);
  assert.deepEqual(t.taxLines, [{ rate: 5, taxable: 65000, tax: 3250 }, { rate: 18, taxable: 30000, tax: 5400 }]);
  assert.equal(t.total, 103650);
});

test("guaranteed plates are the minimum; the count on the day wins above it", () => {
  assert.equal(banquetTotals({ ...base, guaranteedGuests: 120 }).plates, 120);
  assert.equal(banquetTotals({ ...base, guaranteedGuests: 80, finalGuests: 90 }).plates, 90);
  assert.equal(banquetTotals({ ...base, guaranteedGuests: 80, finalGuests: 60 }).plates, 80);
});

test("discount is shared between food and rent in proportion; rounding to the rupee", () => {
  const t = banquetTotals({ ...base, discount: 9500 });
  assert.equal(t.taxable, 85500);
  assert.deepEqual(t.taxLines, [{ rate: 5, taxable: 58500, tax: 2925 }, { rate: 18, taxable: 27000, tax: 4860 }]);
  assert.equal(t.total, 93285);
  const odd = banquetTotals({ ...base, guests: 3, pricePerPlate: 333.33, hallRent: 0, extras: [] });
  assert.equal(odd.total, Math.round(999.99 * 1.05));
  assert.equal(banquetTotals({ ...base, taxMode: "none" }).tax, 0);
});

test("time slots and hall clashes", () => {
  assert.equal(slotsOverlap("12:00", "16:00", "19:00", "23:00"), false);
  assert.equal(slotsOverlap("18:00", "23:00", "22:00", "01:00"), true);
  assert.equal(slotsOverlap("12:00", "16:00", "16:00", "18:00"), false);
  const others = [
    { id: "a", number: 1, hallId: "h1", date: "2026-12-01", startTime: "19:00", endTime: "23:00", status: "confirmed", customerName: "A" },
    { id: "b", number: 2, hallId: "h1", date: "2026-12-01", startTime: "12:00", endTime: "15:00", status: "enquiry", customerName: "B" },
    { id: "c", number: 3, hallId: "h2", date: "2026-12-01", startTime: "19:00", endTime: "23:00", status: "confirmed", customerName: "C" },
  ];
  assert.deepEqual(clashes({ id: "x", hallId: "h1", date: "2026-12-01", startTime: "20:00", endTime: "22:00" }, others).map((c) => c.id), ["a"]);
  assert.deepEqual(clashes({ id: "x", hallId: "h1", date: "2026-12-01", startTime: "12:00", endTime: "15:00" }, others), []);
});
