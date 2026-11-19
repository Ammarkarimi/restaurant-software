"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Plus, Send, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, Select, Tabs, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { parsePurchaseLines } from "@/lib/purchases";
import { formatCurrency, formatDate } from "@/lib/utils";

interface StockOption {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  active: boolean;
}

interface Transfer {
  id: string;
  number: number;
  fromName: string;
  toName: string;
  status: string;
  lines: string;
  total: number;
  notes: string | null;
  sentOn: string;
  sentByName: string;
  receivedOn: string | null;
  receivedByName: string | null;
}

interface Data {
  sent: Transfer[];
  incoming: Transfer[];
  outlets: Array<{ id: string; name: string }>;
}

const VARIANT: Record<string, string> = { sent: "warning", received: "success", cancelled: "cancelled" };
const LABEL: Record<string, string> = { sent: "On the way", received: "Received", cancelled: "Cancelled" };
const qty = (n: number) => String(Math.round(n * 1000) / 1000);

function SendDialog({ outlets, stock, onClose, onSaved }: { outlets: Data["outlets"]; stock: StockOption[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [to, setTo] = useState(outlets[0]?.id ?? "");
  const [lines, setLines] = useState([{ stockItemId: "", quantity: "" }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const usable = lines.filter((l) => l.stockItemId && Number(l.quantity) > 0);
  async function save() {
    setSaving(true);
    try {
      await api("/api/stock/transfers", { body: { toRestaurantId: to, lines: usable.map((l) => ({ stockItemId: l.stockItemId, quantity: Number(l.quantity) })), notes: notes || null } });
      toast("Stock sent. The other outlet adds it to their stock when it arrives.");
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
      size="lg"
      title="Send stock to an outlet"
      description="It leaves your stock now and is added to theirs when they press Received."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!to || !usable.length} onClick={save}><Send className="h-4 w-4" /> Send</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Send to">
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>
        </Field>
        {lines.map((l, i) => {
          const item = stock.find((s) => s.id === l.stockItemId);
          return (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <Field label={i === 0 ? "Item" : undefined} className="min-w-48 flex-1">
                <Select value={l.stockItemId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, stockItemId: e.target.value } : x)))} aria-label="Item">
                  <option value="">Choose…</option>
                  {stock
                    .filter((s) => s.active && s.quantity > 0)
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({qty(s.quantity)} {s.unit} in stock)</option>
                    ))}
                </Select>
              </Field>
              <Field label={i === 0 ? `Quantity${item ? ` (${item.unit})` : ""}` : undefined} className="w-36">
                <Input type="number" min={0} step="0.001" max={item?.quantity} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} aria-label="Quantity" />
              </Field>
              {lines.length > 1 && (
                <Button variant="ghost" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          );
        })}
        <Button size="sm" variant="outline" onClick={() => setLines([...lines, { stockItemId: "", quantity: "" }])}><Plus className="h-4 w-4" /> Add item</Button>
        <Field label="Note" optional>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sent with Raju in the van" />
        </Field>
      </div>
    </Modal>
  );
}

function TransferRow({ t, incoming, onAction }: { t: Transfer; incoming: boolean; onAction: (t: Transfer, action: "receive" | "cancel") => void }) {
  const lines = parsePurchaseLines(t.lines);
  return (
    <li className="flex flex-col gap-2 px-5 py-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
          #{t.number} · {incoming ? `from ${t.fromName}` : `to ${t.toName}`}
          <Badge variant={VARIANT[t.status]}>{LABEL[t.status]}</Badge>
          <span className="text-sm font-normal text-slate-500">
            sent {formatDate(t.sentOn)} by {t.sentByName}
            {t.receivedOn && ` · received ${formatDate(t.receivedOn)}${t.receivedByName ? ` by ${t.receivedByName}` : ""}`}
          </span>
        </p>
        <p className="text-sm text-slate-600">{lines.map((l) => `${l.name} ${qty(l.quantity)} ${l.unit}`).join(", ")}</p>
        {t.notes && <p className="text-sm text-slate-500">{t.notes}</p>}
      </div>
      <span className="font-semibold text-slate-900">{formatCurrency(t.total)}</span>
      {t.status === "sent" && (incoming ? <Button size="sm" onClick={() => onAction(t, "receive")}>Received</Button> : <Button size="sm" variant="ghost" onClick={() => onAction(t, "cancel")}>Cancel</Button>)}
    </li>
  );
}

export function TransfersTab() {
  const { toast, confirm } = useApp();
  const [data, setData] = useState<Data | null>(null);
  const [stock, setStock] = useState<StockOption[]>([]);
  const [view, setView] = useState<"incoming" | "sent">("incoming");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    Promise.all([api<Data>("/api/stock/transfers"), api<{ items: StockOption[] }>("/api/stock")]).then(
      ([d, s]) => {
        setData(d);
        setStock(s.items);
      },
      (e) => toast((e as Error).message, "error")
    );
  }, [toast]);
  useEffect(() => load(), [load]);

  async function act(t: Transfer, action: "receive" | "cancel") {
    if (action === "cancel") {
      const ok = await confirm({ title: `Cancel transfer #${t.number}?`, message: "The items go back into your stock.", confirmText: "Cancel transfer", danger: true });
      if (!ok) return;
    }
    try {
      await api(`/api/stock/transfers/${t.id}`, { body: { action } });
      toast(action === "receive" ? "Added to your stock" : "Transfer cancelled; the items are back in stock");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  if (!data) return <Loading />;
  const waiting = data.incoming.filter((t) => t.status === "sent").length;
  const list = view === "incoming" ? data.incoming : data.sent;

  return (
    <div className="space-y-4">
      {data.outlets.length === 0 && data.incoming.length === 0 ? (
        <Tip>
          Transfers move stock between your outlets, for example from a central kitchen to each branch. They show up once your software provider links your other outlets to your sign-in.
        </Tip>
      ) : (
        <Tip>Stock leaves the outlet that sends it straight away and is added to the other outlet when they press <b>Received</b>. Items are matched by name; anything new is added to their stock list.</Tip>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: "incoming", label: "Coming in", count: waiting || undefined },
            { value: "sent", label: "Sent" },
          ]}
        />
        {data.outlets.length > 0 && (
          <Button onClick={() => setSending(true)}><Send className="h-5 w-5" /> Send stock</Button>
        )}
      </div>
      <Card>
        {list.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={view === "incoming" ? <ArrowDownToLine className="h-6 w-6" /> : <ArrowUpFromLine className="h-6 w-6" />}
              title={view === "incoming" ? "Nothing on the way to you" : "Nothing sent yet"}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((t) => (
              <TransferRow key={t.id} t={t} incoming={view === "incoming"} onAction={act} />
            ))}
          </ul>
        )}
      </Card>
      {sending && <SendDialog outlets={data.outlets} stock={stock} onClose={() => setSending(false)} onSaved={() => { setSending(false); setView("sent"); load(); }} />}
    </div>
  );
}
