"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Armchair, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, Modal, PageHeader, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import type { TableDTO } from "@/lib/types";

export default function TableSetupPage() {
  const { toast, confirm } = useApp();
  const [tables, setTables] = useState<TableDTO[] | null>(null);
  const [bulk, setBulk] = useState({ prefix: "T", from: "1", to: "10", area: "Main hall", seats: "4" });
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<TableDTO | null>(null);

  const load = useCallback(() => {
    api<{ tables: TableDTO[] }>("/api/tables").then((r) => setTables(r.tables), (e) => toast(e.message, "error"));
  }, [toast]);
  useEffect(() => load(), [load]);

  const areas = useMemo(() => {
    const map = new Map<string, TableDTO[]>();
    for (const t of tables ?? []) map.set(t.area, [...(map.get(t.area) ?? []), t]);
    return [...map.entries()];
  }, [tables]);

  async function addMany(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const r = await api<{ added: number; skipped: number }>("/api/tables", {
        body: { prefix: bulk.prefix, from: Number(bulk.from), to: Number(bulk.to), area: bulk.area, seats: Number(bulk.seats) },
      });
      toast(`${r.added} table(s) added${r.skipped ? `, ${r.skipped} already existed` : ""}`);
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit() {
    if (!edit) return;
    try {
      await api(`/api/tables/${edit.id}`, { method: "PATCH", body: { name: edit.name, area: edit.area, seats: edit.seats } });
      toast("Table saved");
      setEdit(null);
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function remove(t: TableDTO) {
    const ok = await confirm({ title: `Remove table ${t.name}?`, message: "Old bills for this table are kept.", confirmText: "Remove", danger: true });
    if (!ok) return;
    try {
      const r = await api<{ hidden?: boolean }>(`/api/tables/${t.id}`, { method: "DELETE" });
      toast(r.hidden ? `${t.name} hidden. It has old bills, so it is kept for reports.` : `${t.name} removed`);
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function show(t: TableDTO) {
    await api(`/api/tables/${t.id}`, { method: "PATCH", body: { active: true } }).catch((e) => toast(e.message, "error"));
    load();
  }

  if (!tables) return <Loading />;
  const knownAreas = [...new Set(tables.map((t) => t.area))];

  return (
    <div className="space-y-6">
      <PageHeader title="Table setup" description="Add your dining areas and tables. They appear on the Tables screen for taking orders." />

      <Card>
        <CardHeader title="Add tables" description="Add many at once, e.g. T1 to T10 in the Main hall. Use a different area for the garden, rooftop or AC hall." />
        <CardContent>
          <form onSubmit={addMany} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
            <Field label="Name starts with" hint="T → T1, T2…">
              <Input value={bulk.prefix} onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })} maxLength={20} />
            </Field>
            <Field label="From number">
              <Input type="number" min={0} value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: e.target.value })} required />
            </Field>
            <Field label="To number">
              <Input type="number" min={0} value={bulk.to} onChange={(e) => setBulk({ ...bulk, to: e.target.value })} required />
            </Field>
            <Field label="Area">
              <Input value={bulk.area} onChange={(e) => setBulk({ ...bulk, area: e.target.value })} list="areas" required />
            </Field>
            <Field label="Seats each">
              <Input type="number" min={1} value={bulk.seats} onChange={(e) => setBulk({ ...bulk, seats: e.target.value })} required />
            </Field>
            <Button type="submit" loading={adding}>
              <Plus className="h-5 w-5" /> Add tables
            </Button>
            <datalist id="areas">
              {knownAreas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </form>
          <p className="mt-2 text-sm text-slate-500">
            Will add: {Number(bulk.to) >= Number(bulk.from) ? `${bulk.prefix}${bulk.from} … ${bulk.prefix}${bulk.to} (${Number(bulk.to) - Number(bulk.from) + 1} tables)` : "—"} in {bulk.area}. For one table, use the same number in both boxes.
          </p>
        </CardContent>
      </Card>

      {tables.length === 0 ? (
        <EmptyState icon={<Armchair className="h-6 w-6" />} title="No tables yet" description="Use the form above to add your first tables." />
      ) : (
        areas.map(([area, list]) => (
          <Card key={area}>
            <CardHeader title={area} description={`${list.filter((t) => t.active).length} tables · ${list.filter((t) => t.active).reduce((s, t) => s + t.seats, 0)} seats`} />
            <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((t) => (
                <div key={t.id} className={`flex items-center justify-between gap-1 rounded-xl border px-3 py-2 ${t.active ? "border-slate-200" : "border-dashed border-slate-200 opacity-60"}`}>
                  <span className="min-w-0">
                    <span className="block font-bold text-slate-900">{t.name}</span>
                    <span className="block text-xs text-slate-500">{t.seats} seats {!t.active && <Badge>Hidden</Badge>}</span>
                  </span>
                  <span className="flex shrink-0">
                    {t.active ? (
                      <>
                        <button onClick={() => setEdit(t)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Edit ${t.name}`}><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(t)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${t.name}`}><Trash2 className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <button onClick={() => show(t)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Show ${t.name}`}><Eye className="h-4 w-4" /></button>
                    )}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Tip>Tip: name tables the way your staff say them out loud, e.g. “G1” for garden tables, so captains find them quickly.</Tip>

      {edit && (
        <Modal
          open
          onClose={() => setEdit(null)}
          title={`Edit table ${edit.name}`}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Table name">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Area">
              <Input value={edit.area} onChange={(e) => setEdit({ ...edit, area: e.target.value })} list="areas" />
            </Field>
            <Field label="Seats">
              <Input type="number" min={1} value={edit.seats} onChange={(e) => setEdit({ ...edit, seats: Number(e.target.value) })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
