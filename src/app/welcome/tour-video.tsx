"use client";

import { useRef, useState } from "react";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import tour from "./tour.json";

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The product tour with chapters: tap a chapter to jump to that part of the video. */
export function TourVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);
  const current = [...tour.chapters].reverse().find((c) => now >= c.t - 0.2);

  function jump(t: number) {
    const v = video.current;
    if (!v) return;
    v.currentTime = t;
    void v.play().catch(() => {});
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="self-start overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-slate-900/10">
        <video
          ref={video}
          controls
          playsInline
          preload="metadata"
          poster="/landing/tour-poster.webp"
          className="block aspect-[1280/824] w-full bg-slate-900"
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
        >
          <source src="/landing/restoowl-tour.webm" type="video/webm" />
          <source src="/landing/restoowl-tour.mp4" type="video/mp4" />
          Your browser cannot play this video.
        </video>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Jump to a part · {time(tour.duration)} in all</p>
        <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
          {tour.chapters.map((c) => (
            <li key={c.t}>
              <button
                onClick={() => jump(c.t)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] transition",
                  current?.t === c.t ? "bg-primary-50 font-semibold text-primary-800 ring-1 ring-primary-200" : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <PlayCircle className={cn("h-4 w-4 shrink-0", current?.t === c.t ? "text-primary-600" : "text-slate-400")} />
                <span className="min-w-0 flex-1">{c.label}</span>
                <span className="shrink-0 font-mono text-xs text-slate-400">{time(c.t)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
