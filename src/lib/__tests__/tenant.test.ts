import { test } from "node:test";
import assert from "node:assert/strict";
import { currentRestaurantId, runForRestaurant, scopeArgs } from "../db";

test("reads, updates and deletes only ever touch the current restaurant", () => {
  for (const op of ["findMany", "findUnique", "findFirst", "count", "aggregate", "update", "updateMany", "delete", "deleteMany"]) {
    assert.deepEqual(scopeArgs(op, { where: { id: "b1" } }, "h1").where, { id: "b1", restaurantId: "h1" }, op);
  }
  assert.deepEqual(scopeArgs("findMany", undefined, "h1"), { where: { restaurantId: "h1" } });
});

test("a different restaurant id in a query is overridden, never trusted", () => {
  assert.deepEqual(scopeArgs("findMany", { where: { restaurantId: "other" } }, "h1").where, { restaurantId: "h1" });
  assert.deepEqual(scopeArgs("create", { data: { name: "x", restaurantId: "other" } }, "h1").data, { name: "x", restaurantId: "h1" });
});

test("new rows are stamped with the current restaurant", () => {
  assert.deepEqual(scopeArgs("createMany", { data: [{ a: 1 }, { a: 2 }] }, "h1").data, [
    { a: 1, restaurantId: "h1" },
    { a: 2, restaurantId: "h1" },
  ]);
  const upsert = scopeArgs("upsert", { where: { orderId: "b1" }, create: { orderId: "b1" }, update: {} }, "h1");
  assert.deepEqual(upsert.where, { orderId: "b1", restaurantId: "h1" });
  assert.deepEqual(upsert.create, { orderId: "b1", restaurantId: "h1" });
});

test("restaurant context follows async work and is absent outside it", async () => {
  assert.throws(() => currentRestaurantId(), /No restaurant selected/);
  const seen = await runForRestaurant("h1", async () => {
    await new Promise((r) => setTimeout(r, 5));
    return currentRestaurantId();
  });
  assert.equal(seen, "h1");
  // Lazy thenables (like Prisma queries) returned directly still run inside the restaurant.
  const lazy = { then: (resolve: (v: string) => void) => resolve(currentRestaurantId()) };
  assert.equal(await runForRestaurant("h2", () => lazy), "h2");
});
