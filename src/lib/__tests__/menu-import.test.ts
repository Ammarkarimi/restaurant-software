import { test } from "node:test";
import assert from "node:assert/strict";
import { guessFoodType, markDuplicates, parseCsv, rowsFromSheet } from "../menu-import";

test("reads a sheet with headers in any order, with Half / Full portions", () => {
  const r = rowsFromSheet(
    [
      ["Sr", "Item Name", "Category", "Veg/Non-Veg", "Half", "Full", "Rate"],
      [1, "Dal Makhani", "Main Course", "Veg", 180, 260, ""],
      [2, "Chicken 65", "Starters", "Non Veg", "", "", "₹ 320"],
      [3, "Masala Chai", "", "", "", "", 40],
    ],
    "Beverages"
  );
  assert.equal(r.rows.length, 3);
  assert.deepEqual(r.rows[0], { name: "Dal Makhani", price: 180, category: "Main Course", foodType: "veg", shortCode: undefined, description: undefined, variants: [{ name: "Half", price: 180 }, { name: "Full", price: 260 }] });
  assert.equal(r.rows[1].price, 320);
  assert.equal(r.rows[1].foodType, "non_veg");
  assert.equal(r.rows[2].category, "Beverages");
});

test("without headers: name, price, category; heading rows set the category", () => {
  const r = rowsFromSheet([["STARTERS"], ["Paneer Tikka", 280], ["Egg Bhurji", "120"], ["Mutton Seekh", "abc", "Starters"]], "Main");
  assert.deepEqual(r.rows.map((x) => [x.name, x.price, x.category, x.foodType]), [
    ["Paneer Tikka", 280, "Starters", "veg"],
    ["Egg Bhurji", 120, "Starters", "egg"],
  ]);
  assert.match(r.errors[0], /Mutton Seekh/);
});

test("CSV with quotes and commas", () => {
  assert.deepEqual(parseCsv('Name,Price\n"Pizza, large",450\r\n"Say ""hi""",10\n'), [["Name", "Price"], ["Pizza, large", "450"], ['Say "hi"', "10"]]);
});

test("guesses food type and marks dishes already on the menu", () => {
  assert.equal(guessFoodType("Prawns Koliwada"), "non_veg");
  assert.equal(guessFoodType("Veg Biryani"), "veg");
  const rows = markDuplicates(
    [
      { name: "Paneer Tikka", price: 1, category: "Starters", foodType: "veg" },
      { name: "paneer tikka", price: 1, category: "Main", foodType: "veg" },
      { name: "Paneer Tikka", price: 1, category: "starters", foodType: "veg" },
    ],
    [{ name: "PANEER TIKKA", category: "Starters" }]
  );
  assert.deepEqual(rows.map((r) => r.duplicate), [true, false, true]);
});
