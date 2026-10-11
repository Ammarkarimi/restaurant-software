// The printed bill. Pure markup (no hooks) so the print page (server) and the
// live preview in Settings → Bill design (browser) draw exactly the same thing.
import type { BillTemplate } from "@/lib/bill-template";
import { taxRowsFor, type BillTotals } from "@/lib/billing";
import { amountInWords } from "@/lib/words";
import { cn, formatAmount, label } from "@/lib/utils";

export interface BillProfile {
  restaurantName: string;
  legalName: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  fssai: string | null;
  currency: string;
}

export interface BillData {
  billNumber: string | null;
  orderNumber: number;
  type: string;
  tableName: string | null;
  guests: number;
  servedBy: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  date: string | Date;
  items: Array<{ name: string; variant: string | null; foodType: string; quantity: number; price: number; note: string | null }>;
  totals: BillTotals;
  taxMode: string;
  taxName: string;
  pricesIncludeTax: boolean;
  serviceChargePercent: number;
  discountLabel: string | null;
  payments: Array<{ method: string; amount: number }>;
  status: string;
}

const PAPER_WIDTH: Record<string, string> = { "58mm": "58mm", "80mm": "80mm", a4: "190mm" };
const FONT: Record<string, string> = {
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  sans: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', serif",
};
const SIZE: Record<string, Record<string, string>> = {
  thermal: { small: "11px", normal: "12.5px", large: "14px" },
  a4: { small: "12px", normal: "13.5px", large: "15px" },
};
const LOGO: Record<string, Record<string, string>> = {
  thermal: { small: "36px", medium: "56px", large: "80px" },
  a4: { small: "48px", medium: "72px", large: "96px" },
};

function formatBillDate(date: string | Date, timeZone: string) {
  const d = new Date(date);
  const opts = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { ...o, timeZone }).format(d);
  return { date: opts({ day: "2-digit", month: "2-digit", year: "numeric" }), time: opts({ hour: "2-digit", minute: "2-digit" }) };
}

function FoodDot({ type }: { type: string }) {
  const color = type === "non_veg" ? "#b91c1c" : type === "egg" ? "#d97706" : "#16a34a";
  return (
    <span style={{ display: "inline-block", width: "0.7em", height: "0.7em", border: `1.5px solid ${color}`, marginRight: "0.35em", verticalAlign: "middle", position: "relative" }}>
      <span style={{ position: "absolute", inset: "22%", borderRadius: "50%", background: color }} />
    </span>
  );
}

export function BillView({
  template: t,
  profile: p,
  bill: b,
  logoUrl,
  qrDataUrl,
  upiId,
  timezone,
}: {
  template: BillTemplate;
  profile: BillProfile;
  bill: BillData;
  logoUrl: string | null;
  qrDataUrl: string | null;
  upiId?: string | null;
  timezone: string;
}) {
  const a4 = t.paperSize === "a4";
  const kind = a4 ? "a4" : "thermal";
  const when = formatBillDate(b.date, timezone);
  const taxRows = taxRowsFor(b.totals, b.taxMode, b.taxName);
  const paid = b.payments.reduce((s, x) => s + x.amount, 0);
  const due = Math.round((b.totals.total - paid) * 100) / 100;
  const align = t.headerAlign === "center" ? "text-center" : "text-left";
  const address = [p.address, p.city].filter(Boolean).join(", ");
  const rule = a4 ? "border-t border-slate-300" : "border-t border-dashed border-black";
  const money = (n: number) => formatAmount(n);
  const where = b.type === "dine_in" ? (b.tableName ? `Table ${b.tableName}` : "Dine-in") : label(b.type);
  const showQr = t.showUpiQr && qrDataUrl && due > 0;

  const header = (
    <div className={cn(a4 ? "flex items-start gap-4" : align)}>
      {t.showLogo && logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          style={{ maxHeight: LOGO[kind][t.logoSize], maxWidth: a4 ? "40%" : "70%", objectFit: "contain", filter: a4 ? undefined : "grayscale(1) contrast(1.2)" }}
          className={cn(!a4 && (t.headerAlign === "center" ? "mx-auto" : ""), !a4 && "mb-1.5")}
        />
      )}
      <div className={cn(a4 && "min-w-0 flex-1")}>
        {t.showRestaurantName && (
          <p className="font-bold leading-tight" style={{ fontSize: a4 ? "1.6em" : "1.3em", color: a4 ? t.accentColor : undefined }}>
            {p.restaurantName}
          </p>
        )}
        {t.showLegalName && p.legalName && <p>{p.legalName}</p>}
        {t.showAddress && address && <p className="whitespace-pre-line">{address}</p>}
        {(t.showPhone && p.phone) || (t.showEmail && p.email) ? (
          <p>{[t.showPhone && p.phone && `Ph: ${p.phone}`, t.showEmail && p.email].filter(Boolean).join(" · ")}</p>
        ) : null}
        {t.showGstin && p.gstin && <p>GSTIN: {p.gstin}</p>}
        {t.showFssai && p.fssai && <p>FSSAI Lic. No: {p.fssai}</p>}
        {t.headerText && <p className="mt-1 whitespace-pre-line italic">{t.headerText}</p>}
      </div>
      {a4 && (
        <div className="shrink-0 text-right">
          {t.billTitle && (
            <p className="font-bold uppercase tracking-wide" style={{ fontSize: "1.4em", color: t.accentColor }}>
              {t.billTitle}
            </p>
          )}
          {t.showBillNumber && <p>Bill No: <b>{b.billNumber ?? "—"}</b></p>}
          {t.showDateTime && <p>{when.date} {when.time}</p>}
        </div>
      )}
    </div>
  );

  const infoPairs: Array<[string, string]> = [];
  if (!a4 && t.showDateTime) infoPairs.push(["Date", `${when.date} ${when.time}`]);
  if (!a4 && t.showBillNumber) infoPairs.push(["Bill No", b.billNumber ?? "—"]);
  if (t.showOrderType || t.showTable) infoPairs.push([b.type === "dine_in" && t.showTable ? "Table" : "Order", t.showTable ? where : label(b.type)]);
  infoPairs.push(["Order No", `#${b.orderNumber}`]);
  if (t.showGuests && b.guests > 0) infoPairs.push(["Guests", String(b.guests)]);
  if (t.showServedBy && b.servedBy) infoPairs.push(["Served by", b.servedBy]);

  const customer = t.showCustomer && (b.customerName || b.customerPhone);

  const itemsTable = (
    <table className="w-full border-collapse" style={{ tableLayout: "auto" }}>
      <thead>
        <tr className={cn(a4 ? "text-white" : "border-b border-dashed border-black")} style={a4 ? { background: t.accentColor } : undefined}>
          <th className={cn("text-left font-semibold", a4 ? "px-2 py-1.5" : "py-1")}>Item</th>
          <th className={cn("text-right font-semibold", a4 ? "px-2 py-1.5" : "py-1 pl-1")}>Qty</th>
          {t.showRateColumn && <th className={cn("text-right font-semibold", a4 ? "px-2 py-1.5" : "py-1 pl-1")}>Rate</th>}
          <th className={cn("text-right font-semibold", a4 ? "px-2 py-1.5" : "py-1 pl-1")}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {b.items.map((i, idx) => (
          <tr key={idx} className={cn("align-top", a4 && "border-b border-slate-200")}>
            <td className={cn(a4 ? "px-2 py-1.5" : "py-0.5")}>
              {t.showFoodTypeMark && <FoodDot type={i.foodType} />}
              {i.name}
              {i.variant && ` (${i.variant})`}
              {t.showItemNotes && i.note && <span className="block italic opacity-75">- {i.note}</span>}
            </td>
            <td className={cn("text-right", a4 ? "px-2 py-1.5" : "py-0.5 pl-1")}>{i.quantity}</td>
            {t.showRateColumn && <td className={cn("text-right", a4 ? "px-2 py-1.5" : "py-0.5 pl-1")}>{money(i.price)}</td>}
            <td className={cn("text-right", a4 ? "px-2 py-1.5" : "py-0.5 pl-1")}>{money(i.price * i.quantity)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const Line = ({ l, v, strong, muted }: { l: string; v: string; strong?: boolean; muted?: boolean }) => (
    <div className={cn("flex justify-between gap-3", strong && "font-bold", muted && "opacity-75")} style={strong ? { fontSize: "1.25em" } : undefined}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );

  const totals = (
    <div className={cn(a4 && "ml-auto w-80")}>
      <Line l={`Items total${t.showItemCount ? ` (${b.totals.itemCount})` : ""}`} v={money(b.totals.itemsTotal)} />
      {b.totals.discount > 0 && <Line l={`Discount${b.discountLabel ? ` (${b.discountLabel})` : ""}`} v={`-${money(b.totals.discount)}`} />}
      {b.totals.serviceCharge > 0 && <Line l={`Service charge (${b.serviceChargePercent}%)`} v={money(b.totals.serviceCharge)} />}
      {!b.pricesIncludeTax && taxRows.map((r) => <Line key={r.label} l={r.label} v={money(r.amount)} />)}
      {b.totals.roundOff !== 0 && <Line l="Round off" v={`${b.totals.roundOff > 0 ? "+" : ""}${money(b.totals.roundOff)}`} muted />}
      <div className={cn("my-1", a4 ? "border-t-2" : rule)} style={a4 ? { borderColor: t.accentColor } : undefined} />
      <Line l={`TOTAL (${p.currency})`} v={money(b.totals.total)} strong />
      {b.pricesIncludeTax && b.totals.tax > 0 && (
        <p className="opacity-75">
          Includes {taxRows.map((r) => `${r.label} ${money(r.amount)}`).join(", ")}
        </p>
      )}
      {t.showAmountInWords && <p className="mt-1 italic">{amountInWords(b.totals.total, p.currency)}</p>}
    </div>
  );

  const taxBreakup =
    t.showTaxBreakup && b.taxMode !== "none" && b.totals.taxLines.length > 0 ? (
      <table className="w-full border-collapse" style={{ fontSize: "0.9em" }}>
        <thead>
          <tr className={cn(a4 ? "border-b border-slate-300" : "border-b border-dashed border-black")}>
            <th className="text-left font-semibold">{b.taxMode === "gst" ? "GST %" : `${b.taxName} %`}</th>
            <th className="text-right font-semibold">Taxable</th>
            {b.taxMode === "gst" ? (
              <>
                <th className="text-right font-semibold">CGST</th>
                <th className="text-right font-semibold">SGST</th>
              </>
            ) : (
              <th className="text-right font-semibold">{b.taxName}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {b.totals.taxLines.map((l) => {
            const half = Math.round((l.tax / 2) * 100) / 100;
            return (
              <tr key={l.rate}>
                <td>{l.rate}%</td>
                <td className="text-right">{money(l.taxable)}</td>
                {b.taxMode === "gst" ? (
                  <>
                    <td className="text-right">{money(half)}</td>
                    <td className="text-right">{money(Math.round((l.tax - half) * 100) / 100)}</td>
                  </>
                ) : (
                  <td className="text-right">{money(l.tax)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    ) : null;

  const payments =
    t.showPayments && (b.payments.length > 0 || b.status === "settled") ? (
      <div>
        {b.payments.map((x, i) => (
          <Line key={i} l={`Paid by ${label(x.method)}`} v={money(x.amount)} />
        ))}
        {due > 0 && <Line l="Balance due" v={money(due)} />}
      </div>
    ) : due > 0 && b.status !== "open" ? (
      <Line l="Amount due" v={money(due)} strong />
    ) : null;

  return (
    <div
      className="print-sheet mx-auto bg-white text-black"
      style={{
        width: PAPER_WIDTH[t.paperSize],
        maxWidth: "100%",
        padding: a4 ? "0" : t.paperSize === "58mm" ? "2mm" : "3mm",
        fontFamily: FONT[t.fontStyle],
        fontSize: SIZE[kind][t.fontSize],
        lineHeight: 1.35,
      }}
    >
      {header}
      {!a4 && t.billTitle && (
        <>
          <div className={cn("my-1.5", rule)} />
          <p className="text-center font-bold uppercase tracking-wider">{t.billTitle}</p>
        </>
      )}
      <div className={cn(a4 ? "mt-4 grid grid-cols-2 gap-6 rounded border border-slate-200 p-3" : "mt-1")}>
        <div className={cn(!a4 && "grid grid-cols-2 gap-x-2")}>
          {infoPairs.map(([k, v]) => (
            <p key={k} className={cn(!a4 && (k === "Date" || k === "Served by") ? "col-span-2" : "truncate")}>
              <span className="opacity-75">{k}:</span> {v}
            </p>
          ))}
        </div>
        {customer && (
          <div className={cn(!a4 && "mt-0.5")}>
            {a4 && <p className="font-semibold" style={{ color: t.accentColor }}>Billed to</p>}
            <p>
              {!a4 && <span className="opacity-75">Customer: </span>}
              {[b.customerName, b.customerPhone].filter(Boolean).join(", ")}
            </p>
            {b.customerAddress && <p className="whitespace-pre-line">{b.customerAddress}</p>}
          </div>
        )}
      </div>
      <div className={cn(a4 ? "mt-4" : cn("my-1.5", rule))} />
      {itemsTable}
      <div className={cn(a4 ? "mt-3" : cn("my-1.5", rule))} />
      {totals}
      {payments && (
        <>
          <div className={cn(a4 ? "mt-3" : cn("my-1.5", rule))} />
          <div className={cn(a4 && "ml-auto w-80")}>{payments}</div>
        </>
      )}
      {taxBreakup && (
        <>
          <div className={cn(a4 ? "mt-4" : cn("my-1.5", rule))} />
          <div className={cn(a4 && "w-96")}>{taxBreakup}</div>
        </>
      )}
      {showQr && (
        <div className={cn("mt-2 flex flex-col items-center", a4 && "items-start")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl!} alt="UPI QR code" style={{ width: a4 ? "110px" : t.paperSize === "58mm" ? "28mm" : "36mm" }} />
          {t.upiQrText && <p className="text-center">{t.upiQrText}</p>}
          {upiId && <p className="text-center opacity-75">{upiId}</p>}
        </div>
      )}
      {(t.footerText || t.showPoweredBy) && <div className={cn(a4 ? "mt-6 border-t border-slate-200 pt-3" : cn("my-1.5", rule))} />}
      {t.footerText && <p className={cn("whitespace-pre-line font-semibold", a4 ? "text-center" : "text-center")}>{t.footerText}</p>}
      {t.showPoweredBy && <p className="mt-1 text-center opacity-60" style={{ fontSize: "0.85em" }}>Powered by Restaurant Manager</p>}
    </div>
  );
}

/** The `@page` rule that sizes the browser's print output to the paper. */
export function pageCss(paperSize: string) {
  if (paperSize === "a4") return "@page { size: A4; margin: 12mm; }";
  return `@page { size: ${paperSize === "58mm" ? "58mm" : "80mm"} auto; margin: 0; }`;
}

export function upiLink(upiId: string, payee: string, amount: number, currency: string, note: string) {
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${amount.toFixed(2)}&cu=${currency}&tn=${encodeURIComponent(note)}`;
}
