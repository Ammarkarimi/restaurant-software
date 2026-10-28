"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ClipboardList, Download, History, PackagePlus, Pencil, Plus, Scale, Trash2, Warehouse } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, StatCard, Tabs, Textarea, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { FoodMark } from "@/components/food-mark";
import { api } from "@/lib/client";
import { addDays } from "@/lib/dates";
import { parseVariants } from "@/lib/menu";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import type { CategoryDTO } from "@/lib/types";
import { CostingTab, PurchasesTab, SuppliersTab } from "./purchases-tab";

type Tab = "stock" | "purchases" | "suppliers" | "recipes" | "costing" | "history" | "usage";
const TAB_LIST: Tab[] = ["stock", "purchases", "suppliers", "recipes", "costing", "history", "usage"];

interface StockItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  lowAt: number | null;
  costPerUnit: number;
  active: boolean;
  low: boolean;
  usedIn: number;
}

interface Entry {
  id: string;
  type: string;
  quantity: number;
  balance: number;
  cost: number | null;
  supplier: string | null;
  note: string | null;
  date: string;
  createdByName: string;
  createdAt: string;
  stockItem: { name: string; unit: string };
}

const UNITS = ["kg", "g", "L", "ml", "pcs", "dozen", "pack", "box", "bottle"];
const ENTRY_LABEL: Record<string, string> = {
  purchase: "Purchase",
  used: "Used in bill",
  returned: "Bill cancelled",
  wastage: "Wastage",
  count: "Stock count",
};
const qty = (n: number) => String(Math.round(n * 1000) / 1000);

function ItemDialog({ item, onSaved, onClose }: { item: StockItem | null; onSaved: () => void; onClose: () => void }) {
  const { toast } = useApp();
  const [form, setForm] = useState({
    name: item?.name ?? "",
    unit: item?.unit ?? "kg",
    quantity: "",
    lowAt: item?.lowAt === null || item?.lowAt === undefined ? "" : String(item.lowAt),
    costPerUnit: item?.costPerUnit ? String(item.costPerUnit) : "",
    active: item?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = { name: form.name, unit: form.unit, lowAt: form.lowAt === "" ? null : Number(form.lowAt), costPerUnit: Number(form.costPerUnit) || 0 };
    try {
      if (item) await api(`/api/stock/${item.id}`, { method: "PATCH", body: { ...body, active: form.active } });
      else await api("/api/stock", { body: { ...body, quantity: Number(form.quantity) || 0 } });
      toast(item ? "Stock item saved" : `${form.name} added`);
      onSaved();
    } catch (err) {
      toast((err as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={item ? `Edit ${item.name}` : "Add a stock item"} description={item ? undefined : "Something you buy and use in dishes: paneer, oil, chicken, milk, cups…"}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} required maxLength={80} autoFocus />
        </Field>
        <Field label="Unit" hint="Recipes and purchases use this unit">
          <Select value={form.unit} onChange={(e) => set({ unit: e.target.value })}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Select>
        </Field>
        {!item && (
          <Field label={`In stock now (${form.unit})`} optional>
            <Input type="number" min={0} step="0.001" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
          </Field>
        )}
        <Field label={`Warn when stock is at or below (${form.unit})`} optional hint="Shows a low-stock warning">
          <Input type="number" min={0} step="0.001" value={form.lowAt} onChange={(e) => set({ lowAt: e.target.value })} />
        </Field>
        <Field label={`Cost per ${form.unit}`} optional hint="Updated by purchases; used for the stock value">
          <Input type="number" min={0} step="0.01" value={form.costPerUnit} onChange={(e) => set({ costPerUnit: e.target.value })} />
        </Field>
        {item && (
          <div className="sm:col-span-2">
            <Toggle checked={form.active} onChange={(v) => set({ active: v })} label="In use" description="Switch off for things you no longer buy. History is kept." />
          </div>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{item ? "Save" : "Add item"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function QuickAddDialog({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const { toast } = useApp();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, unit, quantity, lowAt, cost] = l.split(l.includes("\t") ? "\t" : ",").map((c) => c.trim());
      return { name, unit: UNITS.includes(unit) ? unit : "kg", quantity: Number(quantity) || 0, lowAt: lowAt ? Number(lowAt) : null, costPerUnit: Number(cost) || 0 };
    })
    .filter((r) => r.name);
  async function save() {
    setSaving(true);
    try {
      const r = await api<{ added: number; skipped: number }>("/api/stock", { body: { items: rows } });
      toast(`${r.added} item(s) added${r.skipped ? `, ${r.skipped} already there` : ""}`);
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
      title="Add many stock items"
      description="One per line: name, unit, in stock now, warn at, cost per unit. Or copy columns from Excel."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={rows.length === 0} onClick={save}>Add {rows.length || ""} items</Button>
        </>
      }
    >
      <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Paneer, kg, 5, 2, 320\nCooking oil, L, 15, 5, 140\nChicken, kg, 10, 3, 240\nMilk, L, 8, 2, 60"} autoFocus />
      <p className="mt-2 text-sm text-slate-500">Units: {UNITS.join(", ")}</p>
    </Modal>
  );
}

function EntryDialog({ item, type, onSaved, onClose }: { item: StockItem; type: "purchase" | "wastage" | "count"; onSaved: () => void; onClose: () => void }) {
  const { toast } = useApp();
  const [quantity, setQuantity] = useState(type === "count" ? qty(item.quantity) : "");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [paidFromTill, setPaidFromTill] = useState(false);
  const [saving, setSaving] = useState(false);
  const titles = { purchase: `Purchase · ${item.name}`, wastage: `Wastage · ${item.name}`, count: `Count · ${item.name}` };
  const n = Number(quantity) || 0;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/stock/entries", { body: { stockItemId: item.id, type, quantity: n, cost: cost ? Number(cost) : null, supplier: supplier || null, note: note || null, paidFromTill } });
      toast(type === "purchase" ? "Purchase saved" : type === "wastage" ? "Wastage saved" : "Stock count saved");
      onSaved();
    } catch (err) {
      toast((err as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={titles[type]} description={`In stock now: ${qty(item.quantity)} ${item.unit}`} size="sm">
      <form onSubmit={save} className="space-y-4">
        <Field label={type === "count" ? `Actually there now (${item.unit})` : `How much (${item.unit})`} hint={type === "count" && quantity !== "" ? `Difference: ${n - item.quantity >= 0 ? "+" : ""}${qty(n - item.quantity)} ${item.unit}` : undefined}>
          <Input type="number" min={0} step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} required autoFocus />
        </Field>
        {type === "purchase" && (
          <>
            <Field label="Total paid" optional hint={n > 0 && Number(cost) > 0 ? `${formatCurrency(Number(cost) / n)} per ${item.unit}` : undefined}>
              <Input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </Field>
            <Field label="Supplier" optional>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={100} />
            </Field>
            {Number(cost) > 0 && <Toggle checked={paidFromTill} onChange={setPaidFromTill} label="Paid in cash from the till" description="Also saves it as today's expense, so the cash drawer adds up." />}
          </>
        )}
        <Field label="Note" optional>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={type === "wastage" ? "e.g. spoiled, spilled, burnt" : undefined} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function StockTab({ onHistory }: { onHistory: (id: string) => void }) {
  const { toast, confirm } = useApp();
  const [data, setData] = useState<{ items: StockItem[]; stats: { count: number; low: number; value: number } } | null>(null);
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [dialog, setDialog] = useState<{ kind: "item"; item: StockItem | null } | { kind: "quick" } | { kind: "entry"; item: StockItem; type: "purchase" | "wastage" | "count" } | null>(null);

  const load = useCallback(() => {
    api<{ items: StockItem[]; stats: { count: number; low: number; value: number } }>("/api/stock").then(setData, (e) => toast(e.message, "error"));
  }, [toast]);
  useEffect(() => load(), [load]);

  async function remove(item: StockItem) {
    const ok = await confirm({ title: `Delete ${item.name}?`, message: "Its history and recipe lines are removed too. To keep history, edit it and switch off “In use” instead.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/stock/${item.id}`, { method: "DELETE" });
      toast("Deleted");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  if (!data) return <Loading />;
  const shown = data.items.filter((i) => (!lowOnly || i.low) && (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())));
  const done = () => {
    setDialog(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard title="Stock items" value={data.stats.count} icon={<Warehouse className="h-5 w-5" />} tone="primary" />
        <StatCard title="Running low" value={data.stats.low} icon={<AlertTriangle className="h-5 w-5" />} tone={data.stats.low ? "red" : "slate"} onClick={() => setLowOnly((v) => !v)} subtitle={lowOnly ? "Showing low only — tap to show all" : "Tap to show only these"} />
        <StatCard title="Stock value" value={formatCurrency(data.stats.value)} subtitle="At the last purchase price" tone="green" />
      </div>
      <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stock" className="sm:max-w-xs" aria-label="Search stock" />
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="outline" onClick={() => setDialog({ kind: "quick" })}>
            <ClipboardList className="h-4 w-4" /> Add many
          </Button>
          <Button onClick={() => setDialog({ kind: "item", item: null })}>
            <Plus className="h-4 w-4" /> Add stock item
          </Button>
        </div>
      </Card>

      {data.items.length === 0 ? (
        <EmptyState
          icon={<Warehouse className="h-6 w-6" />}
          title="No stock items yet"
          description="Add what you buy (paneer, oil, chicken…). Then add recipes to dishes, and every paid bill takes the ingredients out of stock."
        />
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-slate-500">Nothing matches.</p>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {shown.map((i) => (
              <li key={i.id} className={cn("flex flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center", !i.active && "opacity-50")}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    {i.name}
                    {i.low && <Badge variant="danger">Low</Badge>}
                    {!i.active && <Badge>Not in use</Badge>}
                  </p>
                  <p className="text-sm text-slate-500">
                    {i.lowAt !== null && `Warn at ${qty(i.lowAt)} ${i.unit} · `}
                    {i.costPerUnit > 0 && `${formatCurrency(i.costPerUnit)} per ${i.unit} · `}
                    {i.usedIn ? `In ${i.usedIn} recipe line(s)` : "Not in any recipe"}
                  </p>
                </div>
                <p className={cn("text-xl font-bold lg:w-36 lg:text-right", i.quantity <= 0 ? "text-red-700" : i.low ? "text-amber-700" : "text-slate-900")}>
                  {qty(i.quantity)} <span className="text-sm font-medium text-slate-500">{i.unit}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 lg:justify-end">
                  <Button size="sm" variant="success" onClick={() => setDialog({ kind: "entry", item: i, type: "purchase" })}>
                    <PackagePlus className="h-4 w-4" /> Purchase
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "entry", item: i, type: "wastage" })}>
                    Wastage
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "entry", item: i, type: "count" })}>
                    <Scale className="h-4 w-4" /> Count
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onHistory(i.id)} aria-label={`History of ${i.name}`}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "item", item: i })} aria-label={`Edit ${i.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(i)} aria-label={`Delete ${i.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {dialog?.kind === "item" && <ItemDialog item={dialog.item} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === "quick" && <QuickAddDialog onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === "entry" && <EntryDialog item={dialog.item} type={dialog.type} onClose={() => setDialog(null)} onSaved={done} />}
    </div>
  );
}

interface RecipeLine {
  id?: string;
  menuItemId: string;
  variant: string | null;
  stockItemId: string;
  quantity: number;
}

function RecipeEditor({ dish, stock, lines, onSaved, onClose }: { dish: CategoryDTO["items"][number]; stock: StockItem[]; lines: RecipeLine[]; onSaved: () => void; onClose: () => void }) {
  const { toast } = useApp();
  const portions = parseVariants(dish.variants);
  const [rows, setRows] = useState(lines.map((l) => ({ stockItemId: l.stockItemId, variant: l.variant ?? "", quantity: String(l.quantity) })));
  const [saving, setSaving] = useState(false);
  const set = (i: number, p: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const unitOf = (id: string) => stock.find((s) => s.id === id)?.unit ?? "";
  async function save() {
    setSaving(true);
    try {
      await api(`/api/recipes/${dish.id}`, {
        method: "PUT",
        body: { lines: rows.filter((r) => r.stockItemId).map((r) => ({ stockItemId: r.stockItemId, variant: r.variant || null, quantity: Number(r.quantity) })) },
      });
      toast(`Recipe for ${dish.name} saved`);
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
      title={`Recipe · ${dish.name}`}
      description="What one dish uses from stock. Every paid bill takes this out automatically."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save recipe</Button>
        </>
      }
    >
      {stock.length === 0 ? (
        <Tip tone="warning">Add stock items first on the Stock tab.</Tip>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
              <Field label="Stock item" className="min-w-44 flex-1">
                <Select value={r.stockItemId} onChange={(e) => set(i, { stockItemId: e.target.value })}>
                  <option value="">Choose…</option>
                  {stock.filter((s) => s.active || s.id === r.stockItemId).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                  ))}
                </Select>
              </Field>
              <Field label={`Per dish${r.stockItemId ? ` (${unitOf(r.stockItemId)})` : ""}`} className="w-32">
                <Input type="number" min={0} step="0.001" value={r.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />
              </Field>
              {portions.length > 0 && (
                <Field label="For" className="w-36">
                  <Select value={r.variant} onChange={(e) => set(i, { variant: e.target.value })}>
                    <option value="">Every portion</option>
                    {portions.map((p) => (
                      <option key={p.name} value={p.name}>{p.name} only</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Button variant="ghost" className="text-red-600" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Remove ingredient">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { stockItemId: "", variant: "", quantity: "" }])}>
            <Plus className="h-4 w-4" /> Add ingredient
          </Button>
          {portions.length > 0 && <p className="text-sm text-slate-500">Tip: use “Every portion” for things all portions share, or one line per portion (e.g. 0.1 kg for Half, 0.2 kg for Full).</p>}
        </div>
      )}
    </Modal>
  );
}

function RecipesTab() {
  const [menu, setMenu] = useState<CategoryDTO[] | null>(null);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [editing, setEditing] = useState<CategoryDTO["items"][number] | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    Promise.all([api<{ categories: CategoryDTO[] }>("/api/menu"), api<{ items: StockItem[] }>("/api/stock"), api<{ lines: RecipeLine[] }>("/api/recipes")]).then(([m, s, r]) => {
      setMenu(m.categories);
      setStock(s.items);
      setLines(r.lines);
    });
  }, []);
  useEffect(() => load(), [load]);

  const byDish = useMemo(() => {
    const map = new Map<string, RecipeLine[]>();
    for (const l of lines) map.set(l.menuItemId, [...(map.get(l.menuItemId) ?? []), l]);
    return map;
  }, [lines]);

  if (!menu) return <Loading />;
  const dishes = menu.flatMap((c) => c.items);
  const withRecipe = dishes.filter((d) => byDish.has(d.id)).length;
  const name = (id: string) => stock.find((s) => s.id === id);

  return (
    <div className="space-y-4">
      <Tip>
        {withRecipe} of {dishes.length} dishes have a recipe. Dishes without one don&apos;t change stock. Start with the dishes that use costly ingredients (paneer, chicken, mutton).
      </Tip>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes" className="sm:max-w-xs" aria-label="Search dishes" />
      {menu.map((c) => {
        const items = c.items.filter((d) => !q.trim() || d.name.toLowerCase().includes(q.trim().toLowerCase()));
        if (items.length === 0) return null;
        return (
          <Card key={c.id}>
            <CardHeader title={c.name} />
            <ul className="divide-y divide-slate-100">
              {items.map((d) => {
                const mine = byDish.get(d.id) ?? [];
                return (
                  <li key={d.id}>
                    <button onClick={() => setEditing(d)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                      <FoodMark type={d.foodType} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900">{d.name}</span>
                        <span className="block truncate text-sm text-slate-500">
                          {mine.length === 0
                            ? "No recipe yet — tap to add"
                            : mine.map((l) => `${qty(l.quantity)} ${name(l.stockItemId)?.unit ?? ""} ${name(l.stockItemId)?.name ?? "?"}${l.variant ? ` (${l.variant})` : ""}`).join(", ")}
                        </span>
                      </span>
                      {mine.length > 0 ? <Badge variant="success">{mine.length}</Badge> : <Badge>Add</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
      {editing && (
        <RecipeEditor
          dish={editing}
          stock={stock}
          lines={byDish.get(editing.id) ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function HistoryTab({ item, setItem }: { item: string; setItem: (id: string) => void }) {
  const { settings } = useApp();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [type, setType] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  useEffect(() => {
    api<{ items: StockItem[] }>("/api/stock").then((r) => setStock(r.items));
  }, []);
  useEffect(() => {
    setEntries(null);
    const p = new URLSearchParams();
    if (item) p.set("item", item);
    if (type) p.set("type", type);
    api<{ entries: Entry[] }>(`/api/stock/entries?${p}`).then((r) => setEntries(r.entries));
  }, [item, type]);
  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-2 p-4 sm:flex-row">
        <Select value={item} onChange={(e) => setItem(e.target.value)} className="sm:w-64" aria-label="Stock item">
          <option value="">All stock items</option>
          {stock.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-56" aria-label="Kind">
          <option value="">Everything</option>
          {Object.entries(ENTRY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </Card>
      {!entries ? (
        <Loading />
      ) : entries.length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" />} title="No stock changes yet" />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-[15px]">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">
                    {e.stockItem.name} <span className="font-normal text-slate-500">· {ENTRY_LABEL[e.type] ?? e.type}</span>
                  </span>
                  <span className="block truncate text-sm text-slate-500">
                    {formatDateTime(e.createdAt, settings.timezone)} · {e.createdByName}
                    {e.supplier && ` · ${e.supplier}`}
                    {e.cost !== null && ` · ${formatCurrency(e.cost)}`}
                    {e.note && ` · ${e.note}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <b className={e.quantity < 0 ? "text-red-700" : "text-emerald-700"}>
                    {e.quantity > 0 ? "+" : ""}
                    {qty(e.quantity)} {e.stockItem.unit}
                  </b>
                  <span className="block text-xs text-slate-500">
                    left {qty(e.balance)} {e.stockItem.unit}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

interface UsageRow {
  id: string;
  name: string;
  unit: string;
  opening: number;
  purchased: number;
  used: number;
  wasted: number;
  adjusted: number;
  closing: number;
  purchaseCost: number;
  usedValue: number;
}

function UsageTab() {
  const { settings } = useApp();
  const [from, setFrom] = useState(addDays(settings.today, -6));
  const [to, setTo] = useState(settings.today);
  const [data, setData] = useState<{ rows: UsageRow[]; totals: { purchaseCost: number; usedValue: number } } | null>(null);
  useEffect(() => {
    setData(null);
    api<{ rows: UsageRow[]; totals: { purchaseCost: number; usedValue: number } }>(`/api/stock/report?from=${from}&to=${to}`).then(setData);
  }, [from, to]);
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-2 p-4">
        {[
          { label: "Today", from: settings.today, to: settings.today },
          { label: "Last 7 days", from: addDays(settings.today, -6), to: settings.today },
          { label: "This month", from: `${settings.today.slice(0, 7)}-01`, to: settings.today },
        ].map((x) => (
          <Button key={x.label} size="sm" variant={from === x.from && to === x.to ? "primary" : "outline"} onClick={() => (setFrom(x.from), setTo(x.to))}>
            {x.label}
          </Button>
        ))}
        <label className="text-sm text-slate-600">
          From <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="ml-1 inline-block min-h-9 w-40 py-1" />
        </label>
        <label className="text-sm text-slate-600">
          To <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="ml-1 inline-block min-h-9 w-40 py-1" />
        </label>
        <a href={`/api/stock/report?from=${from}&to=${to}&format=csv`} className="ml-auto">
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4" /> CSV
          </Button>
        </a>
      </Card>
      {!data ? (
        <Loading />
      ) : data.rows.length === 0 ? (
        <EmptyState title="No stock movement in this period" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard title="Bought" value={formatCurrency(data.totals.purchaseCost)} subtitle="Total paid for purchases" tone="sky" />
            <StatCard title="Used in bills" value={formatCurrency(data.totals.usedValue)} subtitle="At the last purchase price" tone="amber" />
          </div>
          <Card className="overflow-x-auto">
            <CardContent className="p-0">
              <table className="w-full min-w-[720px] text-[15px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-sm text-slate-500">
                    <th className="px-5 py-2 font-semibold">Item</th>
                    <th className="py-2 text-right font-semibold">Opening</th>
                    <th className="py-2 text-right font-semibold">Bought</th>
                    <th className="py-2 text-right font-semibold">Used</th>
                    <th className="py-2 text-right font-semibold">Wasted</th>
                    <th className="py-2 text-right font-semibold">Count diff.</th>
                    <th className="px-5 py-2 text-right font-semibold">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-5 py-2 font-semibold">
                        {r.name} <span className="font-normal text-slate-400">({r.unit})</span>
                      </td>
                      <td className="py-2 text-right">{qty(r.opening)}</td>
                      <td className="py-2 text-right text-emerald-700">{r.purchased ? `+${qty(r.purchased)}` : "—"}</td>
                      <td className="py-2 text-right">{r.used ? qty(r.used) : "—"}</td>
                      <td className="py-2 text-right text-red-700">{r.wasted ? qty(r.wasted) : "—"}</td>
                      <td className="py-2 text-right">{r.adjusted ? `${r.adjusted > 0 ? "+" : ""}${qty(r.adjusted)}` : "—"}</td>
                      <td className="px-5 py-2 text-right font-bold">{qty(r.closing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StockView() {
  const { isAdmin } = useApp();
  const sp = useSearchParams();
  const requested = sp.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(requested && TAB_LIST.includes(requested) ? requested : "stock");
  const [historyItem, setHistoryItem] = useState("");
  if (!isAdmin) return <Tip tone="warning">Only the owner / manager can manage stock.</Tip>;
  const change = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `/stock?tab=${t}`);
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Stock & recipes" description="What you have in the kitchen. Paid bills take ingredients out automatically using each dish's recipe." />
      <Tabs<Tab>
        value={tab}
        onChange={change}
        tabs={[
          { value: "stock", label: "Stock" },
          { value: "purchases", label: "Purchase orders" },
          { value: "suppliers", label: "Suppliers" },
          { value: "recipes", label: "Recipes" },
          { value: "costing", label: "Dish costing" },
          { value: "history", label: "History" },
          { value: "usage", label: "Usage report" },
        ]}
      />
      {tab === "stock" && (
        <StockTab
          onHistory={(id) => {
            setHistoryItem(id);
            change("history");
          }}
        />
      )}
      {tab === "purchases" && <PurchasesTab />}
      {tab === "suppliers" && <SuppliersTab />}
      {tab === "recipes" && <RecipesTab />}
      {tab === "costing" && <CostingTab />}
      {tab === "history" && <HistoryTab item={historyItem} setItem={setHistoryItem} />}
      {tab === "usage" && <UsageTab />}
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StockView />
    </Suspense>
  );
}
