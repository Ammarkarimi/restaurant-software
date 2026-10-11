import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, isMonth, monthRange, subscriptionSummary } from "../subscription";

test("month arithmetic crosses years", () => {
  assert.equal(addMonths("2026-11", 2), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.deepEqual(monthRange("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(monthRange("2026-12", "2026-10"), []);
  assert.ok(isMonth("2026-10"));
  assert.ok(!isMonth("2026-13"));
  assert.ok(!isMonth("2026-1"));
});

test("unpaid earlier months are overdue; this month is only due", () => {
  const s = subscriptionSummary(
    { monthlyFee: 1000, billingStart: "2026-07" },
    [
      { month: "2026-07", amount: 1000, clearsMonth: true },
      { month: "2026-09", amount: 400, clearsMonth: false },
    ],
    "2026-10"
  );
  assert.deepEqual(s.months.map((m) => [m.month, m.status]), [
    ["2026-10", "unpaid"],
    ["2026-09", "part_paid"],
    ["2026-08", "unpaid"],
    ["2026-07", "paid"],
  ]);
  assert.deepEqual(s.overdueMonths, ["2026-08", "2026-09"]);
  assert.equal(s.currentStatus, "unpaid");
  assert.equal(s.outstanding, 1000 + 600 + 1000);
  assert.equal(s.paidUntil, null);
});

test("a payment marked as clearing the month counts as paid even after a price rise", () => {
  const s = subscriptionSummary({ monthlyFee: 1500, billingStart: "2026-09" }, [
    { month: "2026-09", amount: 1000, clearsMonth: true },
    { month: "2026-10", amount: 1500, clearsMonth: false },
  ], "2026-10");
  assert.equal(s.months.find((m) => m.month === "2026-09")?.status, "paid");
  assert.equal(s.months.find((m) => m.month === "2026-10")?.status, "paid");
  assert.equal(s.outstanding, 0);
  assert.equal(s.paidUntil, "2026-10");
});

test("advance payments extend paid-until", () => {
  const s = subscriptionSummary({ monthlyFee: 999, billingStart: "2026-10" }, [
    { month: "2026-10", amount: 999, clearsMonth: true },
    { month: "2026-11", amount: 999, clearsMonth: true },
    { month: "2026-12", amount: 999, clearsMonth: true },
  ], "2026-10");
  assert.equal(s.paidUntil, "2026-12");
  assert.equal(s.months[0].month, "2026-12");
  assert.deepEqual(s.overdueMonths, []);
});

test("free trial: billing that starts later owes nothing yet", () => {
  const s = subscriptionSummary({ monthlyFee: 1000, billingStart: "2026-12" }, [], "2026-10");
  assert.equal(s.currentStatus, "not_started");
  assert.equal(s.months.length, 0);
  assert.equal(s.outstanding, 0);
});

test("a free restaurant never owes", () => {
  const s = subscriptionSummary({ monthlyFee: 0, billingStart: "2026-01" }, [], "2026-03");
  assert.equal(s.currentStatus, "free");
  assert.equal(s.outstanding, 0);
  assert.deepEqual(s.overdueMonths, []);
});
