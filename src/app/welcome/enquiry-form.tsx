"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Field, Input, Textarea, Tip } from "@/components/ui";
import { api } from "@/lib/client";

/** "Ask for a free demo": the enquiry goes to the software provider's owner panel. */
export function EnquiryForm() {
  const [form, setForm] = useState({ name: "", restaurantName: "", phone: "", city: "", message: "", website: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await api("/api/public/lead", { body: form });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-emerald-50 p-8 text-center text-emerald-900">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <p className="text-xl font-bold">Thank you, {form.name.split(" ")[0]}!</p>
        <p>We&apos;ll call you on {form.phone} to set up your free demo.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Your name">
        <Input value={form.name} onChange={(e) => set({ name: e.target.value })} required maxLength={80} autoComplete="name" />
      </Field>
      <Field label="Phone / WhatsApp">
        <Input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} required maxLength={20} autoComplete="tel" inputMode="tel" />
      </Field>
      <Field label="Restaurant name" optional>
        <Input value={form.restaurantName} onChange={(e) => set({ restaurantName: e.target.value })} maxLength={120} />
      </Field>
      <Field label="City" optional>
        <Input value={form.city} onChange={(e) => set({ city: e.target.value })} maxLength={80} autoComplete="address-level2" />
      </Field>
      <Field label="Anything we should know?" optional hint="e.g. 20 tables, 2 outlets, we use Zomato and Swiggy" className="sm:col-span-2">
        <Textarea rows={3} value={form.message} onChange={(e) => set({ message: e.target.value })} maxLength={1000} />
      </Field>
      {/* Left empty by people; filled in by spam bots. */}
      <input type="text" name="website" value={form.website} onChange={(e) => set({ website: e.target.value })} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && (
        <div className="sm:col-span-2">
          <Tip tone="danger">{error}</Tip>
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={sending} className="w-full sm:w-auto">
          Ask for a free demo
        </Button>
      </div>
    </form>
  );
}
