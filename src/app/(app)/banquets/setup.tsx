"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, Field, Input, Modal, Select, Textarea, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { parseMenu } from "@/lib/banquet";
import { formatCurrency } from "@/lib/utils";

export interface HallDTO {
  id: string;
  name: string;
  capacity: number;
  rent: number;
  notes: string | null;
  active: boolean;
}
export interface PackageDTO {
  id: string;
  name: string;
  foodType: string;
  pricePerPlate: number;
  menu: string;
  minGuests: number;
  active: boolean;
}

function HallDialog({ hall, onClose, onSaved }: { hall: Partial<HallDTO>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({ name: hall.name ?? "", capacity: String(hall.capacity ?? 100), rent: String(hall.rent ?? 0), notes: hall.notes ?? "", active: hall.active ?? true });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api(hall.id ? `/api/banquets/halls/${hall.id}` : "/api/banquets/halls", { method: hall.id ? "PATCH" : "POST", body: { ...f, capacity: Number(f.capacity), rent: Number(f.rent) } });
      toast("Hall saved");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={hall.id ? "Edit hall" : "Add a hall"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Grand Hall, Rooftop, Lawn" /></Field>
        <Field label="Guests it holds"><Input type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field>
        <Field label="Usual hall rent (₹)" hint="0 if the hall is free with food"><Input type="number" min={0} value={f.rent} onChange={(e) => setF({ ...f, rent: e.target.value })} /></Field>
        <Field label="Notes" optional className="sm:col-span-2"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="AC, stage, 2nd floor, lift" /></Field>
        <div className="sm:col-span-2"><Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Can be booked" /></div>
      </div>
    </Modal>
  );
}

function PackageDialog({ pkg, onClose, onSaved }: { pkg: Partial<PackageDTO>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({ name: pkg.name ?? "", foodType: pkg.foodType ?? "veg", pricePerPlate: String(pkg.pricePerPlate ?? ""), menu: parseMenu(pkg.menu).join("\n"), minGuests: String(pkg.minGuests ?? 0), active: pkg.active ?? true });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const body = { ...f, pricePerPlate: Number(f.pricePerPlate), minGuests: Number(f.minGuests), menu: f.menu.split("\n").map((l) => l.trim()).filter(Boolean) };
      await api(pkg.id ? `/api/banquets/packages/${pkg.id}` : "/api/banquets/packages", { method: pkg.id ? "PATCH" : "POST", body });
      toast("Package saved");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal open size="lg" onClose={onClose} title={pkg.id ? "Edit package" : "Add a per-plate package"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" className="sm:col-span-3"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Silver veg, Gold non-veg" /></Field>
        <Field label="Food"><Select value={f.foodType} onChange={(e) => setF({ ...f, foodType: e.target.value })}><option value="veg">Veg</option><option value="non_veg">Non-veg</option><option value="both">Veg + non-veg</option></Select></Field>
        <Field label="Price per plate (₹)"><Input type="number" min={0} value={f.pricePerPlate} onChange={(e) => setF({ ...f, pricePerPlate: e.target.value })} /></Field>
        <Field label="Minimum guests" optional><Input type="number" min={0} value={f.minGuests} onChange={(e) => setF({ ...f, minGuests: e.target.value })} /></Field>
        <Field label="Menu — one line per course" className="sm:col-span-3" hint="Printed on the quotation and the kitchen's function sheet">
          <Textarea rows={8} value={f.menu} onChange={(e) => setF({ ...f, menu: e.target.value })} placeholder={"Welcome drink: Fresh lime soda\nStarters (any 2): Paneer Tikka, Hara Bhara Kebab, Veg Crispy\nMain course: Paneer Butter Masala, Dal Makhani, Mix Veg\nRice & breads: Jeera Rice, Butter Naan, Tandoori Roti\nDessert: Gulab Jamun"} />
        </Field>
        <div className="sm:col-span-3"><Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Offer this package" /></div>
      </div>
    </Modal>
  );
}

/** Owner's set-up for banquets: halls (capacity, usual rent) and per-plate packages with their menus. */
export function BanquetSetup({ halls, packages, onChanged }: { halls: HallDTO[]; packages: PackageDTO[]; onChanged: () => void }) {
  const [hall, setHall] = useState<Partial<HallDTO> | null>(null);
  const [pkg, setPkg] = useState<Partial<PackageDTO> | null>(null);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Halls" description="Party halls, lawns, rooftops or private rooms you book out." action={<Button size="sm" onClick={() => setHall({})}><Plus className="h-4 w-4" /> Add hall</Button>} />
        <CardContent className="p-0">
          {halls.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No halls yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {halls.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{h.name} {!h.active && <Badge>Off</Badge>}</p>
                    <p className="text-sm text-slate-500">Up to {h.capacity} guests · rent {formatCurrency(h.rent)}{h.notes ? ` · ${h.notes}` : ""}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setHall(h)} aria-label={`Edit ${h.name}`}><Pencil className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Per-plate packages" description="Set menus with a price per plate. You can still change the menu for each function." action={<Button size="sm" onClick={() => setPkg({})}><Plus className="h-4 w-4" /> Add package</Button>} />
        <CardContent className="p-0">
          {packages.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No packages yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {packages.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{p.name} {!p.active && <Badge>Off</Badge>}</p>
                    <p className="text-sm text-slate-500">
                      {formatCurrency(p.pricePerPlate)} a plate · {p.foodType === "veg" ? "Veg" : p.foodType === "non_veg" ? "Non-veg" : "Veg + non-veg"} · {parseMenu(p.menu).length} courses{p.minGuests ? ` · min ${p.minGuests} guests` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setPkg(p)} aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {hall && <HallDialog hall={hall} onClose={() => setHall(null)} onSaved={() => { setHall(null); onChanged(); }} />}
      {pkg && <PackageDialog pkg={pkg} onClose={() => setPkg(null)} onSaved={() => { setPkg(null); onChanged(); }} />}
    </div>
  );
}
