import { test } from "node:test";
import assert from "node:assert/strict";
import { menuEngineering, profitAndLoss } from "../profit";

test("menu engineering sorts dishes into the four boxes", () => {
  const { rows, popularAt, averageMargin } = menuEngineering([
    { key: "a", name: "Butter Chicken", category: "Mains", quantity: 100, revenue: 38000, unitCost: 140 }, // margin 240, popular
    { key: "b", name: "Dal Makhani", category: "Mains", quantity: 90, revenue: 23400, unitCost: 120 }, // margin 140, popular
    { key: "c", name: "Mutton Rogan Josh", category: "Mains", quantity: 20, revenue: 9600, unitCost: 200 }, // margin 280, not popular
    { key: "d", name: "Veg Soup", category: "Soups", quantity: 10, revenue: 1500, unitCost: 60 }, // margin 90, not popular
    { key: "e", name: "Masala Chai", category: "Drinks", quantity: 30, revenue: 1200, unitCost: null },
  ]);
  assert.equal(popularAt, 35); // 0.7 × 250 plates ÷ 5 dishes
  assert.ok(averageMargin > 140 && averageMargin < 240);
  const klass = Object.fromEntries(rows.map((r) => [r.key, r.klass]));
  assert.deepEqual(klass, { a: "star", b: "plowhorse", c: "puzzle", d: "dog", e: "no_recipe" });
  assert.equal(rows.find((r) => r.key === "a")!.foodCostPercent, 36.84);
});

test("profit and loss leaves out supplier payments and expenses already counted as stock", () => {
  const p = profitAndLoss({
    netSales: 300000,
    banquetSales: 100000,
    stockPurchases: 90000,
    expenses: [
      { category: "Vegetables & fruit", amount: 30000 },
      { category: "Staff salary / advance", amount: 80000 },
      { category: "Rent", amount: 50000 },
      { category: "Supplier payment", amount: 60000 },
      { category: "Electricity & water", amount: 15000 },
    ],
    recipeCost: 110000,
  });
  assert.equal(p.revenue, 400000);
  assert.equal(p.food, 120000);
  assert.equal(p.foodPercent, 30);
  assert.equal(p.gross, 280000);
  assert.equal(p.staff, 80000);
  assert.equal(p.otherTotal, 65000);
  assert.equal(p.net, 135000);
  assert.equal(p.netPercent, 33.75);
  assert.deepEqual(p.other.map((o) => o.category), ["Rent", "Electricity & water"]);
});
