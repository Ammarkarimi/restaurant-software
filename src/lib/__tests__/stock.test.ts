import { test } from "node:test";
import assert from "node:assert/strict";
import { isLow, round3, usageFor } from "../stock";

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
