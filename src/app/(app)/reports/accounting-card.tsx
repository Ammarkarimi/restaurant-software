"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, Select, Tip } from "@/components/ui";
import { api } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";

interface Summary {
  summary: { b2bBills: number; b2cBills: number; ecoBills: number; taxable: number; tax: number; pos: string | null };
  gstin: string | null;
  taxMode: string;
}

/** GSTR-1 tables and Tally import files for the period chosen at the top of Reports. */
export function AccountingCard({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [per, setPer] = useState<"day" | "bill">("day");
  const [company, setCompany] = useState("");
  useEffect(() => {
    api<Summary>(`/api/reports/export?type=gstr1-summary&from=${from}&to=${to}`).then(setData, () => setData(null));
  }, [from, to]);
  const url = (type: string, extra = "") => `/api/reports/export?type=${type}&from=${from}&to=${to}${extra}`;
  const file = (type: string, text: string) => (
    <a href={url(type)} className="inline-flex">
      <Button size="sm" variant="outline"><Download className="h-4 w-4" /> {text}</Button>
    </a>
  );
  return (
    <Card>
      <CardHeader title="GST return & Tally" description="Files for your accountant for the period chosen above — usually last month." />
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="flex items-center gap-2 font-semibold text-slate-800"><FileSpreadsheet className="h-4 w-4 text-primary-600" /> GSTR-1</p>
          {data?.taxMode !== "gst" ? (
            <Tip>Tax is not set to GST (Settings → Tax &amp; charges), so there is no GSTR-1 to file.</Tip>
          ) : (
            <>
              {!data.summary.pos && (
                <Tip tone="warning">
                  Add your GSTIN in <Link href="/settings?tab=restaurant" className="font-semibold underline">Settings → Restaurant</Link> — the place of supply is read from it.
                </Tip>
              )}
              <p className="text-sm text-slate-600">
                {data.summary.b2cBills} B2C bills{data.summary.b2bBills ? `, ${data.summary.b2bBills} B2B bills (with the guest's GSTIN)` : ""} · taxable{" "}
                <b>{formatCurrency(data.summary.taxable)}</b> · GST <b>{formatCurrency(data.summary.tax)}</b>
                {data.summary.pos ? ` · place of supply ${data.summary.pos}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {file("gstr1-b2cs", "B2CS (7)")}
                {data.summary.b2bBills > 0 && file("gstr1-b2b", "B2B (4A)")}
                {file("gstr1-hsn", "HSN / SAC (12)")}
                {file("gstr1-docs", "Documents (13)")}
                {data.summary.ecoBills > 0 && file("gstr1-eco", "Zomato / Swiggy (14)")}
              </div>
              <p className="text-xs text-slate-500">
                The CSV files match the GST offline tool&apos;s tables. Zomato / Swiggy orders are kept out of B2CS, because the app pays GST on them (section 9(5)).
              </p>
            </>
          )}
        </div>
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <p className="font-semibold text-slate-800">Tally (TallyPrime / Tally.ERP 9)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sales entries">
              <Select value={per} onChange={(e) => setPer(e.target.value as "day" | "bill")}>
                <option value="day">One entry per day (recommended)</option>
                <option value="bill">One entry per bill</option>
              </Select>
            </Field>
            <Field label="Company name in Tally" hint="Leave empty to import into the open company">
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="As in Tally" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={url("tally", `&per=${per}${company ? `&company=${encodeURIComponent(company)}` : ""}`)}>
              <Button size="sm"><Download className="h-4 w-4" /> Sales vouchers (XML)</Button>
            </a>
            <a href={url("tally-ledgers", company ? `&company=${encodeURIComponent(company)}` : "")}>
              <Button size="sm" variant="outline"><Download className="h-4 w-4" /> Ledgers (import once)</Button>
            </a>
          </div>
          <p className="text-xs text-slate-500">
            In Tally: Gateway → Import → Masters (the ledgers file, first time only), then Import → Transactions (the vouchers file). Sales are posted net of discount, with CGST / SGST, cash, UPI, card and Zomato / Swiggy dues in their own ledgers.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
