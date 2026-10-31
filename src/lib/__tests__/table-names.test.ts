import { test } from "node:test";
import assert from "node:assert/strict";
import { areaPrefix, freeTableNames, rangeLabel } from "../table-names";

test("area prefix uses the area's first word", () => {
  assert.equal(areaPrefix("First Floor"), "F");
  assert.equal(areaPrefix("Garden"), "G");
  assert.equal(areaPrefix("AC hall"), "AC");
  assert.equal(areaPrefix("Floor 2"), "F2-");
  assert.equal(areaPrefix(""), "T");
});

test("suggests the area's letter, then the next free numbers", () => {
  const existing = Array.from({ length: 10 }, (_, i) => ({ name: `T${i + 1}`, area: "Main hall" }));
  const options = freeTableNames(existing, "T", 5, "First Floor");
  assert.deepEqual(options.map(rangeLabel), ["F1 … F5", "T11 … T15"]);
});

test("skips the area's letter when those names are taken too", () => {
  const existing = [{ name: "T1", area: "Main hall" }, { name: "T2", area: "Main hall" }, { name: "F1", area: "Garden" }];
  assert.deepEqual(freeTableNames(existing, "T", 2, "First Floor").map(rangeLabel), ["T3 … T4"]);
});

test("names are compared without case", () => {
  assert.deepEqual(freeTableNames([{ name: "t1", area: "Main hall" }, { name: "g1", area: "Patio" }], "T", 1, "Garden").map(rangeLabel), ["T2"]);
});

test("an area that already has tables keeps its own start", () => {
  const existing = Array.from({ length: 10 }, (_, i) => ({ name: `T${i + 1}`, area: "Main hall" }));
  assert.deepEqual(freeTableNames(existing, "T", 4, "Main hall").map(rangeLabel), ["T11 … T14"]);
  const garden = [...existing, { name: "G1", area: "Garden" }, { name: "G2", area: "Garden" }];
  assert.deepEqual(freeTableNames(garden, "T", 2, "Garden").map(rangeLabel), ["G3 … G4", "T11 … T12"]);
});
