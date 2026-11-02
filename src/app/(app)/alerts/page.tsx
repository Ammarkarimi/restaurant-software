"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCheck, MessageCircle, Send, Settings2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Loading, PageHeader, Tabs, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { ALERT_KINDS } from "@/lib/alert-rules";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

interface AlertRow {
  id: string;
  kind: string;
  title: string;
  message: string;
  orderId: string | null;
  staffName: string | null;
  amount: number;
  sentVia: string | null;
  readAt: string | null;
  createdAt: string;
}
interface AlertsResponse {
  alerts: AlertRow[];
  unread: number;
  week: Array<{ kind: string; count: number; amount: number }>;
  channels: { whatsapp: boolean; email: boolean };
}

const TONE: Record<string, string> = {
  bill_changed: "bg-red-100 text-red-700",
  kot_cancel: "bg-red-100 text-red-700",
  order_cancel: "bg-red-100 text-red-700",
  cash_short: "bg-red-100 text-red-700",
  discount: "bg-amber-100 text-amber-800",
  complimentary: "bg-amber-100 text-amber-800",
  payment_mode: "bg-amber-100 text-amber-800",
};

function DailyReportCard() {
  const { toast } = useApp();
  const [report, setReport] = useState<{ date: string; text: string; shareLink: string } | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    api<{ date: string; text: string; shareLink: string }>("/api/reports/daily").then(setReport, () => undefined);
  }, []);
  async function send() {
    setSending(true);
    try {
      const r = await api<{ sentVia: string }>("/api/reports/daily", { body: { date: report?.date } });
      toast(`Report sent by ${r.sentVia.replace(",", " and ")}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }
  return (
    <Card>
      <CardHeader title="Today's report so far" description="This is what you get on WhatsApp when the day is closed." />
      <CardContent className="space-y-3">
        {!report ? (
          <Loading />
        ) : (
          <>
            <pre className="whitespace-pre-wrap rounded-xl bg-emerald-50 p-4 font-sans text-sm leading-relaxed text-slate-800 ring-1 ring-emerald-100">{report.text}</pre>
            <div className="flex flex-wrap gap-2">
              <a href={report.shareLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                <MessageCircle className="h-4 w-4" /> Send on WhatsApp
              </a>
              <Button variant="outline" loading={sending} onClick={send}>
                <Send className="h-4 w-4" /> Send automatically now
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              “Send on WhatsApp” opens WhatsApp on this device with the report typed in. Change who gets it under{" "}
              <Link href="/settings?tab=alerts" className="font-semibold text-primary-700 hover:underline">Settings → Owner alerts</Link>.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const { isAdmin, settings } = useApp();
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [kind, setKind] = useState("all");

  const load = useCallback(() => {
    api<AlertsResponse>(`/api/alerts${kind !== "all" ? `?kind=${kind}` : ""}`).then(setData, () => undefined);
  }, [kind]);
  useEffect(() => load(), [load]);

  async function markRead() {
    await api("/api/alerts", { body: {} });
    load();
    window.dispatchEvent(new Event("alerts:read"));
  }

  if (!isAdmin) return <Tip tone="warning">Only the owner / manager can see alerts.</Tip>;
  if (!data) return <Loading />;
  const tz = settings?.timezone;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alerts"
        description="Bills changed after printing, dishes removed after KOT, big discounts, payment mode changes and cash short — the moment they happen."
        actions={
          <>
            <Link href="/settings?tab=alerts">
              <Button variant="outline"><Settings2 className="h-4 w-4" /> Alert settings</Button>
            </Link>
            {data.unread > 0 && (
              <Button onClick={markRead}><CheckCheck className="h-4 w-4" /> Mark all as seen</Button>
            )}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {data.week.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.week.map((w) => (
                <div key={w.kind} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ALERT_KINDS[w.kind]?.label ?? w.kind}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{w.count}</p>
                  <p className="text-xs text-slate-500">{w.amount ? `${formatCurrency(w.amount)} · ` : ""}last 7 days</p>
                </div>
              ))}
            </div>
          )}
          <Tabs<string>
            value={kind}
            onChange={setKind}
            tabs={[{ value: "all", label: "All", count: data.unread || undefined }, ...Object.entries(ALERT_KINDS).map(([value, k]) => ({ value, label: k.label }))]}
          />
          <Card>
            {data.alerts.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<BellRing className="h-6 w-6" />} title="No alerts" description="Nothing worrying has happened. Alerts appear here (and on your WhatsApp) the moment something does." />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.alerts.map((a) => (
                  <li key={a.id} className={cn("flex gap-3 px-4 py-3", !a.readAt && "bg-primary-50/40")}>
                    <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", a.readAt ? "bg-transparent" : "bg-primary-600")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", TONE[a.kind] ?? "bg-slate-100 text-slate-700")}>{a.title}</span>
                        {a.amount > 0 && <b className="text-sm text-slate-900">{formatCurrency(a.amount)}</b>}
                        <span className="text-xs text-slate-400">{formatDateTime(a.createdAt, tz)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{a.message}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {a.staffName && <span>By <b>{a.staffName}</b></span>}
                        {a.sentVia && <Badge>Sent by {a.sentVia.replace(",", " & ")}</Badge>}
                        {a.orderId && (
                          <Link href={`/orders/${a.orderId}`} className="font-semibold text-primary-700 hover:underline">Open the bill</Link>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <DailyReportCard />
          {!data.channels.whatsapp && (
            <Tip>Automatic WhatsApp alerts start once your software provider connects the WhatsApp Business number. Alerts always show here.</Tip>
          )}
        </div>
      </div>
    </div>
  );
}
