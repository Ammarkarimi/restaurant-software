import { test } from "node:test";
import assert from "node:assert/strict";
import { offerProblem, offerValue, type OfferData } from "../offers";
import { calculateBill, discountAmount } from "../billing";

const offer = (p: Partial<OfferData>): OfferData => ({
  id: "o1",
  name: "Offer",
  code: null,
  type: "percent",
  value: 10,
  maxDiscount: null,
  minBill: 0,
  orderTypes: "[]",
  days: "[]",
  startTime: null,
  endTime: null,
  validFrom: null,
  validTo: null,
  active: true,
  timesUsed: 0,
  ...p,
});
const ctx = { itemsTotal: 1200, type: "dine_in", timezone: "Asia/Kolkata", today: "2026-10-28", at: new Date("2026-10-28T07:00:00Z") }; // Wed 12:30

test("an offer explains why it cannot be used", () => {
  assert.equal(offerProblem(offer({}), ctx), null);
  assert.match(offerProblem(offer({ minBill: 1500 }), ctx)!, /Needs a bill of/);
  assert.match(offerProblem(offer({ orderTypes: '["delivery"]' }), ctx)!, /Only for Delivery/);
  assert.match(offerProblem(offer({ validTo: "2026-10-01" }), ctx)!, /ended/);
  assert.match(offerProblem(offer({ validFrom: "2026-11-01" }), ctx)!, /starts/);
  assert.equal(offerProblem(offer({ days: "[1,2,3,4,5]", startTime: "12:00", endTime: "15:30" }), ctx), null);
  assert.match(offerProblem(offer({ days: "[0,6]" }), ctx)!, /Only Sun, Sat/);
  assert.match(offerProblem(offer({ active: false }), ctx)!, /switched off/);
});

test("percent offers can be capped, and the cap flows into the bill", () => {
  assert.equal(discountAmount(3000, { type: "percent", value: 10, max: 200 }), 200);
  assert.equal(discountAmount(1500, { type: "percent", value: 10, max: 200 }), 150);
  assert.equal(discountAmount(1500, { type: "amount", value: 50, max: 10 }), 50); // the cap is only for percent
  const t = calculateBill([{ price: 1000, quantity: 3, taxRate: 5 }], { taxMode: "gst", pricesIncludeTax: false, serviceChargePercent: 0, roundOff: false }, { type: "percent", value: 10, max: 200 });
  assert.equal(t.discount, 200);
  assert.equal(t.total, 2940); // (3000 − 200) × 1.05
  assert.equal(offerValue({ type: "percent", value: 10, maxDiscount: 200 }), "10% off, up to ₹200");
});
