"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Button, Modal, Textarea } from "@/components/ui";
import { cn, setCurrency } from "@/lib/utils";
import type { SessionUser } from "@/lib/session";

export interface ShellSettings {
  restaurantName: string;
  currency: string;
  timezone: string;
  today: string;
  logoUrl: string | null;
  /** Shown to owners when the software subscription is overdue. */
  subscriptionNotice?: string | null;
  /** Owners who run several restaurants can switch between them. */
  outlets?: Array<{ id: string; name: string }>;
}

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  askReason?: string; // when set, shows a text box with this label
}

interface AppContextValue {
  user: SessionUser;
  isAdmin: boolean;
  settings: ShellSettings;
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (opts: ConfirmOptions) => Promise<false | { reason: string }>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function AppProvider({ user, settings, children }: { user: SessionUser; settings: ShellSettings; children: ReactNode }) {
  setCurrency(settings.currency);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: false | { reason: string }) => void }) | null>(null);
  const [reason, setReason] = useState("");
  const nextId = useRef(1);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4000);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setReason("");
    return new Promise<false | { reason: string }>((resolve) => setConfirmState({ ...opts, resolve }));
  }, []);

  function close(result: false | { reason: string }) {
    confirmState?.resolve(result);
    setConfirmState(null);
  }

  useEffect(() => setCurrency(settings.currency), [settings.currency]);

  const icons = { success: CheckCircle2, error: XCircle, info: Info };

  return (
    <AppContext.Provider value={{ user, isAdmin: user.role === "admin", settings, toast, confirm }}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "animate-toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-white shadow-lg",
                t.tone === "success" && "bg-emerald-600",
                t.tone === "error" && "bg-red-600",
                t.tone === "info" && "bg-slate-800"
              )}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!confirmState}
        onClose={() => close(false)}
        title={
          <span className="flex items-center gap-2">
            {confirmState?.danger && <AlertTriangle className="h-5 w-5 text-red-600" />}
            {confirmState?.title}
          </span>
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>
              {confirmState?.cancelText ?? "No, go back"}
            </Button>
            <Button variant={confirmState?.danger ? "danger" : "primary"} onClick={() => close({ reason })}>
              {confirmState?.confirmText ?? "Yes, continue"}
            </Button>
          </>
        }
      >
        {confirmState?.message && <div className="text-[15px] text-slate-600">{confirmState.message}</div>}
        {confirmState?.askReason && (
          <div className="mt-3">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{confirmState.askReason}</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        )}
      </Modal>
    </AppContext.Provider>
  );
}
