"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Download, Megaphone, Plus, Send, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, Select, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { SEGMENTS, personalise, type Recipient } from "@/lib/campaigns";
import { formatDateTime } from "@/lib/utils";

interface CampaignRow {
  id: string;
  name: string;
  segment: string;
  message: string;
  total: number;
  sent: number;
  createdByName: string;
  createdAt: string;
}

const TEMPLATES = [
  { name: "Birthday wish", segment: "birthday", message: "Happy birthday {name}! 🎂 Celebrate with us this week and get a free dessert. Show this message at the counter." },
  { name: "We miss you", segment: "inactive", message: "Hello {name}, we miss you! Come back this week for 10% off your bill. Show this message at the counter." },
  { name: "Weekend special", segment: "all", message: "Hello {name}! This weekend: our chef's special thali at a special price. Book a table or order now!" },
  { name: "Points reminder", segment: "regulars", message: "Hello {name}, you have {points} loyalty points with us — that's money off your next bill. See you soon!" },
];

function NewCampaignDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { toast, settings } = useApp();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("all");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPreview(null);
    api<{ count: number; sample: string[] }>(`/api/campaigns?segment=${segment}`).then(setPreview, () => setPreview({ count: 0, sample: [] }));
  }, [segment]);

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ campaign: { id: string } }>("/api/campaigns", { body: { name, segment, message } });
      toast("Ready to send");
      onCreated(r.campaign.id);
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New WhatsApp offer"
      description="Write one message; it is sent to each customer with their name, one tap at a time from your WhatsApp."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!name.trim() || message.trim().length < 5 || !preview?.count} onClick={save}>
            Continue to send ({preview?.count ?? 0})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-sm text-slate-500">Start from:</span>
          {TEMPLATES.map((t) => (
            <Button
              key={t.name}
              size="sm"
              variant="outline"
              onClick={() => {
                setName(t.name);
                setSegment(t.segment);
                setMessage(t.message);
              }}
            >
              {t.name}
            </Button>
          ))}
        </div>
        <Field label="Name" hint="Only you see it">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Send to" hint={preview ? `${preview.count} customer${preview.count === 1 ? "" : "s"}${preview.sample.length ? `: ${preview.sample.join(", ")}${preview.count > preview.sample.length ? "…" : ""}` : ""}` : "Counting…"}>
          <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
            {SEGMENTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Message" hint="{name} becomes the customer's first name, {points} their loyalty points, {due} what they owe">
          <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
        </Field>
        {message.trim() && (
          <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
            <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">Preview</p>
            <p className="whitespace-pre-line">{personalise(message, { name: "Priya Sharma", points: 120, balance: 0 }, settings.currency)}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function SendView({ id, onClose }: { id: string; onClose: () => void }) {
  const { toast, settings } = useApp();
  const [c, setC] = useState<(CampaignRow & { recipients: Recipient[] }) | null>(null);
  const load = useCallback(() => {
    api<{ campaign: CampaignRow & { recipients: Recipient[] } }>(`/api/campaigns/${id}`).then((r) => setC(r.campaign), (e) => toast(e.message, "error"));
  }, [id, toast]);
  useEffect(() => load(), [load]);

  async function mark(r: Recipient, sent: boolean) {
    setC((x) => x && { ...x, recipients: x.recipients.map((y) => (y.customerId === r.customerId ? { ...y, sentAt: sent ? new Date().toISOString() : null } : y)) });
    await api(`/api/campaigns/${id}`, { method: "PATCH", body: { customerId: r.customerId, sent } }).catch((e) => toast(e.message, "error"));
  }

  const done = c?.recipients.filter((r) => r.sentAt).length ?? 0;
  const csv = c ? "data:text/csv;charset=utf-8," + encodeURIComponent(["Name,Phone,Message", ...c.recipients.map((r) => `"${(r.name ?? "").replace(/"/g, "'")}",${r.phone},"${personalise(c.message, r, settings.currency).replace(/"/g, "'")}"`)].join("\n")) : "";

  return (
    <Modal open onClose={onClose} title={c ? c.name : "Send"} description={c ? `${done} of ${c.recipients.length} sent. Tap Send: WhatsApp opens with the message ready — press send there, then come back.` : undefined} size="lg">
      {!c ? (
        <Loading />
      ) : (
        <div className="space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${c.recipients.length ? (done / c.recipients.length) * 100 : 0}%` }} />
          </div>
          <div className="flex justify-end">
            <a href={csv} download={`${c.name}.csv`}>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" /> Numbers and messages (CSV)
              </Button>
            </a>
          </div>
          <ul className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {c.recipients.map((r) => (
              <li key={r.customerId} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{r.name || "No name"}</span>
                  <span className="block text-sm text-slate-500">{r.phone}</span>
                </span>
                {r.sentAt ? (
                  <button onClick={() => mark(r, false)} className="flex items-center gap-1 text-sm font-semibold text-emerald-700" title="Tap to mark as not sent">
                    <Check className="h-4 w-4" /> Sent
                  </button>
                ) : (
                  <a href={whatsappLink(r.phone, personalise(c.message, r, settings.currency))} target="_blank" rel="noopener noreferrer" onClick={() => mark(r, true)}>
                    <Button size="sm" variant="success">
                      <Send className="h-4 w-4" /> Send
                    </Button>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export function CampaignsTab() {
  const { toast, confirm, settings } = useApp();
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ campaigns: CampaignRow[] }>("/api/campaigns").then((r) => setCampaigns(r.campaigns), (e) => toast(e.message, "error"));
  }, [toast]);
  useEffect(() => load(), [load]);

  async function remove(c: CampaignRow) {
    const ok = await confirm({ title: `Delete ${c.name}?`, confirmText: "Delete", danger: true });
    if (!ok) return;
    await api(`/api/campaigns/${c.id}`, { method: "DELETE" }).catch((e) => toast(e.message, "error"));
    load();
  }

  if (!campaigns) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tip>
          Send offers on WhatsApp to a group of customers: birthdays this week, people who have not come for a month, your regulars. Each message carries the customer&apos;s
          name. WhatsApp opens with the message ready; you press send.
        </Tip>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" /> New WhatsApp offer
        </Button>
      </div>
      {campaigns.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No offers sent yet" description="Start with birthday wishes or a “we miss you” offer for guests who have not come back." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    {c.name}
                    <Badge variant={c.sent === c.total ? "success" : "warning"}>
                      {c.sent} / {c.total} sent
                    </Badge>
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {SEGMENTS.find((s) => s.id === c.segment)?.label} · {formatDateTime(c.createdAt, settings.timezone)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => setSending(c.id)}>
                    <Send className="h-4 w-4" /> {c.sent < c.total ? "Continue sending" : "Open"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {creating && (
        <NewCampaignDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSending(id);
            load();
          }}
        />
      )}
      {sending && (
        <SendView
          id={sending}
          onClose={() => {
            setSending(null);
            load();
          }}
        />
      )}
    </div>
  );
}
