"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Star } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, StatCard, Tabs } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { cn, formatCurrency, formatDateTime, label } from "@/lib/utils";
import type { SettingsDTO } from "@/lib/types";

interface FeedbackRow {
  id: string;
  orderId: string;
  name: string | null;
  phone: string | null;
  rating: number;
  food: number | null;
  service: number | null;
  ambience: number | null;
  comment: string | null;
  followedUp: boolean;
  createdAt: string;
  order: { id: string; billNumber: string | null; total: number; type: string; table: { name: string } | null } | null;
}

interface Stats {
  count: number;
  rating: number | null;
  food: number | null;
  service: number | null;
  ambience: number | null;
  last30: Record<string, number>;
  toCallBack: number;
}

function StarRow({ n, size = "h-4 w-4" }: { n: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${n} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= n ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
      ))}
    </span>
  );
}

export function FeedbackTab() {
  const { toast, settings } = useApp();
  const [filter, setFilter] = useState<"all" | "low">("all");
  const [data, setData] = useState<{ feedback: FeedbackRow[]; stats: Stats } | null>(null);
  const [reviewUrl, setReviewUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");

  const load = useCallback(() => {
    api<{ feedback: FeedbackRow[]; stats: Stats }>(`/api/feedback?filter=${filter}`).then(setData, (e) => toast(e.message, "error"));
  }, [filter, toast]);
  useEffect(() => load(), [load]);
  useEffect(() => {
    api<{ settings: SettingsDTO }>("/api/settings").then((r) => {
      setReviewUrl(r.settings.googleReviewUrl ?? "");
      setSavedUrl(r.settings.googleReviewUrl ?? "");
    }, () => null);
  }, []);

  async function followUp(f: FeedbackRow) {
    try {
      await api(`/api/feedback/${f.id}`, { method: "PATCH", body: { followedUp: !f.followedUp } });
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function saveUrl() {
    try {
      await api("/api/settings", { method: "PATCH", body: { googleReviewUrl: reviewUrl.trim() || null } });
      setSavedUrl(reviewUrl.trim());
      toast(reviewUrl.trim() ? "Google review link saved" : "Google review link removed");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  if (!data) return <Loading />;
  const s = data.stats;
  const avg = (n: number | null) => (n ? n.toFixed(1) : "—");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard title="Average rating" value={avg(s.rating)} subtitle={`${s.count} rating${s.count === 1 ? "" : "s"}`} icon={<Star className="h-5 w-5" />} tone="amber" />
        <StatCard title="Food" value={avg(s.food)} tone="green" />
        <StatCard title="Service" value={avg(s.service)} tone="sky" />
        <StatCard title="Ambience" value={avg(s.ambience)} tone="primary" />
        <StatCard title="To call back" value={s.toCallBack} subtitle="1–2 stars, not followed up" tone="red" />
      </div>
      <Card>
        <CardHeader title="How it works" description="Every bill you send on WhatsApp has a short rating form. Guests who give 4 or 5 stars are asked to review you on Google; low ratings land here so you can call them back." />
        <CardContent className="flex flex-wrap items-end gap-2">
          <Field label="Your Google review link" optional hint="Google Maps → your restaurant → Share → Copy link, or the “Ask for reviews” link from your Google Business profile" className="min-w-72 flex-1">
            <Input value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} placeholder="https://g.page/r/…/review" />
          </Field>
          <Button variant="outline" disabled={reviewUrl.trim() === savedUrl} onClick={saveUrl}>
            Save link
          </Button>
        </CardContent>
      </Card>
      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: "all", label: "All ratings" },
          { value: "low", label: "1–2 stars", count: s.toCallBack || undefined },
        ]}
      />
      {data.feedback.length === 0 ? (
        <EmptyState icon={<Star className="h-6 w-6" />} title={filter === "low" ? "No low ratings" : "No ratings yet"} description="Send bills on WhatsApp after payment. Guests rate from the bill link." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {data.feedback.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <StarRow n={f.rating} size="h-5 w-5" />
                    <b className="text-slate-900">{f.name || f.phone || "Guest"}</b>
                    {f.rating <= 2 && (f.followedUp ? <Badge variant="success">Called back</Badge> : <Badge variant="danger">Call back</Badge>)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(f.createdAt, settings.timezone)}
                    {f.order && (
                      <>
                        {" · "}
                        <Link href={`/orders/${f.order.id}`} className="underline">
                          Bill {f.order.billNumber}
                        </Link>{" "}
                        · {formatCurrency(f.order.total)} · {f.order.table ? `Table ${f.order.table.name}` : label(f.order.type)}
                      </>
                    )}
                  </p>
                  {(f.food || f.service || f.ambience) && (
                    <p className="mt-1 text-xs text-slate-600">
                      {f.food ? `Food ${f.food}/5` : ""} {f.service ? `· Service ${f.service}/5` : ""} {f.ambience ? `· Ambience ${f.ambience}/5` : ""}
                    </p>
                  )}
                  {f.comment && <p className="mt-1 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-[15px] text-slate-800">“{f.comment}”</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {f.phone && (
                    <a href={whatsappLink(f.phone, `Hello${f.name ? ` ${f.name.split(" ")[0]}` : ""}, thank you for your feedback about your visit to ${settings.restaurantName}. `)} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="text-emerald-700">
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </Button>
                    </a>
                  )}
                  {f.rating <= 2 && (
                    <Button size="sm" variant="outline" onClick={() => followUp(f)}>
                      {f.followedUp ? "Not called yet" : "Mark called back"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
