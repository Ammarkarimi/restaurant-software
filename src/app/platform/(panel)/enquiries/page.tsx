"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Phone, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Loading, PageHeader, Select, Tabs, Textarea, Tip } from "@/components/ui";
import { api, whatsappLink } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  restaurantName: string | null;
  phone: string;
  city: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

type Filter = "all" | "new" | "contacted" | "won" | "lost";
const STATUS: Record<string, { label: string; variant: string }> = {
  new: { label: "New", variant: "warning" },
  contacted: { label: "Contacted", variant: "info" },
  won: { label: "Became a customer", variant: "success" },
  lost: { label: "Not interested", variant: "default" },
};

function LeadCard({ lead, onChange, onDelete }: { lead: Lead; onChange: (l: Lead) => void; onDelete: () => void }) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [error, setError] = useState("");
  async function save(body: Partial<Lead>) {
    setError("");
    try {
      const r = await api<{ lead: Lead }>(`/api/platform/leads/${lead.id}`, { method: "PATCH", body });
      onChange(r.lead);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const hello = `Hello ${lead.name}, thank you for asking about Restaurant Manager${lead.restaurantName ? ` for ${lead.restaurantName}` : ""}. When is a good time to show you a demo?`;
  const newRestaurant = `/platform/restaurants/new?${new URLSearchParams({ name: lead.restaurantName ?? "", city: lead.city ?? "", owner: lead.name, phone: lead.phone })}`;
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900">
            {lead.name}
            <Badge variant={STATUS[lead.status]?.variant}>{STATUS[lead.status]?.label ?? lead.status}</Badge>
          </p>
          <p className="text-[15px] text-slate-600">
            {[lead.restaurantName, lead.city].filter(Boolean).join(" · ") || "Restaurant not given"} · <b className="text-slate-800">{lead.phone}</b>
          </p>
          <p className="text-xs text-slate-400">Asked on {formatDateTime(lead.createdAt)}</p>
          {lead.message && <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-[15px] text-slate-700">{lead.message}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>
            <Button size="sm" variant="outline">
              <Phone className="h-4 w-4" /> Call
            </Button>
          </a>
          <a href={whatsappLink(lead.phone, hello)} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="text-emerald-700">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </a>
          <Link href={newRestaurant}>
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800">
              <Plus className="h-4 w-4" /> Add as restaurant
            </Button>
          </Link>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-start">
        <Select value={lead.status} onChange={(e) => save({ status: e.target.value })} aria-label="Status">
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </Select>
        <Textarea
          rows={1}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (lead.notes ?? "") && save({ notes })}
          placeholder="Your notes, e.g. call back on Monday, wants 2 outlets"
          aria-label="Notes"
        />
        <Button size="sm" variant="ghost" className="text-red-600" onClick={onDelete} aria-label={`Delete enquiry from ${lead.name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {error && <div className="mt-3"><Tip tone="danger">{error}</Tip></div>}
    </Card>
  );
}

/** Where new enquiries are emailed, with a button to send a test email. */
function EmailStatus({ email }: { email: { to: string | null; ready: boolean } }) {
  const [state, setState] = useState<{ busy?: boolean; sent?: string; error?: string }>({});
  async function test() {
    setState({ busy: true });
    try {
      const r = await api<{ to: string }>("/api/platform/leads/test-email", { method: "POST" });
      setState({ sent: r.to });
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  }
  if (!email.ready) {
    return (
      <Tip tone="warning">
        Email alerts are not switched on yet, so new enquiries only appear here.
        {email.to ? ` To get them at ${email.to}, add RESEND_API_KEY` : " To get them by email, add RESEND_API_KEY and ENQUIRY_EMAIL_TO"} in the
        Vercel project settings (Environment Variables), then redeploy.
      </Tip>
    );
  }
  return (
    <Tip tone={state.error ? "danger" : "success"}>
      <div className="flex flex-wrap items-center gap-3">
        <Mail className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">
          {state.sent
            ? `Test email sent to ${state.sent}. It can take a minute; the first one may land in Spam.`
            : state.error || (
                <>
                  Every new enquiry is also emailed to <b>{email.to}</b>.
                </>
              )}
        </span>
        <Button size="sm" variant="outline" onClick={test} disabled={state.busy}>
          {state.busy ? "Sending…" : "Send a test email"}
        </Button>
      </div>
    </Tip>
  );
}

export default function EnquiriesPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [email, setEmail] = useState<{ to: string | null; ready: boolean } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<{ leads: Lead[]; email: { to: string | null; ready: boolean } }>("/api/platform/leads").then(
      (r) => {
        setLeads(r.leads);
        setEmail(r.email);
      },
      (e) => setError(e.message)
    );
  }, []);
  useEffect(() => load(), [load]);

  if (error) return <Tip tone="danger">{error}</Tip>;
  if (!leads) return <Loading />;
  const count = (s: string) => leads.filter((l) => l.status === s).length;
  const shown = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader title="Enquiries" description="Restaurants that asked for a free demo on your website. Call or WhatsApp them, then add them as a restaurant." />
      {email && <EmailStatus email={email} />}
      <Tabs<Filter>
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: "all", label: "All", count: leads.length },
          { value: "new", label: "New", count: count("new") },
          { value: "contacted", label: "Contacted", count: count("contacted") },
          { value: "won", label: "Became customers", count: count("won") },
          { value: "lost", label: "Not interested", count: count("lost") },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState title={leads.length ? "Nothing here" : "No enquiries yet"} description="When someone fills in “Ask for a free demo” on your website, they appear here." />
      ) : (
        <div className="space-y-4">
          {shown.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              onChange={(u) => setLeads((all) => all && all.map((x) => (x.id === u.id ? u : x)))}
              onDelete={async () => {
                if (!window.confirm(`Delete the enquiry from ${l.name}?`)) return;
                await api(`/api/platform/leads/${l.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
                load();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
