import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "../csv";

test("text that looks like a formula stays plain text in Excel", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://x\",\"Click\")"), `"'=HYPERLINK(""http://x"",""Click"")"`);
  assert.equal(csvCell("+91 98765"), "'+91 98765");
  assert.equal(csvCell("-2+3"), "'-2+3");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
});

test("numbers, including negative ones, stay numbers", () => {
  assert.equal(csvCell(-250.5), "-250.5");
  assert.equal(csvCell(0), "0");
});

test("commas, quotes and line breaks are quoted", () => {
  assert.equal(csvCell('Paneer, "special"'), '"Paneer, ""special"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell(null), "");
  assert.equal(toCsv([["Name", "Amount"], ["Ravi", 10]]), "Name,Amount\nRavi,10");
});
