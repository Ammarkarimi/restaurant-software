import { test } from "node:test";
import assert from "node:assert/strict";
import { billSeries, buildGstr1, gstDate, placeOfSupply, tallyVouchers, voucherEntries, type AccountingBill } from "../accounting";

const bill = (p: Partial<AccountingBill>): AccountingBill => ({
  billNumber: "B1",
  date: "2026-10-05",
  total: 1050,
  taxable: 1000,
  tax: 50,
  roundOff: 0,
  taxLines: [{ rate: 5, taxable: 1000, tax: 50 }],
  payments: [{ method: "cash", amount: 1050 }],
  customerGstin: null,
  customerName: null,
  source: "counter",
  taxMode: "gst",
  ...p,
});

test("place of supply and dates in the GST tool's style", () => {
  assert.equal(placeOfSupply("27AAPFU0939F1ZV"), "27-Maharashtra");
  assert.equal(placeOfSupply(null), null);
  assert.equal(gstDate("2026-11-05"), "05-Nov-2026");
});

test("GSTR-1: B2C by rate, B2B per invoice, apps kept apart, HSN and documents", () => {
  const g = buildGstr1(
    [
      bill({ billNumber: "B1" }),
      bill({ billNumber: "B2", total: 525, taxable: 500, tax: 25, taxLines: [{ rate: 5, taxable: 500, tax: 25 }] }),
      bill({ billNumber: "B3", customerGstin: "29ABCDE1234F1Z5", customerName: "Acme" }),
      bill({ billNumber: "B4", source: "zomato" }),
    ],
    { gstin: "27AAPFU0939F1ZV", sacCode: "996331", cancelled: ["B5"], allBillNumbers: ["B1", "B2", "B3", "B4", "B5"] }
  );
  assert.deepEqual(g.b2cs[1], ["OE", "27-Maharashtra", "", 5, 1500, 0, ""]);
  assert.equal(g.b2b.length, 2);
  assert.deepEqual(g.b2b[1].slice(0, 7), ["29ABCDE1234F1Z5", "Acme", "B3", "05-Oct-2026", 1050, "27-Maharashtra", "N"]);
  assert.deepEqual(g.hsn[1], ["996331", "Restaurant service", "NA", 0, 2625, 5, 2500, 0, 62.5, 62.5, 0]);
  assert.deepEqual(g.docs[1], ["Invoices for outward supply", "B1", "B5", 5, 1]);
  assert.equal(g.summary.ecoBills, 1);
  assert.equal(g.eco.length, 2);
});

test("bill series by prefix", () => {
  const s = billSeries(["A-9", "A-10", "B-1", "A-11"]);
  assert.deepEqual(s.map((x) => [x.from, x.to, x.numbers.size]), [["A-9", "A-11", 3], ["B-1", "B-1", 1]]);
});

test("Tally voucher balances: payments = sales + CGST + SGST + round off", () => {
  const e = voucherEntries([bill({ total: 1050, payments: [{ method: "cash", amount: 600 }, { method: "upi", amount: 450 }] }), bill({ total: 263, taxable: 250, tax: 12.5, roundOff: 0.5, payments: [{ method: "online", amount: 263 }], source: "swiggy" })], true);
  assert.equal(Math.round(e.reduce((s, x) => s + x.amount, 0) * 100), 0);
  const by = Object.fromEntries(e.map((x) => [x.ledger, x.amount]));
  assert.deepEqual(by, { Cash: -600, "UPI Collections": -450, Swiggy: -263, "Restaurant Sales": 1250, "Output CGST": 31.25, "Output SGST": 31.25, "Round Off": 0.5 });
  const x = tallyVouchers([bill({}), bill({ billNumber: "B2", date: "2026-10-06" })], { company: "Spice & Co", perBill: false, gst: true });
  assert.equal((x.match(/<VOUCHER /g) ?? []).length, 2);
  assert.match(x, /<SVCURRENTCOMPANY>Spice &amp; Co<\/SVCURRENTCOMPANY>/);
  assert.match(x, /<DATE>20261005<\/DATE>/);
});
