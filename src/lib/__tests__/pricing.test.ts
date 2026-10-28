import { test } from "node:test";
import assert from "node:assert/strict";
import { activeLists, inTimeWindow, listApplies, localClock, menuPrice, type PriceListData } from "../pricing";
import { chooseAddons } from "../menu";

const list = (p: Partial<PriceListData>): PriceListData => ({
  id: "l1",
  name: "List",
  active: true,
  adjustPercent: 0,
  roundTo: 1,
  areas: "[]",
  orderTypes: "[]",
  sources: "[]",
  days: "[]",
  startTime: null,
  endTime: null,
  categoryIds: "[]",
  overrides: "{}",
  sortOrder: 0,
  ...p,
});

const paneer = { id: "paneer", categoryId: "starters", price: 280, variants: "[]" };
const biryani = { id: "biryani", categoryId: "rice", price: 200, variants: JSON.stringify([{ name: "Half", price: 200 }, { name: "Full", price: 320 }]) };
const tz = "Asia/Kolkata";
// 2026-10-28 is a Wednesday. 13:30 UTC = 19:00 in India.
const wed7pm = new Date("2026-10-28T13:30:00Z");

test("time windows, including ones that pass midnight", () => {
  assert.equal(inTimeWindow("17:00", "16:00", "19:00"), true);
  assert.equal(inTimeWindow("19:00", "16:00", "19:00"), false);
  assert.equal(inTimeWindow("23:30", "22:00", "02:00"), true);
  assert.equal(inTimeWindow("01:59", "22:00", "02:00"), true);
  assert.equal(inTimeWindow("12:00", "22:00", "02:00"), false);
  assert.equal(inTimeWindow("12:00", null, null), true);
  assert.deepEqual(localClock(wed7pm, tz), { day: 3, time: "19:00" });
});

test("a list applies only when every condition matches", () => {
  const swiggy = list({ sources: '["swiggy","zomato"]' });
  assert.equal(listApplies(swiggy, { type: "delivery", source: "swiggy", timezone: tz }), true);
  assert.equal(listApplies(swiggy, { type: "delivery", source: "phone", timezone: tz }), false);
  const ac = list({ areas: '["AC Hall"]' });
  assert.equal(listApplies(ac, { type: "dine_in", source: "counter", area: "ac hall", timezone: tz }), true);
  assert.equal(listApplies(ac, { type: "takeaway", source: "counter", area: "AC Hall", timezone: tz }), false);
  const happy = list({ days: "[1,2,3,4,5]", startTime: "16:00", endTime: "19:30" });
  assert.equal(listApplies(happy, { type: "dine_in", source: "counter", at: wed7pm, timezone: tz }), true);
  assert.equal(listApplies(happy, { type: "dine_in", source: "counter", at: new Date("2026-11-01T13:30:00Z"), timezone: tz }), false); // Sunday
  assert.equal(listApplies(list({ active: false, sources: '["swiggy"]' }), { type: "delivery", source: "swiggy", timezone: tz }), false);
});

test("percent changes are rounded, own prices win, other categories stay", () => {
  const up = list({ adjustPercent: 15, roundTo: 5 });
  assert.deepEqual(menuPrice(paneer, null, [up]), { price: 320, list: "List" }); // 322 → 320
  assert.equal(menuPrice(biryani, "Full", [up]).price, 370); // 368 → 370
  const own = list({ adjustPercent: 10, overrides: JSON.stringify({ biryani: { variants: { Full: 299 } } }) });
  assert.equal(menuPrice(biryani, "Full", [own]).price, 299);
  assert.equal(menuPrice(biryani, "Half", [own]).price, 220);
  const drinksOnly = list({ adjustPercent: -20, categoryIds: '["drinks"]' });
  assert.deepEqual(menuPrice(paneer, null, [drinksOnly]), { price: 280, list: null });
  assert.equal(menuPrice(biryani, null, [up]).price, null); // a portion must be chosen
});

test("the first matching list wins", () => {
  const a = list({ id: "a", name: "A", adjustPercent: 10, sortOrder: 2, sources: '["swiggy"]' });
  const b = list({ id: "b", name: "B", adjustPercent: 20, sortOrder: 1, sources: '["swiggy"]' });
  const lists = activeLists([a, b], { type: "delivery", source: "swiggy", timezone: tz });
  assert.deepEqual(lists.map((l) => l.id), ["b", "a"]);
  assert.equal(menuPrice(paneer, null, lists).list, "B");
});

test("add-on choices respect minimum, maximum and the options on offer", () => {
  const toppings = { id: "t", name: "Toppings", minSelect: 0, maxSelect: 2, options: JSON.stringify([{ name: "Cheese", price: 40 }, { name: "Olives", price: 30 }, { name: "Corn", price: 20 }]) };
  const drink = { id: "d", name: "Drink", minSelect: 1, maxSelect: 1, options: JSON.stringify([{ name: "Coke", price: 0 }, { name: "Lime Soda", price: 20 }]) };
  assert.deepEqual(chooseAddons("Pizza", [toppings, drink], [{ groupId: "d", name: "Coke" }, { groupId: "t", name: "Olives" }]), {
    addons: [
      { group: "Toppings", name: "Olives", price: 30 },
      { group: "Drink", name: "Coke", price: 0 },
    ],
  });
  assert.match((chooseAddons("Pizza", [toppings, drink], []) as { error: string }).error, /choose 1 in “Drink”/);
  const tooMany = chooseAddons("Pizza", [toppings], ["Cheese", "Olives", "Corn"].map((name) => ({ groupId: "t", name })));
  assert.match((tooMany as { error: string }).error, /at most 2/);
  assert.ok("error" in chooseAddons("Pizza", [toppings], [{ groupId: "t", name: "Pineapple" }]));
  assert.ok("error" in chooseAddons("Pizza", [toppings], [{ groupId: "other", name: "Cheese" }]));
});
