import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BILL_TEMPLATE, PAPER_OPTIONS, PAPER_SIZES, paperSpec, parseBillTemplate, slipWidth, type BillTemplate } from "../bill-template";

const spec = (p: Partial<BillTemplate>) => paperSpec({ ...DEFAULT_BILL_TEMPLATE, ...p });

test("the original three paper sizes print exactly as before", () => {
  // Saved designs from before custom sizes still load unchanged.
  for (const size of ["80mm", "58mm", "a4"] as const) assert.equal(parseBillTemplate(JSON.stringify({ paperSize: size })).paperSize, size);
  assert.equal(parseBillTemplate("{}").paperSize, "80mm");
  assert.deepEqual(spec({ paperSize: "80mm" }), { layout: "receipt", widthMm: 80, padding: "3mm", narrow: false, pageCss: "@page { size: 80mm auto; margin: 0; }" });
  assert.deepEqual(spec({ paperSize: "58mm" }), { layout: "receipt", widthMm: 58, padding: "2mm", narrow: true, pageCss: "@page { size: 58mm auto; margin: 0; }" });
  assert.deepEqual(spec({ paperSize: "a4" }), { layout: "page", widthMm: 190, padding: "0", narrow: false, pageCss: "@page { size: A4; margin: 12mm; }" });
  assert.equal(slipWidth({ ...DEFAULT_BILL_TEMPLATE, paperSize: "58mm" }), "58mm");
  assert.equal(slipWidth({ ...DEFAULT_BILL_TEMPLATE, paperSize: "a4" }), "80mm");
});

test("printer-driver paper sizes", () => {
  assert.equal(spec({ paperSize: "letter" }).layout, "page");
  assert.equal(spec({ paperSize: "letter" }).pageCss, "@page { size: letter; margin: 12mm; }");
  assert.deepEqual([spec({ paperSize: "postcard" }).widthMm, spec({ paperSize: "postcard" }).pageCss], [100, "@page { size: 100mm 148mm; margin: 0; }"]);
  assert.equal(spec({ paperSize: "roll58x297" }).pageCss, "@page { size: 58mm 297mm; margin: 0; }");
  assert.equal(spec({ paperSize: "roll80x3276" }).pageCss, "@page { size: 80mm 3276mm; margin: 0; }");
  assert.equal(slipWidth({ ...DEFAULT_BILL_TEMPLATE, paperSize: "roll58x3276" }), "58mm");
  assert.equal(slipWidth({ ...DEFAULT_BILL_TEMPLATE, paperSize: "roll80x297" }), "80mm");
  assert.deepEqual(PAPER_OPTIONS.map(([v]) => v).sort(), [...PAPER_SIZES].sort(), "every size is offered");
});

test("custom paper", () => {
  assert.deepEqual(spec({ paperSize: "custom", customPaperWidth: 76, customPaperHeight: 0 }), { layout: "receipt", widthMm: 76, padding: "3mm", narrow: false, pageCss: "@page { margin: 0; }" });
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
  const { customPaperWidth: _w, customPaperHeight: _h, ...old } = DEFAULT_BILL_TEMPLATE;
  const r = billTemplateSchema.safeParse({ ...old, paperSize: "58mm" });
  assert.ok(r.success);
  assert.deepEqual([r.data.customPaperWidth, r.data.customPaperHeight], [80, 0]);
});
