"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui";

/** Waits for the logo and QR code to load, so they are on the paper. */
function whenImagesReady(): Promise<void> {
  const pending = [...document.images].filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          })
      )
    ).then(() => undefined),
    new Promise<void>((r) => setTimeout(r, 2500)),
  ]);
}

export function PrintButton({ auto = false, title, closable = true }: { auto?: boolean; title?: string; closable?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const t = setTimeout(() => whenImagesReady().then(() => !cancelled && window.print()), 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [auto]);
  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
      {closable && (
        <Button variant="outline" onClick={() => window.close()}>
          Close
        </Button>
      )}
      {title && <span className={closable ? "hidden truncate text-sm font-semibold text-slate-600 sm:block" : "truncate text-sm font-semibold text-slate-600"}>{title}</span>}
      <Button onClick={() => window.print()}>
        <Printer className="h-5 w-5" /> {closable ? "Print" : "Print / save PDF"}
      </Button>
    </div>
  );
}
