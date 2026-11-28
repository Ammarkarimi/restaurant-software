"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatCurrency, setCurrency } from "@/lib/utils";

interface ShownOrder {
  id: string;
  number: number;
  billNumber: string | null;
  status: string;
  table: string | null;
  customerName: string | null;
  items: Array<{ id: string; name: string; variant: string | null; quantity: number; amount: number }>;
  itemsTotal: number;
  discount: number;
  serviceCharge: number;
  charges: number;
  tax: number;
  roundOff: number;
  total: number;
}

interface Screen {
  restaurantName: string;
  upiId: string | null;
  currency: string;
  order: ShownOrder | null;
}

export function CustomerScreen({ restaurantName, logoUrl }: { restaurantName: string; logoUrl: string | null }) {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/api/display/customer", { cache: "no-store" })
        .then((r) => {
          if (r.status === 401) window.location.href = "/login";
          return r.ok ? r.json() : Promise.reject(new Error(String(r.status)));
        })
        .then((d: Screen) => {
          if (stop) return;
          setCurrency(d.currency);
          setScreen(d);
          setOffline(false);
        })
        .catch(() => !stop && setOffline(true));
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const order = screen?.order ?? null;
  const payable = order && order.status === "billed" && order.total > 0 && screen?.upiId ? order.total : 0;
  useEffect(() => {
    if (!payable || !screen?.upiId) return setQr(null);
    const link = `upi://pay?pa=${encodeURIComponent(screen.upiId)}&pn=${encodeURIComponent(restaurantName)}&am=${payable.toFixed(2)}&cu=${screen.currency}&tn=${encodeURIComponent(order?.billNumber ? `Bill ${order.billNumber}` : `Order ${order?.number}`)}`;
    QRCode.toDataURL(link, { margin: 1, width: 360 }).then(setQr, () => setQr(null));
  }, [payable, screen?.upiId, screen?.currency, restaurantName, order?.billNumber, order?.number]);

  const header = (
    <div className="flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logoUrl && <img src={logoUrl} alt="" className="h-16 w-16 rounded-2xl object-contain" />}
      <p className="text-3xl font-bold">{restaurantName}</p>
    </div>
  );

  if (!order) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-10 text-center text-slate-900">
        {header}
        <p className="text-2xl text-slate-600">Welcome! Your order will show here as it is entered.</p>
        {offline && <p className="text-slate-500">Reconnecting…</p>}
      </main>
    );
  }

  if (order.status === "settled") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-10 text-center text-slate-900">
        {header}
        <p className="text-5xl font-bold text-emerald-700">Thank you!</p>
        <p className="text-2xl text-slate-600">
          {formatCurrency(order.total)} received{order.billNumber ? ` · Bill ${order.billNumber}` : ""}. Please visit again.
        </p>
      </main>
    );
  }

  const Line = ({ l, v, big }: { l: string; v: string; big?: boolean }) => (
    <div className={big ? "flex justify-between border-t-2 border-slate-900 pt-3 text-4xl font-bold" : "flex justify-between text-xl text-slate-600"}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-white p-8 text-slate-900 lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        {header}
        <p className="text-xl text-slate-600">
          {order.table ? `Table ${order.table}` : `Order #${order.number}`}
          {order.customerName ? ` · ${order.customerName}` : ""}
        </p>
        <ul className="flex-1 divide-y divide-slate-200 overflow-y-auto text-2xl">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-3">
              <span>
                <b className="mr-3 tabular-nums">{i.quantity}×</b>
                {i.name}
                {i.variant && <span className="text-slate-500"> ({i.variant})</span>}
              </span>
              <span className="tabular-nums">{formatCurrency(i.amount)}</span>
            </li>
          ))}
          {order.items.length === 0 && <li className="py-3 text-slate-500">Adding your order…</li>}
        </ul>
      </section>
      <aside className="flex w-full flex-col gap-3 rounded-3xl bg-slate-50 p-6 lg:w-[420px]">
        <Line l="Items" v={formatCurrency(order.itemsTotal)} />
        {order.discount > 0 && <Line l="Discount" v={`− ${formatCurrency(order.discount)}`} />}
        {order.serviceCharge > 0 && <Line l="Service charge" v={formatCurrency(order.serviceCharge)} />}
        {order.charges > 0 && <Line l="Packing / delivery" v={formatCurrency(order.charges)} />}
        {order.tax > 0 && <Line l="Tax" v={formatCurrency(order.tax)} />}
        {order.roundOff !== 0 && <Line l="Round off" v={formatCurrency(order.roundOff)} />}
        <Line l="To pay" v={formatCurrency(order.total)} big />
        {qr ? (
          <div className="mt-4 flex flex-col items-center gap-2 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="UPI QR code to pay" className="h-72 w-72" />
            <p className="text-lg font-semibold">Scan with any UPI app to pay {formatCurrency(order.total)}</p>
          </div>
        ) : (
          order.status === "open" && <p className="mt-4 text-center text-lg text-slate-500">The QR code to pay appears when your bill is ready.</p>
        )}
      </aside>
    </main>
  );
}
