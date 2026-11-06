import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { runForRestaurant } from "@/lib/db";
import { getSettings, logoUrl } from "@/lib/settings";
import { can } from "@/lib/permissions";
import { loadEvent, serializeEvent } from "@/lib/banquet-server";
import { STATUS_LABEL, timeText, type BanquetStatus } from "@/lib/banquet";
import { amountInWords } from "@/lib/words";
import { formatAmount, formatDate, label } from "@/lib/utils";
import { pageCss } from "@/components/bill-view";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Banquet" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> };

/**
 * A4 prints for a function: the quotation / booking slip for the customer, the function sheet for
 * the kitchen and floor staff (no prices), and the GST tax invoice once the function is done.
 */
export default async function PrintBanquetPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");
  if (!can(session, "banquets")) notFound();
  const { id } = await params;
  const { kind: k } = await searchParams;
  const kind = k === "sheet" ? "sheet" : k === "invoice" ? "invoice" : "quote";
  const data = await runForRestaurant(session.restaurantId, async () => {
    try {
      return { settings: await getSettings(), event: serializeEvent(await loadEvent(id)) };
    } catch {
      return null;
    }
  });
  if (!data) notFound();
  const { settings, event: e } = data;
  if (kind === "invoice" && !e.invoiceNumber) notFound();
  const t = e.totals;
  const m = (n: number) => `₹${formatAmount(n)}`;
  const logo = logoUrl(settings);
  const gst = e.taxMode === "gst";
  const docTitle = kind === "invoice" ? "TAX INVOICE" : kind === "sheet" ? "FUNCTION SHEET" : e.status === "confirmed" || e.status === "completed" ? "BOOKING CONFIRMATION" : "QUOTATION";
  const Row = ({ k: key, v }: { k: string; v: React.ReactNode }) => (
    <tr>
      <td className="py-0.5 pr-4 align-top text-slate-500">{key}</td>
      <td className="py-0.5 font-semibold">{v}</td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{pageCss("a4")}</style>
      <PrintButton title={`${docTitle} · #${e.number}`} />
      <div className="py-6 print:py-0">
        <div className="print-sheet mx-auto w-[210mm] max-w-full bg-white p-[12mm] text-[13px] leading-relaxed text-slate-900 shadow print:w-auto print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-3">
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo && <img src={logo} alt="" className="h-16 w-16 object-contain" />}
              <div>
                <p className="text-xl font-bold">{settings.legalName || settings.restaurantName}</p>
                {settings.address && <p className="whitespace-pre-line text-slate-600">{settings.address}</p>}
                <p className="text-slate-600">{[settings.phone && `Ph: ${settings.phone}`, settings.email].filter(Boolean).join(" · ")}</p>
                {kind !== "sheet" && <p className="text-slate-600">{[settings.gstin && `GSTIN: ${settings.gstin}`, settings.fssai && `FSSAI: ${settings.fssai}`].filter(Boolean).join(" · ")}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tracking-wide">{docTitle}</p>
              {kind === "invoice" ? <p>Invoice <b>{e.invoiceNumber}</b><br />Date {e.businessDate ? formatDate(e.businessDate) : ""}</p> : <p>Booking <b>#{e.number}</b><br />{STATUS_LABEL[e.status as BanquetStatus]}</p>}
            </div>
          </header>

          <section className="mt-4 grid grid-cols-2 gap-6">
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-slate-500">{kind === "invoice" ? "Billed to" : "Customer"}</p>
              <p className="font-semibold">{e.company || e.customerName}</p>
              {e.company && <p>{e.customerName}</p>}
              <p>{e.customerPhone}{e.customerEmail ? ` · ${e.customerEmail}` : ""}</p>
              {e.customerGstin && kind !== "sheet" && <p>GSTIN: {e.customerGstin}</p>}
            </div>
            <table>
              <tbody>
                <Row k="Function" v={e.title || e.eventType} />
                <Row k="Date" v={formatDate(e.date)} />
                <Row k="Time" v={`${timeText(e.startTime)} – ${timeText(e.endTime)}`} />
                {e.hall && <Row k="Hall" v={e.hall.name} />}
                <Row k="Guests" v={kind === "invoice" ? `${t.plates} plates` : `${e.guests} expected${e.guaranteedGuests ? ` · ${e.guaranteedGuests} guaranteed` : ""}${e.finalGuests != null ? ` · ${e.finalGuests} on the day` : ""}`} />
              </tbody>
            </table>
          </section>

          {kind !== "invoice" && e.menu.length > 0 && (
            <section className="mt-5">
              <p className="mb-1 text-xs font-bold uppercase text-slate-500">Menu{e.packageName ? ` — ${e.packageName}` : ""}</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {e.menu.map((line, i) => (
                  <li key={i} className={kind === "sheet" ? "text-[15px]" : ""}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          {kind === "sheet" ? (
            <section className="mt-5 space-y-3">
              {e.extras.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase text-slate-500">Arrangements</p>
                  <ul className="list-disc pl-5">{e.extras.map((x, i) => <li key={i}>{x.name}</li>)}</ul>
                </div>
              )}
              {e.notes && (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase text-slate-500">Notes</p>
                  <p className="whitespace-pre-line text-[15px]">{e.notes}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs text-slate-500">
                <p className="border-t border-slate-400 pt-1">Kitchen</p>
                <p className="border-t border-slate-400 pt-1">Service captain</p>
                <p className="border-t border-slate-400 pt-1">Manager</p>
              </div>
            </section>
          ) : (
            <section className="mt-5">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
                    <th className="py-1.5">Description</th>
                    {kind === "invoice" && <th className="py-1.5">SAC</th>}
                    <th className="py-1.5 text-right">Qty</th>
                    <th className="py-1.5 text-right">Rate</th>
                    <th className="py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5">Food — {e.packageName ?? "per plate"}{gst ? ` (GST ${e.foodTaxRate}%)` : ""}</td>
                    {kind === "invoice" && <td>{settings.sacCode}</td>}
                    <td className="py-1.5 text-right">{t.plates}</td>
                    <td className="py-1.5 text-right">{m(e.pricePerPlate)}</td>
                    <td className="py-1.5 text-right">{m(t.food)}</td>
                  </tr>
                  {t.hallRent > 0 && (
                    <tr className="border-b border-slate-200">
                      <td className="py-1.5">Hall rent{e.hall ? ` — ${e.hall.name}` : ""}{gst ? ` (GST ${e.otherTaxRate}%)` : ""}</td>
                      {kind === "invoice" && <td>997212</td>}
                      <td className="py-1.5 text-right">1</td>
                      <td className="py-1.5 text-right">{m(t.hallRent)}</td>
                      <td className="py-1.5 text-right">{m(t.hallRent)}</td>
                    </tr>
                  )}
                  {e.extras.map((x, i) => (
                    <tr key={i} className="border-b border-slate-200">
                      <td className="py-1.5">{x.name}{gst ? ` (GST ${e.otherTaxRate}%)` : ""}</td>
                      {kind === "invoice" && <td>998596</td>}
                      <td className="py-1.5 text-right">1</td>
                      <td className="py-1.5 text-right">{m(x.amount)}</td>
                      <td className="py-1.5 text-right">{m(x.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex justify-end">
                <table className="w-80">
                  <tbody>
                    <tr><td className="py-0.5">Subtotal</td><td className="text-right">{m(t.subtotal)}</td></tr>
                    {t.discount > 0 && <tr><td className="py-0.5">Discount</td><td className="text-right">−{m(t.discount)}</td></tr>}
                    {t.taxLines.filter((l) => l.tax > 0).flatMap((l) =>
                      gst
                        ? [
                            <tr key={`c${l.rate}`}><td className="py-0.5">CGST @{l.rate / 2}% on {m(l.taxable)}</td><td className="text-right">{m(l.tax / 2)}</td></tr>,
                            <tr key={`s${l.rate}`}><td className="py-0.5">SGST @{l.rate / 2}% on {m(l.taxable)}</td><td className="text-right">{m(l.tax / 2)}</td></tr>,
                          ]
                        : [<tr key={l.rate}><td className="py-0.5">Tax @{l.rate}%</td><td className="text-right">{m(l.tax)}</td></tr>]
                    )}
                    {t.roundOff !== 0 && <tr><td className="py-0.5">Round off</td><td className="text-right">{m(t.roundOff)}</td></tr>}
                    <tr className="border-t-2 border-slate-800 text-base font-bold"><td className="py-1">Total</td><td className="text-right">{m(t.total)}</td></tr>
                    {e.paid !== 0 && <tr><td className="py-0.5">Paid</td><td className="text-right">{m(e.paid)}</td></tr>}
                    {e.paid !== 0 && <tr className="font-bold"><td className="py-0.5">{e.balance < 0 ? "To refund" : "Balance"}</td><td className="text-right">{m(Math.abs(e.balance))}</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-600">Amount in words: {amountInWords(t.total, settings.currency)}</p>
              {e.payments.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-bold uppercase text-slate-500">Payments received</p>
                  <ul>{e.payments.map((p) => <li key={p.id}>{formatDate(p.date)} — {p.amount < 0 ? "Refund " : ""}{m(Math.abs(p.amount))} by {label(p.method)}{p.reference ? ` (${p.reference})` : ""}{p.note ? ` · ${p.note}` : ""}</li>)}</ul>
                </div>
              )}
              {kind === "quote" && (
                <div className="mt-5 text-xs text-slate-600">
                  <p className="mb-1 font-bold uppercase text-slate-500">Terms</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    <li>The booking is confirmed on payment of the advance.</li>
                    <li>{e.guaranteedGuests ? `At least ${e.guaranteedGuests} plates are charged; ` : ""}the final guest count is to be given 48 hours before the function. Extra guests are charged per plate.</li>
                    <li>The balance is payable at the end of the function.</li>
                    <li>Prices include the GST shown above.</li>
                  </ul>
                </div>
              )}
              {kind === "invoice" && (
                <div className="mt-10 flex justify-end text-center text-xs text-slate-600">
                  <p className="w-56 border-t border-slate-400 pt-1">For {settings.legalName || settings.restaurantName}<br />Authorised signatory</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
