"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, Download, FileSpreadsheet, Sparkles, Trash2, Upload } from "lucide-react";
import { Button, Field, Input, Modal, Tabs, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { FoodMark } from "@/components/food-mark";
import { api } from "@/lib/client";
import { parseCsv, rowsFromSheet, type ImportRow } from "@/lib/menu-import";
import { cn, formatCurrency } from "@/lib/utils";
import type { CategoryDTO } from "@/lib/types";

type Mode = "excel" | "photo" | "paste";
type Row = ImportRow & { duplicate?: boolean };
interface Preview {
  rows: Row[];
  errors: string[];
  note?: string;
}

const SAMPLE = [
  ["Category", "Item name", "Price", "Half", "Full", "Veg / Non-veg", "Short code", "Description"],
  ["Starters", "Paneer Tikka", 280, "", "", "veg", "PT", "Cottage cheese grilled in the tandoor"],
  ["Starters", "Chicken 65", 320, "", "", "non-veg", "C65", ""],
  ["Main course", "Dal Makhani", "", 180, 260, "veg", "DM", ""],
  ["Main course", "Butter Chicken", "", 240, 380, "non-veg", "BC", ""],
  ["Breads", "Butter Naan", 60, "", "", "veg", "BN", ""],
  ["Beverages", "Masala Chai", 40, "", "", "veg", "MC", ""],
];

function downloadSample() {
  const csv = SAMPLE.map((r) => r.map((c) => (/[",]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "menu-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Shrinks a phone photo so a few pages fit in one upload and read faster. */
async function shrinkPhoto(file: File): Promise<{ mediaType: "image/jpeg"; data: string; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.82);
  return { mediaType: "image/jpeg", data: url.split(",")[1], preview: url };
}

export function ImportDialog({ categories, onClose, onSaved }: { categories: CategoryDTO[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [mode, setMode] = useState<Mode>("excel");
  const [defaultCategory, setDefaultCategory] = useState(categories[0]?.name ?? "Main course");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState("");
  const [photos, setPhotos] = useState<Array<{ mediaType: "image/jpeg"; data: string; preview: string }>>([]);
  const [photoReady, setPhotoReady] = useState<boolean | null>(null);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ ready: boolean }>("/api/menu/import/photo").then((r) => setPhotoReady(r.ready), () => setPhotoReady(false));
  }, []);

  // Check pasted lines (and mark dishes already on the menu) as the owner types.
  useEffect(() => {
    if (mode !== "paste") return;
    if (!text.trim()) return setPreview(null);
    const t = setTimeout(() => {
      api<Preview>("/api/menu/import", { body: { text, defaultCategory, dryRun: true } }).then(setPreview, () => setPreview(null));
    }, 400);
    return () => clearTimeout(t);
  }, [text, defaultCategory, mode]);

  async function check(rows: ImportRow[], errors: string[], note?: string) {
    const r = await api<Preview>("/api/menu/import", { body: { rows, defaultCategory, dryRun: true } });
    setPreview({ rows: r.rows, errors, note });
  }

  async function readFile(file: File) {
    setReading(true);
    setPreview(null);
    setFileName(file.name);
    try {
      let cells: Array<Array<string | number | boolean | Date | null>>;
      if (/\.csv$|\.txt$/i.test(file.name)) cells = parseCsv(await file.text());
      else if (/\.xlsx$/i.test(file.name)) {
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        const sheets = await readXlsxFile(file);
        // Use the sheet with the most filled rows (some files have a cover sheet first).
        cells = (sheets.sort((a, b) => b.data.length - a.data.length)[0]?.data ?? []).map((r) => r.map((c) => (typeof c === "function" ? null : c)));
      } else if (/\.xls$/i.test(file.name)) {
        throw new Error("This is an old Excel file (.xls). Open it in Excel and use File → Save As → Excel Workbook (.xlsx), or save it as CSV.");
      } else throw new Error("Choose an Excel (.xlsx) or CSV file.");
      const result = rowsFromSheet(cells, defaultCategory);
      setColumns(result.columns);
      if (!result.rows.length) throw new Error(result.errors[0] ?? "No dishes with prices were found in this file.");
      await check(result.rows, result.errors.slice(0, 20));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function addPhotos(files: FileList) {
    const list = [...files].slice(0, 4 - photos.length);
    try {
      const shrunk = await Promise.all(list.map(shrinkPhoto));
      setPhotos((p) => [...p, ...shrunk].slice(0, 4));
      setPreview(null);
    } catch {
      toast("That photo could not be opened. Please use a JPG or PNG photo.", "error");
    }
    if (photoInput.current) photoInput.current.value = "";
  }

  async function readPhotos() {
    setReading(true);
    setPreview(null);
    try {
      const r = await api<{ rows: ImportRow[]; note: string }>("/api/menu/import/photo", { body: { photos: photos.map(({ mediaType, data }) => ({ mediaType, data })) } });
      await check(r.rows, [], r.note || undefined);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setReading(false);
    }
  }

  const fresh = preview?.rows.filter((r) => !r.duplicate) ?? [];
  const skipped = (preview?.rows.length ?? 0) - fresh.length;

  function edit(i: number, patch: Partial<Row>) {
    setPreview((p) => (p ? { ...p, rows: p.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : p));
  }

  async function add() {
    setSaving(true);
    try {
      const body = mode === "paste" ? { text, defaultCategory } : { rows: fresh.map(({ duplicate: _d, ...r }) => r), defaultCategory, source: mode };
      const r = await api<{ added: number }>("/api/menu/import", { body });
      toast(`${r.added} dishes added${skipped ? ` · ${skipped} already on the menu were skipped` : ""}`);
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import your menu"
      description="Add your whole menu at once from an Excel sheet, a photo of the menu card, or pasted lines. You check the list before anything is added."
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!fresh.length} onClick={add}>
            Add {fresh.length} dishes
          </Button>
        </>
      }
    >
      <Tabs<Mode>
        className="mb-4"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setPreview(null);
        }}
        tabs={[
          { value: "excel", label: <><FileSpreadsheet className="h-4 w-4" /> Excel / CSV file</> },
          { value: "photo", label: <><Camera className="h-4 w-4" /> Menu photo</> },
          { value: "paste", label: <><ClipboardPaste className="h-4 w-4" /> Paste lines</> },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {mode === "excel" && (
            <>
              <Tip>
                Any sheet with a header row works: <b>Item name</b> and <b>Price</b> are needed; <b>Category</b>, <b>Veg / Non-veg</b>, <b>Short code</b> and <b>Description</b> are read when present.
                Columns named <b>Half</b> and <b>Full</b> (or Small / Large) become portions. Exports from other billing software usually work as they are.
              </Tip>
              <input ref={fileInput} type="file" accept=".xlsx,.csv,.txt,.xls" className="hidden" aria-label="Menu file" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-8 text-slate-600 transition hover:border-primary-400 hover:bg-primary-50/40"
              >
                <Upload className="h-7 w-7 text-primary-600" />
                <span className="font-semibold">{reading ? "Reading…" : fileName ? `Choose another file (now: ${fileName})` : "Choose your Excel or CSV file"}</span>
                <span className="text-xs text-slate-500">.xlsx or .csv</span>
              </button>
              <button type="button" onClick={downloadSample} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline">
                <Download className="h-4 w-4" /> Download a sample sheet
              </button>
              {columns && <p className="text-xs text-slate-500">{columns}</p>}
            </>
          )}
          {mode === "photo" && (
            <>
              {photoReady === false ? (
                <Tip tone="warning">Reading menus from photos is not switched on for your account yet. Ask your software provider to switch it on. Meanwhile you can use an Excel file or paste lines.</Tip>
              ) : (
                <Tip>
                  <Sparkles className="mr-1 inline h-4 w-4" />
                  Take a straight, well-lit photo of each page of your printed menu card (up to 4 pages at a time). The dishes, prices, portions and veg / non-veg marks are read for you. Always check prices before adding.
                </Tip>
              )}
              <input ref={photoInput} type="file" accept="image/*" multiple className="hidden" aria-label="Menu photos" onChange={(e) => e.target.files && addPhotos(e.target.files)} />
              <div className="grid grid-cols-4 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt={`Menu page ${i + 1}`} className="aspect-[3/4] w-full rounded-lg object-cover ring-1 ring-slate-200" />
                    <button type="button" aria-label={`Remove page ${i + 1}`} onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-slate-600 shadow">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <button type="button" disabled={photoReady === false} onClick={() => photoInput.current?.click()} className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-primary-400 disabled:opacity-50">
                    <Camera className="h-5 w-5" /> {photos.length ? "Add page" : "Add photo"}
                  </button>
                )}
              </div>
              <Button className="w-full" disabled={!photos.length || photoReady === false} loading={reading} onClick={readPhotos}>
                <Sparkles className="h-4 w-4" /> {reading ? "Reading the menu… (up to a minute)" : "Read dishes from photos"}
              </Button>
            </>
          )}
          {mode === "paste" && (
            <>
              <Tip>
                One dish per line: <b>name, price, category, veg / non-veg / egg, short code</b>. Only name and price are needed. You can copy columns straight from Excel.
                <br />
                <span className="font-mono text-xs">Paneer Tikka, 280, Starters, veg, PT</span>
              </Tip>
              <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Paneer Tikka, 280, Starters, veg\nChicken 65, 320, Starters, non-veg\nMasala Dosa, 120"} className="font-mono text-sm" aria-label="Dishes to add" />
            </>
          )}
          <Field label="Category when a dish has none">
            <Input value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} list="import-categories" />
          </Field>
          <datalist id="import-categories">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Check before adding {preview && <span className="font-normal text-slate-500">· {fresh.length} new{skipped ? `, ${skipped} already on the menu` : ""}</span>}
          </p>
          {!preview ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">The dishes appear here. You can fix a name or price before adding.</p>
          ) : (
            <div className="space-y-2">
              {preview.note && <Tip tone="warning">Could not read: {preview.note}</Tip>}
              {preview.errors.map((e) => (
                <p key={e} className="text-sm text-red-700">{e}</p>
              ))}
              <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {preview.rows.map((r, i) => (
                  <li key={i} className={cn("flex items-center gap-2 px-3 py-1.5 text-sm", r.duplicate && "bg-slate-50 text-slate-400")}>
                    <button
                      type="button"
                      title="Change veg / non-veg"
                      disabled={mode === "paste" || r.duplicate}
                      onClick={() => edit(i, { foodType: r.foodType === "veg" ? "non_veg" : r.foodType === "non_veg" ? "egg" : "veg" })}
                    >
                      <FoodMark type={r.foodType} />
                    </button>
                    {mode === "paste" || r.duplicate ? (
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    ) : (
                      <input aria-label="Dish name" value={r.name} onChange={(e) => edit(i, { name: e.target.value })} className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-primary-400 focus:outline-none" />
                    )}
                    <span className="hidden max-w-[8rem] truncate text-xs text-slate-500 sm:inline">{r.category}</span>
                    {r.duplicate ? (
                      <span className="text-xs">already on menu</span>
                    ) : r.variants?.length ? (
                      <span className="text-xs text-slate-600">{r.variants.map((v) => `${v.name} ${formatCurrency(v.price)}`).join(" · ")}</span>
                    ) : mode === "paste" ? (
                      <b className="text-slate-800">{formatCurrency(r.price)}</b>
                    ) : (
                      <input aria-label={`Price of ${r.name}`} type="number" min={0} value={r.price} onChange={(e) => edit(i, { price: Number(e.target.value) })} className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-right font-semibold" />
                    )}
                    {mode !== "paste" && !r.duplicate && (
                      <button type="button" aria-label={`Leave out ${r.name}`} onClick={() => setPreview((p) => (p ? { ...p, rows: p.rows.filter((_, j) => j !== i) } : p))} className="text-slate-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
