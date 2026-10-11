"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, ClipboardPaste, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Textarea, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { FoodMark } from "@/components/food-mark";
import { api } from "@/lib/client";
import { parseVariants, type Variant } from "@/lib/menu";
import { cn, formatCurrency, label } from "@/lib/utils";
import type { CategoryDTO, MenuItemDTO, SettingsDTO } from "@/lib/types";

interface ItemForm {
  id?: string;
  categoryId: string;
  name: string;
  shortCode: string;
  description: string;
  price: string;
  hasPortions: boolean;
  variants: Array<{ name: string; price: string }>;
  foodType: string;
  customTax: boolean;
  taxRate: string;
  available: boolean;
}

function toForm(item: MenuItemDTO | null, categoryId: string): ItemForm {
  const variants = item ? parseVariants(item.variants) : [];
  return {
    id: item?.id,
    categoryId: item?.categoryId ?? categoryId,
    name: item?.name ?? "",
    shortCode: item?.shortCode ?? "",
    description: item?.description ?? "",
    price: item && !variants.length ? String(item.price) : "",
    hasPortions: variants.length > 0,
    variants: variants.length ? variants.map((v) => ({ name: v.name, price: String(v.price) })) : [{ name: "Half", price: "" }, { name: "Full", price: "" }],
    foodType: item?.foodType ?? "veg",
    customTax: item?.taxRate !== null && item?.taxRate !== undefined,
    taxRate: item?.taxRate !== null && item?.taxRate !== undefined ? String(item.taxRate) : "",
    available: item?.available ?? true,
  };
}

function ItemDialog({
  initial,
  categories,
  defaultTax,
  onClose,
  onSaved,
}: {
  initial: ItemForm;
  categories: CategoryDTO[];
  defaultTax: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useApp();
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<ItemForm>) => setF((x) => ({ ...x, ...p }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const variants: Variant[] = f.hasPortions ? f.variants.filter((v) => v.name.trim()).map((v) => ({ name: v.name.trim(), price: Number(v.price) })) : [];
      if (f.hasPortions && variants.length === 0) throw new Error("Add at least one portion, or switch portions off");
      const body = {
        categoryId: f.categoryId,
        name: f.name,
        shortCode: f.shortCode || null,
        description: f.description || null,
        price: f.hasPortions ? 0 : Number(f.price),
        variants,
        foodType: f.foodType,
        taxRate: f.customTax && f.taxRate !== "" ? Number(f.taxRate) : null,
        available: f.available,
      };
      if (f.id) await api(`/api/menu/items/${f.id}`, { method: "PUT", body });
      else await api("/api/menu/items", { body });
      toast(f.id ? "Item updated" : `${f.name} added to the menu`);
      onSaved();
    } catch (err) {
      toast((err as Error).message, "error");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={f.id ? `Edit ${initial.name}` : "Add a dish"} size="lg">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Dish name" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Paneer Butter Masala" required autoFocus />
        </Field>
        <Field label="Category">
          <Select value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Short code" optional hint="Type it in the order screen search, e.g. PBM">
          <Input value={f.shortCode} onChange={(e) => set({ shortCode: e.target.value.toUpperCase() })} maxLength={12} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-semibold text-slate-700">Type</p>
          <div className="grid grid-cols-3 gap-2">
            {["veg", "non_veg", "egg"].map((t) => (
              <Button key={t} variant={f.foodType === t ? "secondary" : "outline"} className={cn(f.foodType === t && "ring-2 ring-primary-400")} onClick={() => set({ foodType: t })}>
                <FoodMark type={t} /> {label(t)}
              </Button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Toggle checked={f.hasPortions} onChange={(v) => set({ hasPortions: v })} label="Sold in portions" description="Half / Full, Small / Medium / Large, 250 ml / 500 ml…" />
        </div>
        {f.hasPortions ? (
          <div className="space-y-2 sm:col-span-2">
            {f.variants.map((v, i) => (
              <div key={i} className="flex gap-2">
                <Input value={v.name} onChange={(e) => set({ variants: f.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Portion name" aria-label="Portion name" />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={v.price}
                  onChange={(e) => set({ variants: f.variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })}
                  placeholder="Price"
                  aria-label="Portion price"
                  className="w-36"
                  required
                />
                <Button variant="ghost" aria-label="Remove portion" onClick={() => set({ variants: f.variants.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => set({ variants: [...f.variants, { name: "", price: "" }] })}>
              <Plus className="h-4 w-4" /> Add portion
            </Button>
          </div>
        ) : (
          <Field label="Price">
            <Input type="number" min={0} step="0.01" inputMode="decimal" value={f.price} onChange={(e) => set({ price: e.target.value })} required />
          </Field>
        )}
        <div className={cn(!f.hasPortions ? "" : "sm:col-span-2")}>
          <Toggle checked={f.customTax} onChange={(v) => set({ customTax: v })} label="Different tax rate" description={`Otherwise the restaurant's rate (${defaultTax}%) is used`} />
          {f.customTax && (
            <Input className="mt-2" type="number" min={0} max={100} step="0.01" value={f.taxRate} onChange={(e) => set({ taxRate: e.target.value })} placeholder="Tax %" aria-label="Tax rate" />
          )}
        </div>
        <Field label="Description" optional className="sm:col-span-2">
          <Textarea rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Toggle checked={f.available} onChange={(v) => set({ available: v })} label="Available" description="Switch off when the kitchen runs out. It shows as sold out." />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{f.id ? "Save changes" : "Add dish"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function QuickAddDialog({ categories, onClose, onSaved }: { categories: CategoryDTO[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [text, setText] = useState("");
  const [defaultCategory, setDefaultCategory] = useState(categories[0]?.name ?? "Main course");
  const [preview, setPreview] = useState<{ rows: Array<{ name: string; price: number; category: string; foodType: string; shortCode?: string }>; errors: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!text.trim()) return setPreview(null);
    const t = setTimeout(() => {
      api<typeof preview>("/api/menu/import", { body: { text, defaultCategory, dryRun: true } }).then(setPreview, () => setPreview(null));
    }, 400);
    return () => clearTimeout(t);
  }, [text, defaultCategory]);

  async function add() {
    setSaving(true);
    try {
      const r = await api<{ added: number }>("/api/menu/import", { body: { text, defaultCategory } });
      toast(`${r.added} dishes added`);
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
      title="Quick add many dishes"
      description="Paste one dish per line. You can copy columns straight from Excel."
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!preview?.rows.length} onClick={add}>
            Add {preview?.rows.length ?? 0} dishes
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Tip>
            Format: <b>name, price, category, veg / non-veg / egg, short code</b>. Only name and price are needed.
            <br />
            <span className="font-mono text-xs">Paneer Tikka, 280, Starters, veg, PT</span>
          </Tip>
          <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Paneer Tikka, 280, Starters, veg\nChicken 65, 320, Starters, non-veg\nMasala Dosa, 120"} className="font-mono text-sm" />
          <Field label="Category when a line has none">
            <Input value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} list="menu-categories" />
          </Field>
          <datalist id="menu-categories">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Preview</p>
          {!preview ? (
            <p className="text-sm text-slate-500">Dishes appear here as you type.</p>
          ) : (
            <div className="space-y-2">
              {preview.errors.map((e) => (
                <p key={e} className="text-sm text-red-700">{e}</p>
              ))}
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {preview.rows.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                    <span className="flex items-center gap-2"><FoodMark type={r.foodType} /> {r.name} {r.shortCode && <span className="text-xs text-slate-400">{r.shortCode}</span>}</span>
                    <span className="text-slate-500">{r.category} · <b className="text-slate-800">{formatCurrency(r.price)}</b></span>
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

export default function MenuPage() {
  const { isAdmin, toast, confirm } = useApp();
  const [categories, setCategories] = useState<CategoryDTO[] | null>(null);
  const [defaultTax, setDefaultTax] = useState(5);
  const [selected, setSelected] = useState<string>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ItemForm | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [catDialog, setCatDialog] = useState<{ id?: string; name: string } | null>(null);

  const load = useCallback(() => {
    api<{ categories: CategoryDTO[] }>("/api/menu").then((r) => setCategories(r.categories), (e) => toast(e.message, "error"));
  }, [toast]);
  useEffect(() => {
    load();
    api<{ settings: SettingsDTO }>("/api/settings").then((r) => setDefaultTax(r.settings.defaultTaxRate), () => null);
  }, [load]);

  const items = useMemo(() => {
    if (!categories) return [];
    const term = q.trim().toLowerCase();
    const pool = selected === "all" || term ? categories.flatMap((c) => c.items) : (categories.find((c) => c.id === selected)?.items ?? []);
    return term ? pool.filter((i) => i.name.toLowerCase().includes(term) || i.shortCode?.toLowerCase().includes(term)) : pool;
  }, [categories, selected, q]);

  if (!categories) return <Loading />;
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  async function toggleAvailable(item: MenuItemDTO) {
    try {
      await api(`/api/menu/items/${item.id}`, { method: "PATCH", body: { available: !item.available } });
      toast(item.available ? `${item.name} marked sold out` : `${item.name} is available again`);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function removeItem(item: MenuItemDTO) {
    const ok = await confirm({ title: `Delete ${item.name}?`, message: "Old bills keep their own copy, so nothing is lost there.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/menu/items/${item.id}`, { method: "DELETE" });
      toast("Dish deleted");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function categoryAction(c: CategoryDTO, body: Record<string, unknown>, msg?: string) {
    try {
      await api(`/api/menu/categories/${c.id}`, { method: "PATCH", body });
      if (msg) toast(msg);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function removeCategory(c: CategoryDTO) {
    const ok = await confirm({ title: `Delete category ${c.name}?`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/menu/categories/${c.id}`, { method: "DELETE" });
      toast("Category deleted");
      if (selected === c.id) setSelected("all");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function saveCategory() {
    if (!catDialog) return;
    try {
      if (catDialog.id) await api(`/api/menu/categories/${catDialog.id}`, { method: "PATCH", body: { name: catDialog.name } });
      else {
        const r = await api<{ category: { id: string } }>("/api/menu/categories", { body: { name: catDialog.name } });
        setSelected(r.category.id);
      }
      setCatDialog(null);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Menu"
        description={isAdmin ? "Your dishes, portions and prices. Changes show on the order screen straight away." : "Mark dishes as sold out when the kitchen runs out."}
        actions={
          isAdmin && (
            <>
              <Button variant="outline" onClick={() => setQuickAdd(true)}>
                <ClipboardPaste className="h-5 w-5" /> Quick add many
              </Button>
              <Button
                onClick={() => {
                  if (!categories.length) return setCatDialog({ name: "" });
                  setEditing(toForm(null, selected !== "all" ? selected : categories[0].id));
                }}
              >
                <Plus className="h-5 w-5" /> Add dish
              </Button>
            </>
          )
        }
      />

      {totalItems === 0 && categories.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="Your menu is empty"
          description="Start with a category like “Starters”, then add dishes. Or paste your whole menu at once with Quick add."
          action={
            isAdmin && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setCatDialog({ name: "" })}>
                  <Plus className="h-4 w-4" /> Add a category
                </Button>
                <Button variant="outline" onClick={() => setQuickAdd(true)}>
                  <ClipboardPaste className="h-4 w-4" /> Quick add many
                </Button>
              </div>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader
              title="Categories"
              action={
                isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setCatDialog({ name: "" })} aria-label="Add category">
                    <Plus className="h-4 w-4" />
                  </Button>
                )
              }
            />
            <ul className="p-2">
              <li>
                <button
                  onClick={() => setSelected("all")}
                  className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[15px] font-semibold", selected === "all" ? "bg-primary-50 text-primary-700" : "hover:bg-slate-50")}
                >
                  All dishes <span className="text-sm text-slate-400">{totalItems}</span>
                </button>
              </li>
              {categories.map((c, i) => (
                <li key={c.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => setSelected(c.id)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center justify-between rounded-xl px-3 py-2 text-left text-[15px] font-semibold",
                      selected === c.id ? "bg-primary-50 text-primary-700" : "hover:bg-slate-50",
                      !c.active && "text-slate-400"
                    )}
                  >
                    <span className="truncate">{c.name}{!c.active && " (hidden)"}</span>
                    <span className="text-sm text-slate-400">{c.items.length}</span>
                  </button>
                  {isAdmin && selected === c.id && (
                    <span className="flex shrink-0">
                      <button className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === 0} onClick={() => categoryAction(c, { move: "up" })} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                      <button className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === categories.length - 1} onClick={() => categoryAction(c, { move: "down" })} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {isAdmin && selected !== "all" && (
              <CardContent className="flex flex-wrap gap-2 border-t border-slate-100">
                {(() => {
                  const c = categories.find((x) => x.id === selected);
                  if (!c) return null;
                  return (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setCatDialog({ id: c.id, name: c.name })}><Pencil className="h-4 w-4" /> Rename</Button>
                      <Button size="sm" variant="outline" onClick={() => categoryAction(c, { active: !c.active }, c.active ? "Hidden from the order screen" : "Shown on the order screen")}>
                        {c.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {c.active ? "Hide" : "Show"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeCategory(c)} aria-label="Delete category"><Trash2 className="h-4 w-4" /></Button>
                    </>
                  );
                })()}
              </CardContent>
            )}
          </Card>

          <Card>
            <div className="border-b border-slate-100 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes or short codes" className="pl-9" aria-label="Search dishes" />
              </div>
            </div>
            {items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title={q ? "No dish matches" : "No dishes in this category yet"}
                  action={isAdmin && !q && selected !== "all" && <Button onClick={() => setEditing(toForm(null, selected))}><Plus className="h-4 w-4" /> Add dish</Button>}
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => {
                  const variants = parseVariants(item.variants);
                  return (
                    <li key={item.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <FoodMark type={item.foodType} className="mt-1.5" />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                            {item.name}
                            {item.shortCode && <Badge>{item.shortCode}</Badge>}
                            {!item.available && <Badge variant="danger">Sold out</Badge>}
                          </p>
                          <p className="text-sm text-slate-500">
                            {variants.length ? variants.map((v) => `${v.name} ${formatCurrency(v.price)}`).join(" · ") : formatCurrency(item.price)}
                            {(selected === "all" || q) && ` · ${catName(item.categoryId)}`}
                            {item.taxRate !== null && ` · Tax ${item.taxRate}%`}
                          </p>
                          {item.description && <p className="truncate text-xs text-slate-400">{item.description}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" variant={item.available ? "outline" : "success"} onClick={() => toggleAvailable(item)}>
                          {item.available ? "Mark sold out" : "Available again"}
                        </Button>
                        {isAdmin && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setEditing(toForm(item, item.categoryId))} aria-label={`Edit ${item.name}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeItem(item)} aria-label={`Delete ${item.name}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {editing && (
        <ItemDialog
          initial={editing}
          categories={categories}
          defaultTax={defaultTax}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {quickAdd && (
        <QuickAddDialog
          categories={categories}
          onClose={() => setQuickAdd(false)}
          onSaved={() => {
            setQuickAdd(false);
            load();
          }}
        />
      )}
      {catDialog && (
        <Modal
          open
          onClose={() => setCatDialog(null)}
          title={catDialog.id ? "Rename category" : "Add a category"}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setCatDialog(null)}>Cancel</Button>
              <Button disabled={!catDialog.name.trim()} onClick={saveCategory}>Save</Button>
            </>
          }
        >
          <Field label="Category name" hint="e.g. Starters, Main course, Breads, Beverages, Desserts">
            <Input value={catDialog.name} onChange={(e) => setCatDialog({ ...catDialog, name: e.target.value })} autoFocus onKeyDown={(e) => e.key === "Enter" && saveCategory()} />
          </Field>
        </Modal>
      )}
    </div>
  );
}
