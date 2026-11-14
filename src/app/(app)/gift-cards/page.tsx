"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, MessageCircle, Plus, Printer, Search, Wallet } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, StatCard, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { formatCurrency, formatDate, formatDateTime, label } from "@/lib/utils";

interface Card {
  id: string;
  code: string;
  amount: number;
  balance: number;
  buyerName: string | null;
  buyerPhone: string | null;
  recipientName: string | null;
  message: string | null;
  expiresOn: string | null;
  status: string;
  soldMethod: string;
  soldOn: string;
  soldByName: string;
}

interface Txn {
  id: string;
  type: string;
  amount: number;
  balance: number;
  billNumber: string | null;
  createdByName: string;
  createdAt: string;
}

const TXN_LABEL: Record<string, string> = { sold: "Sold", redeemed: "Paid a bill", refund: "Put back", cancelled: "Cancelled" };

function addYear(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function state(c: Card, today: string): { text: string; variant: string } {
  if (c.status !== "active") return { text: "Cancelled", variant: "cancelled" };
  if (c.expiresOn && c.expiresOn < today) return { text: "Expired", variant: "default" };
  if (c.balance <= 0) return { text: "Used up", variant: "default" };
  return { text: "Active", variant: "success" };
}

function shareText(c: Card, restaurant: string) {
  return [
    `${c.recipientName ? `Dear ${c.recipientName}, here` : "Here"} is your gift card for ${restaurant} worth ${formatCurrency(c.amount)}.`,
    c.message ? `“${c.message}”` : "",
    `Card number: ${c.code}`,
    c.expiresOn ? `Use it before ${formatDate(c.expiresOn)}.` : "",
    "Show this number when you pay your bill.",
  ]
    .filter(Boolean)
    .join("\n");
}

function SellDialog({ today, onClose, onSold }: { today: string; onClose: () => void; onSold: (c: Card) => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({ amount: "", method: "cash", buyerName: "", buyerPhone: "", recipientName: "", message: "", expiresOn: addYear(today) });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  async function save() {
    setSaving(true);
    try {
      const r = await api<{ card: Card }>("/api/gift-cards", { body: { ...f, amount: Number(f.amount) } });
      toast(`Gift card ${r.card.code} sold`);
      onSold(r.card);
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Sell a gift card"
      description="The guest pays now; the card pays their bills later. It is counted as a sale only when it is spent."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!(Number(f.amount) > 0)} onClick={save}>Payment received · make card</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Value">
          <Input type="number" min={1} value={f.amount} onChange={(e) => set({ amount: e.target.value })} autoFocus />
        </Field>
        <div className="flex items-end gap-2">
          {[500, 1000, 2000].map((n) => (
            <Button key={n} variant="outline" size="sm" onClick={() => set({ amount: String(n) })}>{formatCurrency(n)}</Button>
          ))}
        </div>
        <Field label="Paid by">
          <Select value={f.method} onChange={(e) => set({ method: e.target.value })}>
            {["cash", "upi", "card"].map((m) => (
              <option key={m} value={m}>{label(m)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Use before" optional hint="Leave empty for no expiry">
          <Input type="date" min={today} value={f.expiresOn} onChange={(e) => set({ expiresOn: e.target.value })} />
        </Field>
        <Field label="Bought by" optional>
          <Input value={f.buyerName} onChange={(e) => set({ buyerName: e.target.value })} />
        </Field>
        <Field label="Buyer's phone" optional hint="To send the card on WhatsApp">
          <Input value={f.buyerPhone} onChange={(e) => set({ buyerPhone: e.target.value })} inputMode="tel" />
        </Field>
        <Field label="For" optional>
          <Input value={f.recipientName} onChange={(e) => set({ recipientName: e.target.value })} placeholder="Who gets the card" />
        </Field>
        <Field label="Message on the card" optional className="sm:col-span-2">
          <Textarea value={f.message} onChange={(e) => set({ message: e.target.value })} rows={2} placeholder="Happy birthday!" />
        </Field>
      </div>
    </Modal>
  );
}

function CardDialog({ card, today, restaurant, onClose, onChanged }: { card: Card; today: string; restaurant: string; onClose: () => void; onChanged: () => void }) {
  const { isAdmin, toast } = useApp();
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api<{ card: { txns: Txn[] } }>(`/api/gift-cards/${card.id}`).then((r) => setTxns(r.card.txns), () => setTxns([]));
  }, [card.id]);
  const st = state(card, today);
  async function cancel() {
    setSaving(true);
    try {
      await api(`/api/gift-cards/${card.id}`, { body: { reason, refund: Number(refund) || 0, refundMethod } });
      toast("Gift card cancelled");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={card.code}
      description={`${formatCurrency(card.balance)} left of ${formatCurrency(card.amount)} · sold ${formatDate(card.soldOn)} by ${card.soldByName}`}
      footer={
        cancelling ? (
          <>
            <Button variant="outline" onClick={() => setCancelling(false)}>Back</Button>
            <Button variant="danger" loading={saving} disabled={reason.trim().length < 2} onClick={cancel}>Cancel card</Button>
          </>
        ) : (
          <>
            {isAdmin && card.status === "active" && (
              <Button variant="ghost" className="mr-auto" onClick={() => setCancelling(true)}>Cancel card</Button>
            )}
            <a href={whatsappLink(card.buyerPhone, shareText(card, restaurant))} target="_blank" rel="noreferrer">
              <Button variant="outline"><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
            </a>
            <a href={`/print/gift-card/${card.id}`} target="_blank" rel="noreferrer">
              <Button><Printer className="h-4 w-4" /> Print card</Button>
            </a>
          </>
        )
      }
    >
      {cancelling ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Why" className="sm:col-span-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lost, sold by mistake, money returned…" autoFocus />
          </Field>
          <Field label="Money given back" optional hint={`Up to ${formatCurrency(card.balance)}. Saved as today's expense.`}>
            <Input type="number" min={0} max={card.balance} value={refund} onChange={(e) => setRefund(e.target.value)} />
          </Field>
          <Field label="Given back by">
            <Select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
              {["cash", "upi", "card", "bank"].map((m) => (
                <option key={m} value={m}>{label(m)}</option>
              ))}
            </Select>
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge variant={st.variant}>{st.text}</Badge>
            {card.recipientName && <span>For {card.recipientName}</span>}
            {card.buyerName && <span>· bought by {card.buyerName}</span>}
            {card.expiresOn && <span>· use before {formatDate(card.expiresOn)}</span>}
          </p>
          {!txns ? (
            <Loading />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    <b>{TXN_LABEL[t.type] ?? t.type}</b>
                    {t.billNumber && ` · bill ${t.billNumber}`}
                    <span className="block text-xs text-slate-500">{formatDateTime(t.createdAt)} · {t.createdByName}</span>
                  </span>
                  <span className="text-right">
                    <span className={t.amount < 0 ? "text-slate-900" : "text-emerald-700"}>{t.amount < 0 ? "−" : "+"}{formatCurrency(Math.abs(t.amount))}</span>
                    <span className="block text-xs text-slate-500">left {formatCurrency(t.balance)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function GiftCardsPage() {
  const { toast, settings } = useApp();
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ cards: Card[]; today: string; unspent: { count: number; amount: number } } | null>(null);
  const [selling, setSelling] = useState(false);
  const [open, setOpen] = useState<Card | null>(null);

  const load = useCallback(() => {
    api<NonNullable<typeof data>>(`/api/gift-cards${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`).then(setData, (e) => toast((e as Error).message, "error"));
  }, [q, toast]);
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  if (!data) return <Loading />;
  const soldThisMonth = data.cards.filter((c) => c.soldOn.slice(0, 7) === data.today.slice(0, 7));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gift cards"
        description="Sell prepaid cards for birthdays, festivals and office gifts. The guest pays with the card number at the counter."
        actions={<Button onClick={() => setSelling(true)}><Plus className="h-5 w-5" /> Sell gift card</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard title="Cards with money left" value={data.unspent.count} icon={<Gift className="h-5 w-5" />} />
        <StatCard title="Still to be spent" value={formatCurrency(data.unspent.amount)} subtitle="You owe this to card holders" icon={<Wallet className="h-5 w-5" />} tone="amber" />
        <StatCard title="Sold this month" value={formatCurrency(soldThisMonth.reduce((s, c) => s + c.amount, 0))} subtitle={`${soldThisMonth.length} cards`} tone="green" />
      </div>
      <Tip>To take a gift card at billing, choose <b>Gift card</b> under “Paid by” and type the card number. Part of a bill can be paid by card and the rest in cash or UPI.</Tip>
      <Card>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Card number, name or phone" className="border-0 shadow-none focus:ring-0" aria-label="Search gift cards" />
        </div>
        {data.cards.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Gift className="h-6 w-6" />} title={q ? "No card found" : "No gift cards yet"} description={q ? "Check the number and try again." : "Sell your first card: a guest pays, and gets a card number to spend later."} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.cards.map((c) => {
              const st = state(c, data.today);
              return (
                <li key={c.id}>
                  <button onClick={() => setOpen(c)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-slate-50">
                    <span className="w-36 font-mono font-semibold text-slate-900">{c.code}</span>
                    <span className="min-w-0 flex-1 text-sm text-slate-600">
                      {[c.recipientName && `For ${c.recipientName}`, c.buyerName && `from ${c.buyerName}`, `sold ${formatDate(c.soldOn)}`].filter(Boolean).join(" · ")}
                    </span>
                    <Badge variant={st.variant}>{st.text}</Badge>
                    <span className="w-32 text-right">
                      <b className="text-slate-900">{formatCurrency(c.balance)}</b>
                      <span className="block text-xs text-slate-500">of {formatCurrency(c.amount)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {selling && (
        <SellDialog
          today={data.today}
          onClose={() => setSelling(false)}
          onSold={(c) => {
            setSelling(false);
            setOpen(c);
            load();
          }}
        />
      )}
      {open && <CardDialog card={open} today={data.today} restaurant={settings.restaurantName} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load(); }} />}
    </div>
  );
}
