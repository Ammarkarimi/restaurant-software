"use client";

// Offline billing: works with no internet from the menu saved on this device. Bills get their own
// number series (e.g. OFFKQ-12), print on the counter printer, and go to the server by themselves
// when the internet is back.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudOff, Minus, Plus, Printer, RefreshCw, Search, Trash2, Wifi } from "lucide-react";
import { offlineTotals, type OfflineBill, type OfflineBootstrap, type OfflineMenuItem } from "@/lib/offline";
import { getBootstrap, getDone, getQueue, nextOfflineBillNumber, refreshBootstrap, saveOfflineBill, syncOfflineBills } from "@/lib/offline-client";
import { todayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Line = { key: string; item: OfflineMenuItem; variant: string | null; price: number; quantity: number };
type OrderType = "dine_in" | "takeaway" | "delivery";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function printHtml(body: string) {
  const f = document.createElement("iframe");
  Object.assign(f.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(f);
  const doc = f.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; width: 72mm; margin: 0; }
    h1 { font-size: 15px; margin: 0; text-align: center; } .c { text-align: center; } .r { text-align: right; }
    table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
    hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; } .b { font-weight: bold; } .big { font-size: 15px; }
  </style></head><body>${body}</body></html>`);
  doc.close();
  setTimeout(() => {
    f.contentWindow?.focus();
    f.contentWindow?.print();
    setTimeout(() => f.remove(), 30_000);
  }, 50);
}

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

function billHtml(boot: OfflineBootstrap, bill: OfflineBill) {
  const r = boot.restaurant;
  const t = offlineTotals(bill);
  const m = (n: number) => money(n, r.currency);
  const when = new Date(bill.paidAt).toLocaleString("en-IN", { timeZone: r.timezone, dateStyle: "medium", timeStyle: "short" });
  const taxRows =
    bill.rules.taxMode === "gst"
      ? t.taxLines.flatMap((l) => [`<tr><td>CGST @${l.rate / 2}%</td><td class="r">${m(l.tax / 2)}</td></tr>`, `<tr><td>SGST @${l.rate / 2}%</td><td class="r">${m(l.tax / 2)}</td></tr>`])
      : t.tax
        ? [`<tr><td>${esc(bill.rules.taxName)}</td><td class="r">${m(t.tax)}</td></tr>`]
        : [];
  return `<h1>${esc(r.name)}</h1>
  ${r.address ? `<p class="c">${esc(r.address)}</p>` : ""}${r.phone ? `<p class="c">Ph: ${esc(r.phone)}</p>` : ""}
  ${r.gstin ? `<p class="c">GSTIN: ${esc(r.gstin)}</p>` : ""}${r.fssai ? `<p class="c">FSSAI: ${esc(r.fssai)}</p>` : ""}
  <hr><p>Bill: <b>${esc(bill.billNumber)}</b><br>${when}${bill.tableName ? `<br>Table: ${esc(bill.tableName)}` : ""}${bill.customerName ? `<br>${esc(bill.customerName)}` : ""}</p><hr>
  <table>${bill.items.map((i) => `<tr><td>${esc(i.name)}${i.variant ? ` (${esc(i.variant)})` : ""}<br>${i.quantity} × ${m(i.price)}</td><td class="r">${m(i.price * i.quantity)}</td></tr>`).join("")}</table><hr>
  <table><tr><td>Items</td><td class="r">${m(t.itemsTotal)}</td></tr>
  ${t.discount ? `<tr><td>Discount</td><td class="r">−${m(t.discount)}</td></tr>` : ""}
  ${t.serviceCharge ? `<tr><td>Service charge</td><td class="r">${m(t.serviceCharge)}</td></tr>` : ""}
  ${t.charges.filter((c) => c.amount).map((c) => `<tr><td>${esc(c.name)}</td><td class="r">${m(c.amount)}</td></tr>`).join("")}
  ${taxRows.join("")}
  ${t.roundOff ? `<tr><td>Round off</td><td class="r">${m(t.roundOff)}</td></tr>` : ""}
  <tr class="b big"><td>Total</td><td class="r">${m(t.total)}</td></tr></table><hr>
  <p>Paid: ${bill.payments.map((p) => `${p.method.toUpperCase()} ${m(p.amount)}`).join(" + ")}</p>
  <p class="c">${esc(r.footer).replace(/\n/g, "<br>")}</p>`;
}

function kotHtml(boot: OfflineBootstrap, lines: Line[], label: string) {
  return `<h1>KITCHEN ORDER</h1><p class="c big b">${esc(label)}</p><p class="c">${new Date().toLocaleTimeString("en-IN", { timeZone: boot.restaurant.timezone, hour: "2-digit", minute: "2-digit" })} · offline</p><hr>
  <table>${lines.map((l) => `<tr class="big"><td class="b">${l.quantity} ×</td><td>${esc(l.item.name)}${l.variant ? ` (${esc(l.variant)})` : ""}</td></tr>`).join("")}</table><hr>`;
}

export default function OfflineBillingPage() {
  const [boot, setBoot] = useState<OfflineBootstrap | null>(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [type, setType] = useState<OrderType>("takeaway");
  const [table, setTable] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [discount, setDiscount] = useState("");
  const [pending, setPending] = useState(0);
  const [recent, setRecent] = useState<Array<OfflineBill & { orderNumber?: number }>>([]);
  const [message, setMessage] = useState("");
  const [pick, setPick] = useState<OfflineMenuItem | null>(null);

  const refreshLists = useCallback(() => {
    setPending(getQueue().length);
    setRecent([...getQueue(), ...getDone()].sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1)).slice(0, 12));
  }, []);

  const trySync = useCallback(async () => {
    if (!navigator.onLine || !getQueue().length) return;
    const r = await syncOfflineBills();
    if (r.synced) setMessage(`${r.synced} offline bill${r.synced === 1 ? "" : "s"} saved to your account ✓`);
    refreshLists();
  }, [refreshLists]);

  useEffect(() => {
    setBoot(getBootstrap());
    setOnline(navigator.onLine);
    refreshLists();
    setReady(true);
    if (navigator.onLine) refreshBootstrap().then((b) => b && setBoot(b));
    const up = () => {
      setOnline(true);
      trySync();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const t = setInterval(trySync, 30_000);
    trySync();
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      clearInterval(t);
    };
  }, [refreshLists, trySync]);

  const categories = useMemo(() => [...new Set(boot?.menu.map((m) => m.category) ?? [])], [boot]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (boot?.menu ?? []).filter((m) => (cat === "all" || m.category === cat) && (!s || m.name.toLowerCase().includes(s) || m.shortCode?.toLowerCase() === s));
  }, [boot, q, cat]);

  if (!ready) return null;
  if (!boot) {
    return (
      <main className="mx-auto max-w-lg p-6 text-center">
        <CloudOff className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-3 text-xl font-bold">Offline billing is not ready on this device yet</h1>
        <p className="mt-2 text-slate-600">Open the app once while the internet works and sign in. The menu is then saved on this device, and you can bill here even when the internet goes.</p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-orange-600 px-4 py-2 font-semibold text-white">Open the app</Link>
      </main>
    );
  }

  const r = boot.restaurant;
  const m = (n: number) => money(n, r.currency);
  const discountValue = Math.max(0, Number(discount) || 0);
  const draft = {
    type,
    discount: discountValue,
    rules: boot.rules,
    items: lines.map((l) => ({ menuItemId: l.item.id, name: l.item.name, variant: l.variant, category: l.item.category, foodType: l.item.foodType, price: l.price, quantity: l.quantity, taxRate: l.item.taxRate })),
  };
  const totals = lines.length ? offlineTotals(draft) : null;
  const label = type === "dine_in" ? `Table ${table || "?"}` : type === "delivery" ? "Delivery" : "Takeaway";

  function add(item: OfflineMenuItem, variant: { name: string; price: number } | null) {
    const key = `${item.id}|${variant?.name ?? ""}`;
    setLines((ls) => (ls.some((l) => l.key === key) ? ls.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)) : [...ls, { key, item, variant: variant?.name ?? null, price: variant?.price ?? item.price, quantity: 1 }]));
    setPick(null);
  }

  function pay(method: "cash" | "upi" | "card") {
    if (!totals || !boot) return;
    if (type === "dine_in" && !table) return setMessage("Choose the table first.");
    const now = new Date();
    const bill: OfflineBill = {
      clientId: `off_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
      billNumber: nextOfflineBillNumber(r.billPrefix),
      tableName: type === "dine_in" ? table : null,
      customerName: customer.name.trim() || null,
      customerPhone: customer.phone.trim() || null,
      createdAt: now,
      paidAt: now,
      businessDate: todayKey(r.timezone, now),
      ...draft,
      payments: totals.total > 0 ? [{ method, amount: totals.total }] : [],
      total: totals.total,
    };
    saveOfflineBill(bill);
    printHtml(billHtml(boot, bill));
    setLines([]);
    setDiscount("");
    setCustomer({ name: "", phone: "" });
    setMessage(`Bill ${bill.billNumber} saved on this device · ${m(totals.total)} by ${method.toUpperCase()}`);
    refreshLists();
    trySync();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className={cn("sticky top-0 z-10 flex flex-wrap items-center gap-3 px-4 py-2 text-white", online ? "bg-emerald-700" : "bg-red-700")}>
        {online ? <Wifi className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
        <p className="font-semibold">
          {online ? "Internet is back." : "No internet — offline billing."} {pending > 0 ? `${pending} bill${pending === 1 ? "" : "s"} waiting to sync.` : "All bills are synced."}
        </p>
        <span className="ml-auto flex items-center gap-2">
          {online && pending > 0 && (
            <button onClick={trySync} className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1 text-sm font-semibold">
              <RefreshCw className="h-4 w-4" /> Sync now
            </button>
          )}
          {online && (
            <Link href="/" className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-emerald-800">
              Back to normal billing
            </Link>
          )}
        </span>
      </header>
      {message && (
        <p className="mx-4 mt-3 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm" role="status">
          {message}
        </p>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes or type a short code" className="w-full bg-transparent outline-none" aria-label="Search dishes" />
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {["all", ...categories].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn("shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold", cat === c ? "bg-orange-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}>
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((item) => (
              <button
                key={item.id}
                disabled={!item.available}
                onClick={() => (item.variants.length ? setPick(item) : add(item, null))}
                className="rounded-xl bg-white p-3 text-left ring-1 ring-slate-200 hover:ring-orange-400 disabled:opacity-40"
              >
                <span className="flex items-start gap-1.5">
                  <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-sm border-2", item.foodType === "veg" ? "border-emerald-600" : item.foodType === "egg" ? "border-amber-500" : "border-red-600")} />
                  <span className="font-semibold leading-tight text-slate-900">{item.name}</span>
                </span>
                <span className="mt-1 block text-sm text-slate-500">{item.variants.length ? `from ${m(Math.min(...item.variants.map((v) => v.price)))}` : m(item.price)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Menu saved {new Date(boot.savedAt).toLocaleString("en-IN", { timeZone: r.timezone, dateStyle: "medium", timeStyle: "short" })}. Special prices and offers are not used offline.</p>
        </section>

        <aside className="space-y-3 lg:sticky lg:top-14 lg:self-start">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
              {(["dine_in", "takeaway", "delivery"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)} className={cn("rounded-lg py-1.5", type === t ? "bg-white shadow-sm" : "text-slate-500")}>
                  {t === "dine_in" ? "Dine-in" : t === "takeaway" ? "Takeaway" : "Delivery"}
                </button>
              ))}
            </div>
            {type === "dine_in" && (
              <select value={table} onChange={(e) => setTable(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5" aria-label="Table">
                <option value="">Choose table…</option>
                {boot.tables.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Customer name" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" aria-label="Customer name" />
              <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone" inputMode="tel" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" aria-label="Customer phone" />
            </div>
            <ul className="mt-3 max-h-[40vh] divide-y divide-slate-100 overflow-y-auto">
              {lines.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Tap dishes to add them.</li>}
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{l.item.name}{l.variant ? ` (${l.variant})` : ""}</span>
                  <button aria-label={`One less ${l.item.name}`} onClick={() => setLines((ls) => ls.flatMap((x) => (x.key !== l.key ? [x] : x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : [])))} className="rounded-md p-1 ring-1 ring-slate-200">
                    {l.quantity > 1 ? <Minus className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                  <b className="w-5 text-center">{l.quantity}</b>
                  <button aria-label={`One more ${l.item.name}`} onClick={() => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: x.quantity + 1 } : x)))} className="rounded-md p-1 ring-1 ring-slate-200">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-20 text-right font-semibold">{m(l.price * l.quantity)}</span>
                </li>
              ))}
            </ul>
            {totals && (
              <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-sm">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Discount (₹)</span>
                  <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right" aria-label="Discount" />
                </label>
                {totals.tax > 0 && (
                  <p className="flex justify-between text-slate-600"><span>Tax</span><span>{m(totals.tax)}</span></p>
                )}
                {totals.chargesTotal > 0 && (
                  <p className="flex justify-between text-slate-600"><span>Charges</span><span>{m(totals.chargesTotal)}</span></p>
                )}
                <p className="flex justify-between text-lg font-bold"><span>Total</span><span>{m(totals.total)}</span></p>
              </div>
            )}
            <div className="mt-3 grid gap-2">
              <button disabled={!lines.length} onClick={() => printHtml(kotHtml(boot, lines, label))} className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold ring-1 ring-slate-300 disabled:opacity-40">
                <Printer className="h-4 w-4" /> Print KOT
              </button>
              <div className="grid grid-cols-3 gap-2">
                {(["cash", "upi", "card"] as const).map((method) => (
                  <button key={method} disabled={!lines.length} onClick={() => pay(method)} className="rounded-xl bg-orange-600 px-2 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-40">
                    Paid by {method.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-slate-500">Prints the bill and saves it on this device.</p>
            </div>
          </div>

          {recent.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="mb-2 font-semibold text-slate-800">Offline bills</p>
              <ul className="divide-y divide-slate-100 text-sm">
                {recent.map((b) => {
                  const waiting = getQueue().find((x) => x.clientId === b.clientId);
                  return (
                    <li key={b.clientId} className="flex items-center gap-2 py-1.5">
                      <span className="flex-1">
                        <b>{b.billNumber}</b> · {m(b.total)}
                        <span className={cn("ml-2 text-xs", waiting ? (waiting.error ? "text-red-700" : "text-amber-700") : "text-emerald-700")}>
                          {waiting ? (waiting.error ? `not saved: ${waiting.error}` : "waiting to sync") : `synced · order #${b.orderNumber}`}
                        </span>
                      </span>
                      <button onClick={() => printHtml(billHtml(boot, b))} className="text-xs font-semibold text-orange-700">Reprint</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {pick && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/50 sm:items-center" onClick={() => setPick(null)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Choose portion of ${pick.name}`}>
            <p className="mb-3 font-bold">{pick.name}</p>
            <div className="grid gap-2">
              {pick.variants.map((v) => (
                <button key={v.name} onClick={() => add(pick, v)} className="flex justify-between rounded-xl px-4 py-2 ring-1 ring-slate-200 hover:ring-orange-400">
                  <span>{v.name}</span>
                  <b>{m(v.price)}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
