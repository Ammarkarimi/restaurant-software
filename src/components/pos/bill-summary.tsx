import { taxRowsFor, type BillTotals } from "@/lib/billing";
import { cn, formatCurrency } from "@/lib/utils";

/** The totals block under a cart or order: items, discount, service charge, tax, round-off, total. */
export function BillSummary({
  totals,
  taxMode,
  taxName,
  pricesIncludeTax,
  serviceChargePercent,
  onDiscountClick,
  discountLabel,
  className,
}: {
  totals: BillTotals;
  taxMode: string;
  taxName: string;
  pricesIncludeTax: boolean;
  serviceChargePercent: number;
  onDiscountClick?: () => void;
  discountLabel?: string;
  className?: string;
}) {
  const taxRows = taxRowsFor(totals, taxMode, taxName);
  const row = "flex items-center justify-between gap-3 py-0.5";
  return (
    <div className={cn("text-[15px]", className)}>
      <div className={row}>
        <span className="text-slate-600">Items total ({totals.itemCount})</span>
        <span>{formatCurrency(totals.itemsTotal)}</span>
      </div>
      {onDiscountClick ? (
        <button type="button" onClick={onDiscountClick} className={cn(row, "w-full text-left")}>
          <span className="font-semibold text-primary-700 underline-offset-2 hover:underline">
            {totals.discount > 0 ? `Discount${discountLabel ? ` (${discountLabel})` : ""}` : "+ Add discount"}
          </span>
          {totals.discount > 0 && <span className="text-emerald-700">− {formatCurrency(totals.discount)}</span>}
        </button>
      ) : (
        totals.discount > 0 && (
          <div className={row}>
            <span className="text-slate-600">Discount{discountLabel ? ` (${discountLabel})` : ""}</span>
            <span className="text-emerald-700">− {formatCurrency(totals.discount)}</span>
          </div>
        )
      )}
      {totals.serviceCharge > 0 && (
        <div className={row}>
          <span className="text-slate-600">Service charge ({serviceChargePercent}%)</span>
          <span>{formatCurrency(totals.serviceCharge)}</span>
        </div>
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
