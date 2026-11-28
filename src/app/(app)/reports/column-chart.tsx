"use client";
// The sales column chart on Reports. In its own file so the chart library loads only when a chart is shown.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";

const SERIES = "#19734b";
const GRID = "#e2e8f0";
const AXIS = "#64748b";

function compact(n: number) {
  if (n >= 100000) return `${Math.round(n / 1000) / 100}L`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(Math.round(n));
}

export default function ColumnChart({ data, xKey, xFormat, height = 240 }: { data: Array<Record<string, number | string>>; xKey: string; xFormat: (v: string | number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
        <XAxis dataKey={xKey} tickFormatter={xFormat} tick={{ fill: AXIS, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={12} />
        <YAxis tickFormatter={compact} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as { sales: number; bills: number } & Record<string, string | number>;
            return (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
                <p className="font-semibold text-slate-900">{xFormat(row[xKey])}</p>
                <p className="flex items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES }} /> {formatCurrency(row.sales)}
                </p>
                <p className="text-slate-500">{row.bills} bill(s)</p>
              </div>
            );
          }}
        />
        <Bar dataKey="sales" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
