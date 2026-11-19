"use client";

import { cn, label } from "@/lib/utils";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import {
  ButtonHTMLAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
} from "react";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  title,
  description,
  action,
  children,
}: {
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3", className)}>
      <div className="min-w-0">
        {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
        {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 py-4", className)} {...props}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success" | "outline" | "warning";
type ButtonSize = "sm" | "md" | "lg";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }
>(({ className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props }, ref) => {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-xs",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    outline: "border border-slate-300 bg-white text-slate-800 shadow-xs hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-xs",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs",
    warning: "bg-amber-400 text-amber-950 hover:bg-amber-500 shadow-xs",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "min-h-8 px-2.5 text-[13px] gap-1.5 [&_svg]:size-4",
    md: "min-h-10 px-3.5 text-sm gap-2 [&_svg]:size-[18px]",
    lg: "min-h-12 px-5 text-base gap-2 [&_svg]:size-5",
  };
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
Button.displayName = "Button";

const fieldClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-3 focus:ring-primary-500/15 disabled:bg-slate-50 disabled:text-slate-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldClass, "min-h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldClass, "min-h-10 pr-8", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldClass, className)} rows={3} {...props} />
);
Textarea.displayName = "Textarea";

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-[13px] font-medium text-slate-700", className)} {...props}>
      {children}
    </label>
  );
}

/** A form field with a label, an optional helper hint and "optional" marker. */
export function Field({
  label: text,
  hint,
  optional,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  // Link the label to a single Input / Select / Textarea so clicking the label
  // focuses it and screen readers announce the field name.
  const autoId = useId();
  let control = children;
  let target = htmlFor;
  if (!target && isValidElement<{ id?: string }>(children) && [Input, Select, Textarea].includes(children.type as never)) {
    target = children.props.id ?? autoId;
    if (!children.props.id) control = cloneElement(children, { id: target });
  }
  return (
    <div className={className}>
      <Label htmlFor={target}>
        {text}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </Label>
      {control}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label: text,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary-600" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-slate-800">{text}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

// Quiet status labels: a pale fill with a fine ring, never a loud block of colour.
const BADGE_COLORS: Record<string, string> = {
  default: "bg-slate-50 text-slate-700 ring-slate-500/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/25",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/20",
  // order status
  open: "bg-amber-50 text-amber-800 ring-amber-600/25",
  billed: "bg-sky-50 text-sky-700 ring-sky-600/20",
  settled: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-red-50 text-red-700 ring-red-600/20",
  // order types
  dine_in: "bg-slate-50 text-slate-700 ring-slate-500/20",
  takeaway: "bg-violet-50 text-violet-700 ring-violet-600/20",
  delivery: "bg-pink-50 text-pink-700 ring-pink-600/20",
};

export function Badge({ className, children, variant = "default" }: { className?: string; children: ReactNode; variant?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_COLORS[variant] || BADGE_COLORS.default,
        className
      )}
    >
      {children}
    </span>
  );
}

/** Badge that shows the plain-language label for any status code. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={status} className={className}>
      {label(status)}
    </Badge>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-xl ring-1 ring-slate-900/5 sm:rounded-xl",
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  onClick,
}: {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Kept for older screens; the figures are shown in one neutral style. */
  tone?: "primary" | "green" | "amber" | "red" | "sky" | "slate";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn("flex w-full flex-col gap-1 rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left", onClick && "transition hover:border-slate-300 hover:bg-slate-50")}
    >
      <span className="flex items-center justify-between gap-2 text-[13px] font-medium text-slate-500">
        {title}
        {icon && <span className="shrink-0 text-slate-400 [&_svg]:size-4">{icon}</span>}
      </span>
      <span className="break-words text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{value}</span>
      {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
    </Comp>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-[22px]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-10 text-center">
      {icon && <div className="mb-3 rounded-lg border border-slate-200 p-2.5 text-slate-500 [&_svg]:size-5">{icon}</div>}
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      {text}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ value: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  // A segmented control: one grey track, the chosen part raised in white.
  return (
    <div className={cn("max-w-full overflow-x-auto", className)}>
      <div role="tablist" className="inline-flex gap-0.5 rounded-lg bg-slate-200/70 p-0.5">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={value === t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition",
              value === t.value ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("rounded px-1.5 text-[11px] font-semibold", value === t.value ? "bg-primary-50 text-primary-700" : "bg-slate-300/60 text-slate-700")}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Small friendly tip box used to explain screens to new users. */
export function Tip({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "danger" | "success" }) {
  const tones = {
    info: { box: "border-slate-200 bg-white text-slate-700", icon: "text-primary-600", Icon: Info },
    warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: "text-amber-600", Icon: AlertTriangle },
    danger: { box: "border-red-200 bg-red-50 text-red-900", icon: "text-red-600", Icon: AlertCircle },
    success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: "text-emerald-600", Icon: CheckCircle2 },
  };
  const t = tones[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed", t.box)}>
      <t.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.icon)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Row({ label: l, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-1.5 text-sm", strong && "font-semibold text-slate-900")}>
      <span className={strong ? "" : "text-slate-600"}>{l}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
