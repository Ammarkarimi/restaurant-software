import { test } from "node:test";
import assert from "node:assert/strict";
import { isLow, reorderQuantity, round3, usageFor } from "../stock";
import { convertQuantity, matchStockItem } from "../purchases";

const recipe = [
  { menuItemId: "pbm", variant: null, stockItemId: "paneer", quantity: 0.15 },
  { menuItemId: "pbm", variant: null, stockItemId: "butter", quantity: 0.02 },
  { menuItemId: "dal", variant: "Half", stockItemId: "dal", quantity: 0.1 },
  { menuItemId: "dal", variant: "Full", stockItemId: "dal", quantity: 0.2 },
  { menuItemId: "dal", variant: null, stockItemId: "butter", quantity: 0.01 },
];

test("a sold dish uses its recipe times the quantity", () => {
  const used = usageFor([{ menuItemId: "pbm", variant: null, quantity: 3 }], recipe);
  assert.equal(used.get("paneer"), 0.45);
  assert.equal(used.get("butter"), 0.06);
});

test("portion lines only count for that portion; lines without a portion count for all", () => {
  const used = usageFor(
    [
      { menuItemId: "dal", variant: "Half", quantity: 2 },
      { menuItemId: "dal", variant: "Full", quantity: 1 },
    ],
    recipe
  );
  assert.equal(used.get("dal"), 0.4);
  assert.equal(used.get("butter"), 0.03);
});

test("open items and dishes without a recipe use nothing", () => {
  const used = usageFor(
    [
      { menuItemId: null, variant: null, quantity: 5 },
      { menuItemId: "naan", variant: null, quantity: 4 },
    ],
    recipe
  );
  assert.equal(used.size, 0);
});

test("low stock and rounding", () => {
  assert.equal(isLow({ quantity: 2, lowAt: 2 }), true);
  assert.equal(isLow({ quantity: 2.5, lowAt: 2 }), false);
  assert.equal(isLow({ quantity: 0, lowAt: null }), false);
  assert.equal(round3(0.1 + 0.2), 0.3);
});


test("reorder: a week at the recent pace plus the warning level, less what is in stock", () => {
  assert.equal(reorderQuantity({ quantity: 2, lowAt: 3, unit: "kg" }, 1.5), 12); // 10.5 + 3 − 2 = 11.5 → 12
  assert.equal(reorderQuantity({ quantity: 1, lowAt: 2, unit: "kg" }, 0.2), 2.5); // 1.4 + 2 − 1 = 2.4 → half kilos under 5 kg
  assert.equal(reorderQuantity({ quantity: 40, lowAt: 5, unit: "kg" }, 1), 0);
  assert.equal(reorderQuantity({ quantity: 50, lowAt: 200, unit: "g" }, 30), 400); // 210 + 200 − 50 = 360 → 400
  assert.equal(reorderQuantity({ quantity: 3, lowAt: 6, unit: "pcs" }, 0), 3);
});

test("supplier bill lines find the stock item they are", () => {
  const items = [
    { id: "p", name: "Paneer" },
    { id: "o", name: "Onion" },
    { id: "c", name: "Chicken" },
    { id: "cb", name: "Chicken Boneless" },
    { id: "oil", name: "Sunflower Oil" },
  ];
  assert.equal(matchStockItem("Amul Paneer 1kg", items)?.id, "p");
  assert.equal(matchStockItem("ONION", items)?.id, "o");
  assert.equal(matchStockItem("Chicken boneless", items)?.id, "cb");
  assert.equal(matchStockItem("Fortune Sunflower Refined Oil", items)?.id, "oil");
  assert.equal(matchStockItem("Tomato", items), null);
  const dairy = [{ id: "cream", name: "Cream" }, { id: "milk", name: "Milk" }, { id: "butter", name: "Butter" }];
  assert.equal(matchStockItem("Full Cream Milk", dairy)?.id, "milk");
  assert.equal(matchStockItem("Fresh Cream", dairy)?.id, "cream");
  assert.equal(matchStockItem("Amul Butter", dairy)?.id, "butter");
  assert.deepEqual(convertQuantity(500, "gm", "kg"), { quantity: 0.5, converted: true });
  assert.deepEqual(convertQuantity(2, "dozen", "pcs"), { quantity: 24, converted: true });
  assert.deepEqual(convertQuantity(3, "Kgs", "kg"), { quantity: 3, converted: false });
});
