import { test } from "node:test";
import assert from "node:assert/strict";
import { fromPrice, parseQuickAdd, parseVariants, priceFor } from "../menu";
import { DEFAULT_BILL_TEMPLATE, parseBillTemplate } from "../bill-template";

test("portions decide the price", () => {
  const item = { price: 0, variants: JSON.stringify([{ name: "Half", price: 180 }, { name: "Full", price: 320 }]) };
  assert.equal(priceFor(item, "Full"), 320);
  assert.equal(priceFor(item, "Half"), 180);
  assert.equal(priceFor(item, null), null, "an item with portions needs one chosen");
  assert.equal(priceFor(item, "Large"), null);
  assert.equal(fromPrice(item), 180);
});

test("items without portions use their own price", () => {
  const item = { price: 120, variants: "[]" };
  assert.equal(priceFor(item), 120);
  assert.equal(priceFor(item, "Half"), null);
  assert.equal(fromPrice(item), 120);
});

test("broken portion data is ignored", () => {
  assert.deepEqual(parseVariants("not json"), []);
  assert.deepEqual(parseVariants('[{"name":"","price":5},{"name":"Full","price":200}]'), [{ name: "Full", price: 200 }]);
});

test("quick add reads pasted lines and Excel columns", () => {
  const { rows, errors } = parseQuickAdd(
    "Paneer Tikka, 280, Starters, veg, pt\nChicken 65,₹320,Starters,non-veg\n\nMasala Dosa\t120\nBad line\nEgg Curry, 180, Mains, egg",
    "Main course"
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Line 5/);
  assert.deepEqual(rows, [
    { name: "Paneer Tikka", price: 280, category: "Starters", foodType: "veg", shortCode: "PT" },
    { name: "Chicken 65", price: 320, category: "Starters", foodType: "non_veg", shortCode: undefined },
    { name: "Masala Dosa", price: 120, category: "Main course", foodType: "veg", shortCode: undefined },
    { name: "Egg Curry", price: 180, category: "Mains", foodType: "egg", shortCode: undefined },
  ]);
});

test("bill templates fill in missing or invalid options with defaults", () => {
  assert.deepEqual(parseBillTemplate(null), DEFAULT_BILL_TEMPLATE);
  assert.deepEqual(parseBillTemplate("oops"), DEFAULT_BILL_TEMPLATE);
  const t = parseBillTemplate(JSON.stringify({ paperSize: "58mm", showUpiQr: true, fontSize: "huge", footerText: 42, extra: 1 }));
  assert.equal(t.paperSize, "58mm");
  assert.equal(t.showUpiQr, true);
  assert.equal(t.fontSize, DEFAULT_BILL_TEMPLATE.fontSize);
  assert.equal(t.footerText, DEFAULT_BILL_TEMPLATE.footerText);
  assert.equal("extra" in t, false);
});
