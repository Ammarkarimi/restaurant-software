"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { parseList, parseVariants, priceFor } from "@/lib/menu";
import { parseDays, parseOverrides, priceInList, type PriceListData, type PriceOverride } from "@/lib/pricing";
import { cn, formatCurrency, label } from "@/lib/utils";
import type { CategoryDTO, MenuItemDTO, PriceListDTO } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TYPES = ["dine_in", "takeaway", "delivery"];
const SOURCES = ["zomato", "swiggy", "app", "phone", "counter", "qr"];

interface ListForm {
  id?: string;
  name: string;
  active: boolean;
  direction: "up" | "down";
  percent: string;
  roundTo: string;
  areas: string[];
  orderTypes: string[];
  sources: string[];
  days: number[];
  timed: boolean;
  startTime: string;
  endTime: string;
  categoryIds: string[];
  overrides: Record<string, PriceOverride>;
}

const EXAMPLES: Array<{ name: string; patch: Partial<ListForm> }> = [
  { name: "Zomato & Swiggy prices", patch: { sources: ["zomato", "swiggy"], direction: "up", percent: "15", roundTo: "5" } },
  { name: "AC hall", patch: { orderTypes: ["dine_in"], direction: "up", percent: "10", roundTo: "5" } },
  { name: "Happy hours", patch: { timed: true, startTime: "16:00", endTime: "19:00", days: [1, 2, 3, 4, 5], direction: "down", percent: "20", roundTo: "5" } },
];

function toForm(l: PriceListDTO | null): ListForm {
  return {
    id: l?.id,
    name: l?.name ?? "",
    active: l?.active ?? true,
    direction: l && l.adjustPercent < 0 ? "down" : "up",
    percent: l ? String(Math.abs(l.adjustPercent)) : "",
    roundTo: String(l?.roundTo ?? 1),
    areas: l ? parseList(l.areas) : [],
    orderTypes: l ? parseList(l.orderTypes) : [],
    sources: l ? parseList(l.sources) : [],
    days: l ? parseDays(l.days) : [],
    timed: !!l?.startTime,
    startTime: l?.startTime ?? "16:00",
    endTime: l?.endTime ?? "19:00",
    categoryIds: l ? parseList(l.categoryIds) : [],
    overrides: l ? parseOverrides(l.overrides) : {},
  };
}

/** "Dine-in · AC hall · Mon–Fri 16:00–19:00 · 20% off" */
export function describeList(l: PriceListDTO, categories: CategoryDTO[]) {
  const parts: string[] = [];
  const types = parseList(l.orderTypes);
  const areas = parseList(l.areas);
  const sources = parseList(l.sources);
  const days = parseDays(l.days);
  if (types.length) parts.push(types.map(label).join(" / "));
  if (areas.length) parts.push(areas.join(", "));
  if (sources.length) parts.push(sources.map(label).join(" / "));
  if (days.length && days.length < 7) parts.push(days.map((d) => DAYS[d]).join(", "));
  if (l.startTime) parts.push(`${l.startTime}–${l.endTime}`);
  const cats = parseList(l.categoryIds).map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean);
  if (l.adjustPercent) parts.push(`${l.adjustPercent > 0 ? `${l.adjustPercent}% dearer` : `${-l.adjustPercent}% off`}${cats.length ? ` on ${cats.join(", ")}` : ""}`);
  const own = Object.keys(parseOverrides(l.overrides)).length;
  if (own) parts.push(`${own} dish${own === 1 ? "" : "es"} with their own price`);
  return parts.join(" · ");
}

function Chips<T extends string | number>({ options, value, onChange, render }: { options: T[]; value: T[]; onChange: (v: T[]) => void; render: (o: T) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={String(o)}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn("rounded-full border px-3 py-1 text-sm font-semibold transition", on ? "border-primary-500 bg-primary-50 text-primary-800" : "border-slate-200 text-slate-600 hover:border-primary-300")}
          >
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}

function ListDialog({ initial, categories, areas, onClose, onSaved }: { initial: ListForm; categories: CategoryDTO[]; areas: string[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const set = (p: Partial<ListForm>) => setF((x) => ({ ...x, ...p }));
  const items = useMemo(() => categories.flatMap((c) => c.items), [categories]);
  const adjust = (f.direction === "down" ? -1 : 1) * (Number(f.percent) || 0);

  const draft: PriceListData = {
    id: f.id ?? "draft",
    name: f.name,
    active: true,
    adjustPercent: adjust,
    roundTo: Number(f.roundTo) || 1,
    areas: "[]",
    orderTypes: "[]",
    sources: "[]",
    days: "[]",
    startTime: null,
    endTime: null,
    categoryIds: JSON.stringify(f.categoryIds),
    overrides: JSON.stringify(f.overrides),
    sortOrder: 0,
  };
  const preview = items.filter((i) => priceInList(draft, i, parseVariants(i.variants)[0]?.name ?? null) !== null).slice(0, 6);
  const matches = search.trim() ? items.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()) && !f.overrides[i.id]).slice(0, 6) : [];

  function setOverride(item: MenuItemDTO, variant: string | null, value: string) {
    const current = f.overrides[item.id] ?? {};
    const n = value === "" ? undefined : Number(value);
    const next: PriceOverride = variant ? { ...current, variants: { ...current.variants, [variant]: n as number } } : { ...current, price: n };
    if (variant && n === undefined) delete next.variants![variant];
    set({ overrides: { ...f.overrides, [item.id]: next } });
  }

  async function save() {
    setSaving(true);
    try {
      // Drop empty per-dish prices.
      const overrides = Object.fromEntries(
        Object.entries(f.overrides).flatMap(([id, o]) => {
          const variants = Object.fromEntries(Object.entries(o.variants ?? {}).filter(([, v]) => typeof v === "number" && !Number.isNaN(v)));
          const clean: PriceOverride = { ...(typeof o.price === "number" && !Number.isNaN(o.price) && { price: o.price }), ...(Object.keys(variants).length && { variants }) };
          return Object.keys(clean).length ? [[id, clean]] : [];
        })
      );
      const body = {
        name: f.name,
        active: f.active,
        adjustPercent: adjust,
        roundTo: Number(f.roundTo) || 1,
        areas: f.areas,
        orderTypes: f.orderTypes,
        sources: f.sources,
        days: f.days,
        startTime: f.timed ? f.startTime : null,
        endTime: f.timed ? f.endTime : null,
        categoryIds: f.categoryIds,
        overrides,
      };
      if (f.id) await api(`/api/menu/prices/${f.id}`, { method: "PUT", body });
      else await api("/api/menu/prices", { body });
      toast("Special prices saved");
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
      title={f.id ? `Edit ${initial.name}` : "New special prices"}
      description="Prices change by themselves on the order screen and QR menu when the conditions match."
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!f.name.trim()} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          {!f.id && !f.name && (
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-sm text-slate-500">Start from:</span>
              {EXAMPLES.map((ex) => (
                <Button key={ex.name} size="sm" variant="outline" onClick={() => set({ name: ex.name, ...ex.patch })}>
                  {ex.name}
                </Button>
              ))}
            </div>
          )}
          <Field label="Name" hint="Only staff see it">
            <Input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} autoFocus />
          </Field>
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-800">When it applies</p>
            <p className="-mt-2 text-sm text-slate-500">Leave a row empty for “any”. Every row you fill must match.</p>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Order type</p>
              <Chips options={TYPES} value={f.orderTypes} onChange={(v) => set({ orderTypes: v })} render={label} />
            </div>
            {areas.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold text-slate-700">Table area (dine-in)</p>
                <Chips options={areas} value={f.areas} onChange={(v) => set({ areas: v })} render={(a) => a} />
              </div>
            )}
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Order from</p>
              <Chips options={SOURCES} value={f.sources} onChange={(v) => set({ sources: v })} render={label} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Days</p>
              <Chips options={[1, 2, 3, 4, 5, 6, 0]} value={f.days} onChange={(v) => set({ days: v })} render={(d) => DAYS[d]} />
            </div>
            <div>
              <Toggle checked={f.timed} onChange={(v) => set({ timed: v })} label="Only between certain times" description="For happy hours or lunch prices" />
              {f.timed && (
                <div className="mt-2 flex items-center gap-2">
                  <Input type="time" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} className="w-36" aria-label="From" />
                  <span className="text-slate-500">to</span>
                  <Input type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} className="w-36" aria-label="To" />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-800">Change prices by</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={f.direction} onChange={(e) => set({ direction: e.target.value as "up" | "down" })} className="w-40" aria-label="Dearer or cheaper">
                <option value="up">Dearer by</option>
                <option value="down">Cheaper by</option>
              </Select>
              <Input type="number" min={0} max={f.direction === "down" ? 90 : 500} step="0.5" value={f.percent} onChange={(e) => set({ percent: e.target.value })} className="w-24" aria-label="Percent" />
              <span className="text-slate-600">%</span>
              <Select value={f.roundTo} onChange={(e) => set({ roundTo: e.target.value })} className="w-44" aria-label="Round to">
                <option value="1">round to ₹1</option>
                <option value="5">round to ₹5</option>
                <option value="10">round to ₹10</option>
              </Select>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">On</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => set({ categoryIds: [] })}
                  className={cn("rounded-full border px-3 py-1 text-sm font-semibold", !f.categoryIds.length ? "border-primary-500 bg-primary-50 text-primary-800" : "border-slate-200 text-slate-600")}
                >
                  Whole menu
                </button>
                <Chips options={categories.map((c) => c.id)} value={f.categoryIds} onChange={(v) => set({ categoryIds: v })} render={(id) => categories.find((c) => c.id === id)?.name ?? ""} />
              </div>
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-800">Own price for a dish <span className="font-normal text-slate-500">(optional)</span></p>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a dish to give it its own price" aria-label="Search a dish" />
            {matches.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {matches.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      className="flex w-full justify-between px-3 py-1.5 text-left text-sm hover:bg-primary-50"
                      onClick={() => {
                        set({ overrides: { ...f.overrides, [i.id]: {} } });
                        setSearch("");
                      }}
                    >
                      {i.name} <Plus className="h-4 w-4 text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {Object.keys(f.overrides).map((id) => {
              const item = items.find((i) => i.id === id);
              if (!item) return null;
              const variants = parseVariants(item.variants);
              const o = f.overrides[id];
              return (
                <div key={id} className="rounded-xl bg-slate-50 p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{item.name}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...f.overrides };
                        delete next[id];
                        set({ overrides: next });
                      }}
                      className="rounded p-1 text-slate-400 hover:text-red-600"
                      aria-label={`Remove own price for ${item.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(variants.length ? variants.map((v) => v.name) : [null]).map((v) => (
                      <label key={v ?? "price"} className="flex items-center gap-1 text-sm text-slate-600">
                        {v ?? "Price"} <span className="text-xs">(menu {formatCurrency(priceFor(item, v) ?? 0)})</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-9 w-24"
                          value={String((v ? o.variants?.[v] : o.price) ?? "")}
                          onChange={(e) => setOverride(item, v, e.target.value)}
                          aria-label={`${item.name} ${v ?? ""} price`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {preview.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Examples</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                {preview.map((i) => {
                  const v = parseVariants(i.variants)[0]?.name ?? null;
                  return (
                    <li key={i.id} className="flex justify-between px-3 py-1.5">
                      <span>{i.name}{v && ` (${v})`}</span>
                      <span>
                        <s className="mr-2 text-slate-400">{formatCurrency(priceFor(i, v) ?? 0)}</s>
                        <b>{formatCurrency(priceInList(draft, i, v) ?? 0)}</b>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function PricesTab({ lists, categories, areas, onChanged }: { lists: PriceListDTO[]; categories: CategoryDTO[]; areas: string[]; onChanged: () => void }) {
  const { toast, confirm } = useApp();
  const [editing, setEditing] = useState<ListForm | null>(null);

  async function patch(l: PriceListDTO, body: Record<string, unknown>) {
    try {
      await api(`/api/menu/prices/${l.id}`, { method: "PATCH", body });
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function remove(l: PriceListDTO) {
    const ok = await confirm({ title: `Delete ${l.name}?`, message: "Dishes go back to their menu price. Old bills keep the price they were sold at.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/menu/prices/${l.id}`, { method: "DELETE" });
      toast("Special prices deleted");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tip>
          Charge more on Zomato and Swiggy or in the AC hall, or less in happy hours. Prices change by themselves when an order matches; the menu prices stay as they are. If two
          lists match, the higher one in this list wins.
        </Tip>
        <Button onClick={() => setEditing(toForm(null))}>
          <Plus className="h-5 w-5" /> New special prices
        </Button>
      </div>
      {lists.length === 0 ? (
        <EmptyState icon={<Tags className="h-6 w-6" />} title="No special prices" description="Every order uses the menu prices. Add special prices for an app, an area or happy hours." />
      ) : (
        <div className="space-y-3">
          {lists.map((l, i) => (
            <Card key={l.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", !l.active && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900">
                  {l.name}
                  {!l.active && <Badge>Off</Badge>}
                </p>
                <p className="text-sm text-slate-600">{describeList(l, categories)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === 0} onClick={() => patch(l, { move: "up" })} aria-label="Move up">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === lists.length - 1} onClick={() => patch(l, { move: "down" })} aria-label="Move down">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <Button size="sm" variant={l.active ? "outline" : "success"} onClick={() => patch(l, { active: !l.active })}>
                  {l.active ? "Switch off" : "Switch on"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(toForm(l))} aria-label={`Edit ${l.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(l)} aria-label={`Delete ${l.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <ListDialog
          initial={editing}
          categories={categories}
          areas={areas}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
