import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BILL_TEMPLATE, PAPER_OPTIONS, PAPER_SIZES, paperSpec, parseBillTemplate, slipSpec, type BillTemplate } from "../bill-template";

const spec = (p: Partial<BillTemplate>) => paperSpec({ ...DEFAULT_BILL_TEMPLATE, ...p });

test("the original three paper sizes keep their saved value and page rule", () => {
  // Saved designs from before custom sizes still load unchanged.
  for (const size of ["80mm", "58mm", "a4"] as const) assert.equal(parseBillTemplate(JSON.stringify({ paperSize: size })).paperSize, size);
  assert.equal(parseBillTemplate("{}").paperSize, "80mm");
  assert.equal(spec({ paperSize: "80mm" }).pageCss, "@page { size: 80mm auto; margin: 0; }");
  assert.equal(spec({ paperSize: "58mm" }).pageCss, "@page { size: 58mm auto; margin: 0; }");
  assert.deepEqual(spec({ paperSize: "a4" }), { layout: "page", paperMm: 214, widthMm: 190, autoWidthMm: 190, padding: "0", narrow: false, pageCss: "@page { size: A4; margin: 12mm; }" });
  assert.equal(slipSpec({ ...DEFAULT_BILL_TEMPLATE, paperSize: "58mm" }).paper, "58mm");
  assert.equal(slipSpec({ ...DEFAULT_BILL_TEMPLATE, paperSize: "a4" }).paper, "80mm");
});

test("a roll bill fits the printer's print area, not the whole paper", () => {
  // Thermal printers can't print the outer ~4 mm of the roll: text laid out 80 mm wide got cut at both edges.
  assert.deepEqual([spec({ paperSize: "80mm" }).paperMm, spec({ paperSize: "80mm" }).widthMm], [80, 72]);
  assert.deepEqual([spec({ paperSize: "58mm" }).widthMm, spec({ paperSize: "58mm" }).narrow], [48, true]);
  assert.equal(spec({ paperSize: "roll80x297" }).widthMm, 72);
  assert.equal(spec({ paperSize: "roll58x3276" }).widthMm, 48);
  assert.equal(spec({ paperSize: "custom", customPaperWidth: 76 }).widthMm, 68);
  // The owner can set their printer's own print area; it can't be wider than the paper.
  assert.equal(spec({ paperSize: "80mm", printWidth: 70 }).widthMm, 70);
  assert.equal(spec({ paperSize: "80mm", printWidth: 76.5 }).widthMm, 76.5);
  assert.equal(spec({ paperSize: "58mm", printWidth: 75 }).widthMm, 58);
  assert.equal(spec({ paperSize: "80mm", printWidth: 0 }).widthMm, 72, "0 = automatic");
  assert.equal(spec({ paperSize: "a4", printWidth: 70 }).widthMm, 190, "full pages ignore it");
  // Kitchen tickets and the day summary use the same print area.
  assert.deepEqual(slipSpec({ ...DEFAULT_BILL_TEMPLATE, paperSize: "80mm" }), { paper: "80mm", widthMm: 72, width: "72mm", padding: "0 1mm" });
  assert.equal(slipSpec({ ...DEFAULT_BILL_TEMPLATE, paperSize: "58mm", printWidth: 50 }).width, "50mm");
  assert.equal(slipSpec({ ...DEFAULT_BILL_TEMPLATE, paperSize: "a4" }).width, "72mm");
  assert.equal(parseBillTemplate(JSON.stringify({ printWidth: -4 })).printWidth, 0);
});

test("printer-driver paper sizes", () => {
  assert.equal(spec({ paperSize: "letter" }).layout, "page");
  assert.equal(spec({ paperSize: "letter" }).pageCss, "@page { size: letter; margin: 12mm; }");
  assert.deepEqual([spec({ paperSize: "postcard" }).paperMm, spec({ paperSize: "postcard" }).widthMm, spec({ paperSize: "postcard" }).pageCss], [100, 92, "@page { size: 100mm 148mm; margin: 0; }"]);
  assert.equal(spec({ paperSize: "roll58x297" }).pageCss, "@page { size: 58mm 297mm; margin: 0; }");
  assert.equal(spec({ paperSize: "roll80x3276" }).pageCss, "@page { size: 80mm 3276mm; margin: 0; }");
  assert.equal(slipSpec({ ...DEFAULT_BILL_TEMPLATE, paperSize: "roll58x3276" }).paper, "58mm");
  assert.equal(slipSpec({ ...DEFAULT_BILL_TEMPLATE, paperSize: "roll80x297" }).paper, "80mm");
  assert.deepEqual(PAPER_OPTIONS.map(([v]) => v).sort(), [...PAPER_SIZES].sort(), "every size is offered");
});

test("custom paper", () => {
  assert.deepEqual(spec({ paperSize: "custom", customPaperWidth: 76, customPaperHeight: 0 }), { layout: "receipt", paperMm: 76, widthMm: 68, autoWidthMm: 68, padding: "0 1mm", narrow: false, pageCss: "@page { margin: 0; }" });
  assert.equal(spec({ paperSize: "custom", customPaperWidth: 57, customPaperHeight: 200 }).pageCss, "@page { size: 57mm 200mm; margin: 0; }");
  assert.ok(spec({ paperSize: "custom", customPaperWidth: 57 }).narrow);
  const wide = spec({ paperSize: "custom", customPaperWidth: 182, customPaperHeight: 257 }); // B5
  assert.deepEqual([wide.layout, wide.widthMm, wide.pageCss], ["page", 158, "@page { size: 182mm 257mm; margin: 12mm; }"]);
  // Bad saved values fall back to safe defaults.
  const t = parseBillTemplate(JSON.stringify({ paperSize: "custom", customPaperWidth: 5, customPaperHeight: -3 }));
  assert.deepEqual([t.customPaperWidth, t.customPaperHeight], [80, 0]);
  assert.equal(parseBillTemplate(JSON.stringify({ paperSize: "B9" })).paperSize, "80mm");
});

test("a design saved from an older screen, without the custom size fields, is still accepted", async () => {
  const { billTemplateSchema } = await import("../bill-template");
  const { customPaperWidth: _w, customPaperHeight: _h, printWidth: _p, ...old } = DEFAULT_BILL_TEMPLATE;
  const r = billTemplateSchema.safeParse({ ...old, paperSize: "58mm" });
  assert.ok(r.success);
  assert.deepEqual([r.data.customPaperWidth, r.data.customPaperHeight], [80, 0]);
});
