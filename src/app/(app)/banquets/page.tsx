"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, IndianRupee, PartyPopper, Plus, Search, Users } from "lucide-react";
import { Button, Card, EmptyState, Input, Loading, PageHeader, StatCard, Tabs, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { timeText, type BanquetStatus } from "@/lib/banquet";
import { can } from "@/lib/permissions";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { BanquetSetup, type HallDTO, type PackageDTO } from "./setup";
import { STATUS_TONE, StatusChip } from "./status-chip";

interface EventRow {
  id: string;
  number: number;
  status: BanquetStatus;
  customerName: string;
  customerPhone: string;
  eventType: string;
  title: string | null;
  date: string;
  startTime: string;
  endTime: string;
  guests: number;
  total: number;
  paid: number;
  invoiceNumber: string | null;
  hall: { id: string; name: string } | null;
}

interface ListResponse {
  today: string;
  events: EventRow[];
  halls: HallDTO[];
  packages: PackageDTO[];
  stats: { monthEvents: number; monthGuests: number; monthValue: number; balanceDue: number; nextWeek: number; openEnquiries: number };
}

type View = "upcoming" | "enquiries" | "calendar" | "past" | "cancelled" | "setup";

function EventList({ events }: { events: EventRow[] }) {
  if (!events.length) {
    return (
      <div className="p-5">
        <EmptyState icon={<PartyPopper className="h-6 w-6" />} title="No bookings here" description="New enquiries and bookings for birthdays, weddings and office parties appear here." />
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {events.map((e) => {
        const due = Math.max(0, e.total - e.paid);
        return (
          <li key={e.id}>
            <Link href={`/banquets/${e.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
              <div className="w-24 shrink-0 text-center">
                <p className="text-xs font-semibold uppercase text-slate-500">{new Date(`${e.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}</p>
                <p className="font-bold text-slate-900">{formatDate(e.date).replace(/ \d{4}$/, "")}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                  {e.title || `${e.eventType} — ${e.customerName}`} <StatusChip status={e.status} />
                </p>
                <p className="text-sm text-slate-500">
                  #{e.number} · {e.customerName} · {timeText(e.startTime)}–{timeText(e.endTime)}
                  {e.hall ? ` · ${e.hall.name}` : ""} · {e.guests} guests
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-bold text-slate-900">{formatCurrency(e.total)}</p>
                <p className={due > 0 && e.status !== "cancelled" ? "text-amber-700" : "text-emerald-700"}>
                  {e.status === "cancelled" ? (e.paid > 0 ? `${formatCurrency(e.paid)} paid` : "—") : due > 0 ? `${formatCurrency(due)} due` : "Fully paid"}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function monthKey(d: string) {
  return d.slice(0, 7);
}
function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A month grid: each day shows its functions, coloured by status, with the hall. */
function Calendar({ today }: { today: string }) {
  const [month, setMonth] = useState(monthKey(today));
  const [events, setEvents] = useState<EventRow[] | null>(null);
  useEffect(() => {
    setEvents(null);
    api<ListResponse>(`/api/banquets?month=${month}`).then((r) => setEvents(r.events.filter((e) => e.status !== "cancelled")), () => setEvents([]));
  }, [month]);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // weeks start on Monday
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <Button size="sm" variant="outline" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
        <p className="font-bold text-slate-900">{first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
        <Button size="sm" variant="outline" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      {!events ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-7 text-sm">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="border-b border-slate-100 px-2 py-1.5 text-center text-xs font-semibold uppercase text-slate-500">{d}</div>
            ))}
            {cells.map((d, i) => (
              <div key={i} className={cn("min-h-24 border-b border-r border-slate-100 p-1.5", !d && "bg-slate-50", d === today && "bg-primary-50/50")}>
                {d && (
                  <>
                    <p className={cn("mb-1 text-xs font-semibold", d === today ? "text-primary-700" : "text-slate-500")}>{Number(d.slice(8))}</p>
                    <div className="space-y-1">
                      {events
                        .filter((e) => e.date === d)
                        .map((e) => (
                          <Link key={e.id} href={`/banquets/${e.id}`} className={cn("block truncate rounded-md px-1.5 py-0.5 text-xs font-semibold", STATUS_TONE[e.status])} title={`${e.customerName} · ${e.guests} guests`}>
                            {timeText(e.startTime).replace(":00", "")} {e.hall?.name ?? ""} · {e.customerName}
                          </Link>
                        ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function BanquetsPage() {
  const { user, isAdmin } = useApp();
  const [view, setView] = useState<View>("upcoming");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ListResponse | null>(null);
  const allowed = can(user, "banquets");

  const load = useCallback(() => {
    if (view === "calendar" || !allowed) return;
    const v = view === "setup" ? "upcoming" : view;
    api<ListResponse>(`/api/banquets?view=${v}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`).then(setData, () => undefined);
  }, [view, q, allowed]);
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const tabs = useMemo(
    () =>
      [
        { value: "upcoming" as View, label: "Upcoming" },
        { value: "enquiries" as View, label: "Enquiries", count: data?.stats.openEnquiries || undefined },
        { value: "calendar" as View, label: "Calendar" },
        { value: "past" as View, label: "Past & invoiced" },
        { value: "cancelled" as View, label: "Cancelled" },
        ...(isAdmin ? [{ value: "setup" as View, label: "Halls & packages" }] : []),
      ],
    [data?.stats.openEnquiries, isAdmin]
  );

  if (!allowed) return <Tip tone="warning">You are not allowed to handle banquet bookings. Ask the owner / manager to switch it on for you in Settings → Staff.</Tip>;
  if (!data) return <Loading />;
  const s = data.stats;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Banquets & functions"
        description="Birthdays, weddings, office parties: enquiries, hall bookings, per-plate menus, advances and the final GST invoice."
        actions={
          <Link href="/banquets/new">
            <Button><Plus className="h-5 w-5" /> New booking</Button>
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="This month" value={`${s.monthEvents} functions`} subtitle={`${s.monthGuests} guests`} icon={<PartyPopper className="h-5 w-5" />} />
        <StatCard title="Booked value this month" value={formatCurrency(s.monthValue)} icon={<IndianRupee className="h-5 w-5" />} tone="green" />
        <StatCard title="Still to collect" value={formatCurrency(s.balanceDue)} subtitle="Confirmed and invoiced functions" icon={<IndianRupee className="h-5 w-5" />} tone="amber" />
        <StatCard title="Next 7 days" value={`${s.nextWeek} confirmed`} subtitle={`${s.openEnquiries} open enquiries`} icon={<CalendarDays className="h-5 w-5" />} tone="sky" onClick={() => setView("upcoming")} />
      </div>
      {data.halls.length === 0 && isAdmin && view !== "setup" && (
        <Tip>
          Start by adding your halls and per-plate packages under <button className="font-semibold underline" onClick={() => setView("setup")}>Halls &amp; packages</button>. You can still take enquiries without them.
        </Tip>
      )}
      <Tabs<View> value={view} onChange={setView} tabs={tabs} />
      {view === "calendar" ? (
        <Calendar today={data.today} />
      ) : view === "setup" ? (
        <BanquetSetup halls={data.halls} packages={data.packages} onChanged={load} />
      ) : (
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, booking # or invoice" className="border-0 shadow-none focus:ring-0" aria-label="Search bookings" />
            <span className="hidden shrink-0 items-center gap-1 text-xs text-slate-500 sm:flex"><Users className="h-3.5 w-3.5" /> {data.events.length}</span>
          </div>
          <EventList events={data.events} />
        </Card>
      )}
    </div>
  );
}
