"use client";

import { useState } from "react";
import { Pencil, Plus, Puzzle, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { FoodMark } from "@/components/food-mark";
import { api } from "@/lib/client";
import { choiceHint, parseAddonOptions, parseList } from "@/lib/menu";
import { cn, formatCurrency } from "@/lib/utils";
import type { AddonGroupDTO, CategoryDTO } from "@/lib/types";

interface GroupForm {
  id?: string;
  name: string;
  required: boolean;
  /** "1" = pick one, "any" = no limit, "n" = up to `max`. */
  limit: "1" | "any" | "n";
  max: string;
  options: Array<{ name: string; price: string }>;
  itemIds: string[];
}

const EXAMPLES = [
  { name: "Extra toppings", required: false, limit: "any" as const, options: [["Extra cheese", 40], ["Olives", 30], ["Jalapeños", 30], ["Mushrooms", 40]] },
  { name: "Choose your drink", required: true, limit: "1" as const, options: [["Coke", 0], ["Sprite", 0], ["Masala Chaas", 0], ["Fresh Lime Soda", 20]] },
  { name: "Spice level", required: true, limit: "1" as const, options: [["Mild", 0], ["Medium", 0], ["Spicy", 0]] },
];

function toForm(g: AddonGroupDTO | null, categories: CategoryDTO[]): GroupForm {
  if (!g) return { name: "", required: false, limit: "any", max: "2", options: [{ name: "", price: "" }], itemIds: [] };
  const itemIds = categories.flatMap((c) => c.items).filter((i) => parseList(i.addonGroupIds).includes(g.id)).map((i) => i.id);
  return {
    id: g.id,
    name: g.name,
    required: g.minSelect > 0,
    limit: g.maxSelect === 1 ? "1" : g.maxSelect === 0 ? "any" : "n",
    max: String(g.maxSelect || 2),
    options: parseAddonOptions(g.options).map((o) => ({ name: o.name, price: String(o.price) })),
    itemIds,
  };
}

function GroupDialog({ initial, categories, onClose, onSaved }: { initial: GroupForm; categories: CategoryDTO[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<GroupForm>) => setF((x) => ({ ...x, ...p }));
  const picked = new Set(f.itemIds);

  async function save() {
    setSaving(true);
    try {
      const max = f.limit === "1" ? 1 : f.limit === "any" ? 0 : Math.max(1, Math.floor(Number(f.max) || 1));
      const body = {
        name: f.name,
        minSelect: f.required ? 1 : 0,
        maxSelect: max,
        options: f.options.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), price: Number(o.price) || 0 })),
        itemIds: f.itemIds,
      };
      if (f.id) await api(`/api/menu/addons/${f.id}`, { method: "PUT", body });
      else await api("/api/menu/addons", { body });
      toast(f.id ? "Add-ons saved" : `${f.name} added`);
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }

  function toggleCategory(c: CategoryDTO) {
    const ids = c.items.map((i) => i.id);
    const all = ids.every((id) => picked.has(id));
    set({ itemIds: all ? f.itemIds.filter((id) => !ids.includes(id)) : [...new Set([...f.itemIds, ...ids])] });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={f.id ? `Edit ${initial.name}` : "New add-on group"}
      description="Extras guests can add to a dish, or a choice that is part of a combo."
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!f.name.trim() || !f.options.some((o) => o.name.trim())} onClick={save}>
            {f.id ? "Save" : "Add group"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {!f.id && !f.name && (
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-sm text-slate-500">Start from:</span>
              {EXAMPLES.map((ex) => (
                <Button
                  key={ex.name}
                  size="sm"
                  variant="outline"
                  onClick={() => set({ name: ex.name, required: ex.required, limit: ex.limit, options: ex.options.map(([name, price]) => ({ name: String(name), price: String(price) })) })}
                >
                  {ex.name}
                </Button>
              ))}
            </div>
          )}
          <Field label="Group name" hint="Guests see this, e.g. “Extra toppings” or “Choose your drink”">
            <Input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} autoFocus />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-700">How many can be picked?</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["1", "Just one"],
                  ["any", "Any number"],
                  ["n", "Up to…"],
                ] as const
              ).map(([v, l]) => (
                <Button key={v} variant={f.limit === v ? "secondary" : "outline"} className={cn(f.limit === v && "ring-2 ring-primary-400")} onClick={() => set({ limit: v })}>
                  {l}
                </Button>
              ))}
            </div>
            {f.limit === "n" && <Input className="mt-2 w-32" type="number" min={1} max={50} value={f.max} onChange={(e) => set({ max: e.target.value })} aria-label="Most that can be picked" />}
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input type="checkbox" checked={f.required} onChange={(e) => set({ required: e.target.checked })} className="mt-1 h-4 w-4 accent-primary-600" />
            <span>
              <span className="block font-semibold text-slate-800">The guest must choose</span>
              <span className="text-sm text-slate-500">For combos (“Choose your drink”) and choices like spice level. The dish cannot be added without it.</span>
            </span>
          </label>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-700">Options and their extra price</p>
            <div className="space-y-2">
              {f.options.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={o.name} onChange={(e) => set({ options: f.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="e.g. Extra cheese" aria-label="Option name" maxLength={60} />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={o.price}
                    onChange={(e) => set({ options: f.options.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })}
                    placeholder="0 = free"
                    aria-label="Extra price"
                    className="w-32"
                  />
                  <Button variant="ghost" aria-label="Remove option" disabled={f.options.length === 1} onClick={() => set({ options: f.options.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => set({ options: [...f.options, { name: "", price: "" }] })}>
                <Plus className="h-4 w-4" /> Add option
              </Button>
            </div>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-slate-700">
            Offer it with these dishes <span className="font-normal text-slate-500">({f.itemIds.length} chosen)</span>
          </p>
          <div className="max-h-[26rem] space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
            {categories.map((c) =>
              c.items.length === 0 ? null : (
                <div key={c.id}>
                  <label className="mb-1 flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <input type="checkbox" checked={c.items.every((i) => picked.has(i.id))} onChange={() => toggleCategory(c)} className="h-4 w-4 accent-primary-600" />
                    {c.name}
                  </label>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {c.items.map((i) => (
                      <label key={i.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={picked.has(i.id)}
                          onChange={() => set({ itemIds: picked.has(i.id) ? f.itemIds.filter((x) => x !== i.id) : [...f.itemIds, i.id] })}
                          className="h-4 w-4 accent-primary-600"
                        />
                        <FoodMark type={i.foodType} />
                        <span className="truncate">{i.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function AddonsTab({ groups, categories, onChanged }: { groups: AddonGroupDTO[]; categories: CategoryDTO[]; onChanged: () => void }) {
  const { toast, confirm } = useApp();
  const [editing, setEditing] = useState<GroupForm | null>(null);
  const allItems = categories.flatMap((c) => c.items);

  async function remove(g: AddonGroupDTO) {
    const ok = await confirm({ title: `Delete ${g.name}?`, message: "It is taken off every dish. Old bills keep their add-ons.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/menu/addons/${g.id}`, { method: "DELETE" });
      toast("Add-on group deleted");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tip>
          Add-ons are extras guests can add (extra cheese, toppings) or a choice that is part of the dish (choose your drink in a combo, spice level). On the order screen and QR
          menu the choices pop up when the dish is tapped, and the price adds up by itself.
        </Tip>
        <Button onClick={() => setEditing(toForm(null, categories))}>
          <Plus className="h-5 w-5" /> New add-on group
        </Button>
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={<Puzzle className="h-6 w-6" />} title="No add-ons yet" description="Create a group like “Extra toppings” or “Choose your drink”, then choose the dishes that offer it." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const count = allItems.filter((i) => parseList(i.addonGroupIds).includes(g.id)).length;
            return (
              <Card key={g.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900">
                      {g.name}
                      <Badge variant={g.minSelect > 0 ? "warning" : "default"}>{choiceHint(g)}</Badge>
                    </p>
                    <p className="text-sm text-slate-500">{count ? `Offered with ${count} dish${count === 1 ? "" : "es"}` : "Not offered with any dish yet"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(toForm(g, categories))} aria-label={`Edit ${g.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(g)} aria-label={`Delete ${g.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {parseAddonOptions(g.options).map((o) => (
                    <li key={o.name} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                      {o.name} <span className="text-slate-500">{o.price > 0 ? `+${formatCurrency(o.price)}` : "free"}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
      {editing && (
        <GroupDialog
          initial={editing}
          categories={categories}
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
