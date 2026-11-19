import { test } from "node:test";
import assert from "node:assert/strict";
import { giftCardProblem, newGiftCode, normalizeGiftCode } from "../gift-cards";

test("gift card codes are easy to read out and type", () => {
  for (let i = 0; i < 50; i++) assert.match(newGiftCode(), /^GC-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  assert.equal(normalizeGiftCode("gc 7k3m 9q2p"), "GC-7K3M-9Q2P");
  assert.equal(normalizeGiftCode("7K3M9Q2P"), "GC-7K3M-9Q2P");
  assert.equal(normalizeGiftCode(" GC-7K3M-9Q2P "), "GC-7K3M-9Q2P");
});

test("a card can't pay when cancelled, expired, empty or short", () => {
  const card = { status: "active", balance: 500, expiresOn: "2026-12-31" };
  assert.equal(giftCardProblem(card, "2026-11-14", 500), null);
  assert.match(giftCardProblem(card, "2026-11-14", 600)!, /only 500/);
  assert.match(giftCardProblem(card, "2027-01-01")!, /expired/);
  assert.match(giftCardProblem({ ...card, status: "cancelled" }, "2026-11-14")!, /cancelled/);
  assert.match(giftCardProblem({ ...card, balance: 0 }, "2026-11-14")!, /nothing left/);
  assert.equal(giftCardProblem({ ...card, expiresOn: null }, "2030-01-01"), null);
});
