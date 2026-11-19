import { test } from "node:test";
import assert from "node:assert/strict";
import { daysInMonth, salaryFor } from "../payroll";

test("days in a month, leap years too", () => {
  assert.equal(daysInMonth("2026-11"), 30);
  assert.equal(daysInMonth("2028-02"), 29);
  assert.equal(daysInMonth("2026-02"), 28);
});

test("monthly salary is paid per day of the month, never more than the full salary", () => {
  const full = salaryFor({ payType: "monthly", rate: 15000, month: "2026-11", daysWorked: 26, paidLeaves: 4 });
  assert.equal(full.payDays, 30);
  assert.equal(full.gross, 15000);
  const extra = salaryFor({ payType: "monthly", rate: 15000, month: "2026-11", daysWorked: 30, paidLeaves: 4 });
  assert.equal(extra.gross, 15000);
  const short = salaryFor({ payType: "monthly", rate: 15000, month: "2026-11", daysWorked: 20, paidLeaves: 4 });
  assert.equal(short.payDays, 24);
  assert.equal(short.gross, 12000);
});

test("daily wage counts every day", () => {
  const s = salaryFor({ payType: "daily", rate: 600, month: "2026-11", daysWorked: 22.5, paidLeaves: 0, bonus: 500 });
  assert.equal(s.gross, 13500);
  assert.equal(s.net, 14000);
});

test("advances are taken back, a bigger advance carries over", () => {
  const s = salaryFor({ payType: "monthly", rate: 12000, month: "2026-11", daysWorked: 30, paidLeaves: 0, deductions: 200, advances: 3000 });
  assert.equal(s.advances, 3000);
  assert.equal(s.net, 8800);
  assert.equal(s.advanceLeft, 0);
  const big = salaryFor({ payType: "daily", rate: 500, month: "2026-11", daysWorked: 4, paidLeaves: 0, advances: 3000 });
  assert.equal(big.net, 0);
  assert.equal(big.advances, 2000);
  assert.equal(big.advanceLeft, 1000);
});
