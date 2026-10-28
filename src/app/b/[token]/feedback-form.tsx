"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button, Textarea, Tip } from "@/components/ui";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

function Stars({ value, onChange, size = "lg", label }: { value: number; onChange: (n: number) => void; size?: "lg" | "sm"; label: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => onChange(n)} className="p-0.5">
          <Star className={cn(size === "lg" ? "h-9 w-9" : "h-6 w-6", n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
        </button>
      ))}
    </div>
  );
}

/** "How was your visit?" under the e-bill. Happy guests are asked for a Google review. */
export function FeedbackForm({ token, restaurantName, reviewUrl, initial }: { token: string; restaurantName: string; reviewUrl: string | null; initial: { rating: number; comment: string | null } | null }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [parts, setParts] = useState({ food: 0, service: 0, ambience: 0 });
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [sent, setSent] = useState(!!initial);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setSending(true);
    setError("");
    try {
      await api("/api/public/feedback", { body: { token, rating, food: parts.food || null, service: parts.service || null, ambience: parts.ambience || null, comment: comment.trim() || null } });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="no-print mx-auto mt-4 max-w-sm space-y-3 rounded-2xl bg-white p-5 text-center shadow">
        <p className="text-lg font-bold text-slate-900">Thank you for your feedback!</p>
        {rating >= 4 && reviewUrl ? (
          <>
            <p className="text-slate-600">Glad you enjoyed it. Would you share a few words on Google? It helps {restaurantName} a lot.</p>
            <a href={reviewUrl} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="w-full">Review us on Google</Button>
            </a>
          </>
        ) : rating > 0 && rating <= 2 ? (
          <p className="text-slate-600">We are sorry it was not better. The owner will look into it.</p>
        ) : (
          <p className="text-slate-600">We hope to see you again soon.</p>
        )}
        <button type="button" onClick={() => setSent(false)} className="text-sm text-slate-400 underline">
          Change my rating
        </button>
      </div>
    );
  }

  return (
    <div className="no-print mx-auto mt-4 max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow">
      <div className="text-center">
        <p className="text-lg font-bold text-slate-900">How was your visit?</p>
        <div className="mt-2 flex justify-center">
          <Stars value={rating} onChange={setRating} label="Overall rating" />
        </div>
      </div>
      {rating > 0 && (
        <>
          <div className="space-y-2">
            {(
              [
                ["food", "Food"],
                ["service", "Service"],
                ["ambience", "Ambience"],
              ] as const
            ).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">{l}</span>
                <Stars size="sm" value={parts[k]} onChange={(n) => setParts((p) => ({ ...p, [k]: n }))} label={l} />
              </div>
            ))}
          </div>
          <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={rating <= 3 ? "What could we do better?" : "Anything you loved?"} maxLength={1000} aria-label="Comment" />
          {error && <Tip tone="danger">{error}</Tip>}
          <Button size="lg" className="w-full" loading={sending} onClick={send}>
            Send feedback
          </Button>
        </>
      )}
    </div>
  );
}
