"use client";

import { useEffect, useState } from "react";

/** "Pay by UPI" on the guest's digital bill: a QR for the exact amount; the bill closes itself when paid. */
export function PayOnline({ token, amount, currency }: { token: string; amount: number; currency: string }) {
  const [qr, setQr] = useState<{ id: string; imageUrl: string; status: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);

  async function start() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/bill-pay/${encodeURIComponent(token)}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the payment");
      setQr(data.qr);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!qr || qr.status !== "pending") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/public/bill-pay/${encodeURIComponent(token)}?qr=${qr.id}`).catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (data?.status && data.status !== qr.status) {
        setQr({ ...qr, status: data.status });
        if (data.status === "paid") setTimeout(() => window.location.reload(), 1500);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [qr, token]);

  return (
    <div className="no-print mx-auto mt-4 max-w-sm rounded-2xl bg-white p-4 text-center shadow">
      {!qr ? (
        <>
          <button onClick={start} disabled={loading} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
            {loading ? "Please wait…" : `Pay ${money} by UPI`}
          </button>
          <p className="mt-2 text-xs text-slate-500">Scan with any UPI app. The restaurant sees your payment straight away.</p>
        </>
      ) : qr.status === "paid" ? (
        <p className="text-lg font-bold text-emerald-700">Paid ✓ Thank you!</p>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.imageUrl} alt="UPI QR code" className="mx-auto h-60 w-60 object-contain" />
          <p className="mt-2 font-semibold text-slate-800">Scan to pay {money}</p>
          <p className="text-sm text-slate-500">Waiting for your payment…</p>
        </>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
