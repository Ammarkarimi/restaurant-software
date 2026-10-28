import { taxRowsFor, type BillTotals } from "@/lib/billing";
import { cn, formatCurrency } from "@/lib/utils";

/** The totals block under a cart or order: items, discount, service charge, packing / delivery, tax, round-off, total. */
export function BillSummary({
  totals,
  taxMode,
  taxName,
  pricesIncludeTax,
  serviceChargePercent,
  onDiscountClick,
  onChargesClick,
  onServiceChargeClick,
  usualServiceCharge = 0,
  pointsAction,
  discountLabel,
  className,
}: {
  totals: BillTotals;
  taxMode: string;
  taxName: string;
  pricesIncludeTax: boolean;
  serviceChargePercent: number;
  onDiscountClick?: () => void;
  /** Edits packing / delivery charges; shown as a link for takeaway and delivery. */
  onChargesClick?: () => void;
  /** Change or remove the service charge on this bill (it is optional for guests). */
  onServiceChargeClick?: () => void;
  /** The restaurant's usual service charge %, to offer adding it back. */
  usualServiceCharge?: number;
  /** "Use loyalty points (120)" when the customer has points to use. */
  pointsAction?: { label: string; onClick: () => void };
  discountLabel?: string;
  className?: string;
}) {
  const taxRows = taxRowsFor(totals, taxMode, taxName);
  const row = "flex items-center justify-between gap-3 py-0.5";
  const manualDiscount = Math.round((totals.discount - totals.pointsDiscount) * 100) / 100;
  return (
    <div className={cn("text-[15px]", className)}>
      <div className={row}>
        <span className="text-slate-600">Items total ({totals.itemCount})</span>
        <span>{formatCurrency(totals.itemsTotal)}</span>
      </div>
      {onDiscountClick ? (
        <button type="button" onClick={onDiscountClick} className={cn(row, "w-full text-left")}>
          <span className="font-semibold text-primary-700 underline-offset-2 hover:underline">
            {manualDiscount > 0 ? `Discount${discountLabel ? ` (${discountLabel})` : ""}` : "+ Add discount"}
          </span>
          {manualDiscount > 0 && <span className="text-emerald-700">− {formatCurrency(manualDiscount)}</span>}
        </button>
      ) : (
        manualDiscount > 0 && (
          <div className={row}>
            <span className="text-slate-600">Discount{discountLabel ? ` (${discountLabel})` : ""}</span>
            <span className="text-emerald-700">− {formatCurrency(manualDiscount)}</span>
          </div>
        )
      )}
      {totals.pointsDiscount > 0 ? (
        pointsAction ? (
          <button type="button" onClick={pointsAction.onClick} className={cn(row, "w-full text-left")}>
            <span className="text-slate-600 underline-offset-2 hover:underline">Loyalty points used</span>
            <span className="text-emerald-700">− {formatCurrency(totals.pointsDiscount)}</span>
          </button>
        ) : (
          <div className={row}>
            <span className="text-slate-600">Loyalty points used</span>
            <span className="text-emerald-700">− {formatCurrency(totals.pointsDiscount)}</span>
          </div>
        )
      ) : (
        pointsAction && (
          <button type="button" onClick={pointsAction.onClick} className={cn(row, "w-full text-left")}>
            <span className="font-semibold text-emerald-700 underline-offset-2 hover:underline">+ {pointsAction.label}</span>
          </button>
        )
      )}
      {totals.serviceCharge > 0 &&
        (onServiceChargeClick ? (
          <button type="button" onClick={onServiceChargeClick} className={cn(row, "w-full text-left")}>
            <span className="text-slate-600 underline-offset-2 hover:underline">Service charge ({serviceChargePercent}%)</span>
            <span>{formatCurrency(totals.serviceCharge)}</span>
          </button>
        ) : (
          <div className={row}>
            <span className="text-slate-600">Service charge ({serviceChargePercent}%)</span>
            <span>{formatCurrency(totals.serviceCharge)}</span>
          </div>
        ))}
      {totals.serviceCharge === 0 && onServiceChargeClick && usualServiceCharge > 0 && (
        <button type="button" onClick={onServiceChargeClick} className={cn(row, "w-full text-left")}>
          <span className="font-semibold text-primary-700 underline-offset-2 hover:underline">+ Service charge ({usualServiceCharge}%)</span>
        </button>
      )}
      {totals.charges.map((c) =>
        onChargesClick ? (
          <button key={c.name} type="button" onClick={onChargesClick} className={cn(row, "w-full text-left")}>
            <span className="text-slate-600 underline-offset-2 hover:underline">{c.name}</span>
            <span>{formatCurrency(c.amount)}</span>
          </button>
        ) : (
          <div key={c.name} className={row}>
            <span className="text-slate-600">{c.name}</span>
            <span>{formatCurrency(c.amount)}</span>
          </div>
        )
      )}
      {onChargesClick && totals.charges.length === 0 && (
        <button type="button" onClick={onChargesClick} className={cn(row, "w-full text-left")}>
          <span className="font-semibold text-primary-700 underline-offset-2 hover:underline">+ Packing / delivery charge</span>
        </button>
      )}
      {pricesIncludeTax
        ? totals.tax > 0 && (
            <div className={cn(row, "text-sm text-slate-500")}>
              <span>Includes {taxMode === "gst" ? "GST" : taxName}</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>
          )
        : taxRows.map((t) => (
            <div key={t.label} className={row}>
              <span className="text-slate-600">{t.label}</span>
              <span>{formatCurrency(t.amount)}</span>
            </div>
          ))}
      {totals.roundOff !== 0 && (
        <div className={cn(row, "text-sm text-slate-500")}>
          <span>Round off</span>
          <span>{totals.roundOff > 0 ? "+" : "−"} {formatCurrency(Math.abs(totals.roundOff))}</span>
        </div>
      )}
      <div className={cn(row, "mt-1 border-t border-slate-200 pt-2 text-lg font-bold text-slate-900")}>
        <span>Total</span>
        <span>{formatCurrency(totals.total)}</span>
      </div>
    </div>
  );
}
