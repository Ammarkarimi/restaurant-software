"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { taxRowsFor, type BillTotals } from "@/lib/billing";
import { cn, formatCurrency } from "@/lib/utils";

const DETAILS_KEY = "pos:bill-details";

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
  collapsible = false,
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
  /** On the order screen: items total, charges and tax fold into one line on short screens, so more dishes fit. */
  collapsible?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!collapsible) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(DETAILS_KEY);
    } catch {
      // private mode: fall back to the screen height
    }
    setOpen(saved ? saved === "open" : window.innerHeight >= 900);
  }, [collapsible]);
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(DETAILS_KEY, open ? "closed" : "open");
    } catch {
      // the choice lasts until the page closes
    }
  };
  const folded = collapsible && !open;
  const taxRows = taxRowsFor(totals, taxMode, taxName);
  const row = "flex items-center justify-between gap-3 py-0.5";
  const manualDiscount = Math.round((totals.discount - totals.pointsDiscount) * 100) / 100;
  return (
    <div className={cn("text-[15px]", className)}>
      {folded ? (
        <button type="button" onClick={toggle} className={cn(row, "w-full text-left text-sm text-slate-500 hover:text-slate-800")}>
          <span>
            Items ({totals.itemCount}) {formatCurrency(totals.itemsTotal)}
            {totals.total - totals.itemsTotal + totals.discount > 0.009 && ` + tax & charges ${formatCurrency(totals.total - totals.itemsTotal + totals.discount)}`}
          </span>
          <span className="flex shrink-0 items-center gap-0.5 font-semibold text-primary-700">
            Details <ChevronDown className="h-4 w-4" />
          </span>
        </button>
      ) : (
        <div className={row}>
          <span className="text-slate-600">Items total ({totals.itemCount})</span>
          <span className="flex items-center gap-2">
            {collapsible && (
              <button type="button" onClick={toggle} className="flex items-center gap-0.5 text-sm font-semibold text-primary-700" aria-label="Hide bill details">
                Hide <ChevronUp className="h-4 w-4" />
              </button>
            )}
            {formatCurrency(totals.itemsTotal)}
          </span>
        </div>
      )}
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
      {!folded && totals.serviceCharge > 0 &&
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
      {!folded && totals.serviceCharge === 0 && onServiceChargeClick && usualServiceCharge > 0 && (
        <button type="button" onClick={onServiceChargeClick} className={cn(row, "w-full text-left")}>
          <span className="font-semibold text-primary-700 underline-offset-2 hover:underline">+ Service charge ({usualServiceCharge}%)</span>
        </button>
      )}
      {!folded && totals.charges.map((c) =>
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
      {!folded && onChargesClick && totals.charges.length === 0 && (
        <button type="button" onClick={onChargesClick} className={cn(row, "w-full text-left")}>
          <span className="font-semibold text-primary-700 underline-offset-2 hover:underline">+ Packing / delivery charge</span>
        </button>
      )}
      {folded ? null : pricesIncludeTax
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
      {!folded && totals.roundOff !== 0 && (
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
