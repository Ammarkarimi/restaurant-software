import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInWords, numberToWords } from "../words";

test("numbers in Indian words", () => {
  assert.equal(numberToWords(0), "Zero");
  assert.equal(numberToWords(15), "Fifteen");
  assert.equal(numberToWords(105), "One Hundred Five");
  assert.equal(numberToWords(14301), "Fourteen Thousand Three Hundred One");
  assert.equal(numberToWords(128296), "One Lakh Twenty Eight Thousand Two Hundred Ninety Six");
  assert.equal(numberToWords(25000000), "Two Crore Fifty Lakh");
});

test("amount in words with paise", () => {
  assert.equal(amountInWords(9520), "Rupees Nine Thousand Five Hundred Twenty Only");
  assert.equal(amountInWords(8746.5), "Rupees Eight Thousand Seven Hundred Forty Six and Fifty Paise Only");
  assert.equal(amountInWords(100, "USD"), "USD One Hundred Only");
});
