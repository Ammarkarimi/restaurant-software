"use client";

import { useEffect, useState } from "react";
import { Badge, Card, CardContent, CardHeader, Loading, Tabs, Tip } from "@/components/ui";
import { api } from "@/lib/client";
import { MENU_CLASS, type DishRow, type MenuClass } from "@/lib/profit";
import { cn, formatCurrency } from "@/lib/utils";

interface Pnl {
  revenue: number;
  netSales: number;
  banquetSales: number;
  food: number;
  stockPurchases: number;
  foodExpenses: number;
  foodPercent: number;
  recipeCost: number | null;
  recipePercent: number | null;
  gross: number;
  staff: number;
  staffPercent: number;
  other: Array<{ category: string; amount: number }>;
  otherTotal: number;
  net: number;
  netPercent: number;
}

interface ProfitResponse {
  pnl: Pnl;
  menu: { rows: DishRow[]; popularAt: number; averageMargin: number };
  bills: number;
  banquets: number;
}

const CLASS_VARIANT: Record<MenuClass, string> = { star: "success", plowhorse: "info", puzzle: "purple", dog: "danger", no_recipe: "default" };

function Line({ l, v, pct, strong, minus }: { l: string; v: number; pct?: number; strong?: boolean; minus?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", strong ? "border-t border-slate-200 pt-2 text-base font-bold text-slate-900" : "text-[15px] text-slate-700")}>
      <span>{l}</span>
      <span className="text-right">
        {minus ? "− " : ""}
        {formatCurrency(v)}
        {pct !== undefined && <span className="ml-2 inline-block w-14 text-sm font-normal text-slate-500">{pct}%</span>}
      </span>
    </div>
  );
}

export function ProfitCards({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<ProfitResponse | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<MenuClass | "all">("all");
  useEffect(() => {
    setData(null);
    setError("");
    api<ProfitResponse>(`/api/reports/profit?from=${from}&to=${to}`).then(setData, (e) => setError((e as Error).message));
  }, [from, to]);

  if (error) return <Tip tone="danger">{error}</Tip>;
  if (!data) return <Loading />;
  const p = data.pnl;
  const rows = filter === "all" ? data.menu.rows : data.menu.rows.filter((r) => r.klass === filter);
  const count = (k: MenuClass) => data.menu.rows.filter((r) => r.klass === k).length || undefined;
  const leak = p.recipeCost !== null && p.food > 0 ? p.food - p.recipeCost : null;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader title="Profit & loss" description="Money in, money out, for these dates. Before tax: GST you collect is not your money." />
        <CardContent>
          <Line l="Restaurant sales" v={p.netSales} />
          {p.banquetSales > 0 && <Line l={`Banquets (${data.banquets} invoiced)`} v={p.banquetSales} />}
          <Line l="Income" v={p.revenue} strong />
          <Line l="Food & ingredients bought" v={p.food} pct={p.foodPercent} minus />
          <Line l="Gross profit" v={p.gross} strong />
          <Line l="Staff salary & advances" v={p.staff} pct={p.staffPercent} minus />
          {p.other.map((o) => (
            <Line key={o.category} l={o.category} v={o.amount} pct={p.revenue ? Math.round((o.amount / p.revenue) * 1000) / 10 : 0} minus />
          ))}
          <div className={cn("mt-2 flex items-baseline justify-between rounded-xl px-3 py-2 text-lg font-bold", p.net >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>
            <span>{p.net >= 0 ? "Profit" : "Loss"}</span>
            <span>
              {formatCurrency(Math.abs(p.net))} <span className="text-sm font-semibold">{p.netPercent}%</span>
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Food bought counts stock received and food expenses (vegetables, groceries, meat, dairy). Supplier payments are not counted again. Rent, gas and other bills count when they are added as expenses.
          </p>
          {p.recipeCost !== null && (
            <div className={cn("mt-3 rounded-xl border px-3 py-2 text-sm", leak !== null && leak > p.revenue * 0.05 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 text-slate-700")}>
              By their recipes, the dishes you sold should have used <b>{formatCurrency(p.recipeCost)}</b> of ingredients ({p.recipePercent}% of income).
              {leak !== null && leak > p.revenue * 0.05 && (
                <> You bought {formatCurrency(leak)} more than that: stock building up, wastage, missing recipes, or stock going missing. Check the Stock usage report.</>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader title="Menu engineering" description={`Which dishes earn their place. Popular = at least ${Math.ceil(data.menu.popularAt)} plates; earns well = at least ${formatCurrency(data.menu.averageMargin)} a plate.`} />
        <CardContent className="space-y-3">
          <Tabs<MenuClass | "all">
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: "all", label: "All" },
              { value: "star", label: "Stars", count: count("star") },
              { value: "plowhorse", label: "Workhorses", count: count("plowhorse") },
              { value: "puzzle", label: "Hidden gems", count: count("puzzle") },
              { value: "dog", label: "Rethink", count: count("dog") },
              ...(count("no_recipe") ? [{ value: "no_recipe" as const, label: "No recipe", count: count("no_recipe") }] : []),
            ]}
          />
          {filter !== "all" && <p className="text-sm text-slate-600">{MENU_CLASS[filter].advice}</p>}
          {rows.length === 0 ? (
            <p className="py-6 text-center text-slate-500">No dishes here for these dates.</p>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="py-2 pr-2">Dish</th>
                    <th className="py-2 pr-2 text-right">Sold</th>
                    <th className="py-2 pr-2 text-right">Earns / plate</th>
                    <th className="py-2 pr-2 text-right">Food cost</th>
                    <th className="py-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b border-slate-50">
                      <td className="py-2 pr-2">
                        <span className="font-semibold text-slate-900">{r.name}</span>{" "}
                        <Badge variant={CLASS_VARIANT[r.klass]}>{MENU_CLASS[r.klass].label}</Badge>
                        <span className="block text-xs text-slate-500">{r.category}</span>
                      </td>
                      <td className="py-2 pr-2 text-right">{r.quantity}</td>
                      <td className="py-2 pr-2 text-right">{r.unitMargin === null ? "—" : formatCurrency(r.unitMargin)}</td>
                      <td className={cn("py-2 pr-2 text-right", r.foodCostPercent !== null && r.foodCostPercent > 40 && "font-semibold text-red-700")}>{r.foodCostPercent === null ? "—" : `${Math.round(r.foodCostPercent)}%`}</td>
                      <td className="py-2 text-right font-semibold">{r.margin === null ? "—" : formatCurrency(r.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
