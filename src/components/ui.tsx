"use client";

import { cn, label } from "@/lib/utils";
import { Loader2, X } from "lucide-react";
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
    <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)} {...props}>
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
    <div className={cn("flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4", className)}>
      <div className="min-w-0">
        {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 py-4", className)} {...props}>
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
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
    warning: "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "min-h-9 px-3 text-sm gap-1.5",
    md: "min-h-11 px-4 text-[15px] gap-2",
    lg: "min-h-14 px-6 text-lg gap-2.5",
  };
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
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
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 disabled:bg-slate-50 disabled:text-slate-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldClass, "min-h-11", className)} {...props} />
));
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldClass, "min-h-11 pr-8", className)} {...props}>
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
    <label className={cn("mb-1.5 block text-sm font-semibold text-slate-700", className)} {...props}>
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
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary-600" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{text}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

const BADGE_COLORS: Record<string, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-800",
  purple: "bg-violet-100 text-violet-800",
  // order status
  open: "bg-amber-100 text-amber-800",
  billed: "bg-sky-100 text-sky-800",
  settled: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
  // order types
  dine_in: "bg-slate-100 text-slate-700",
  takeaway: "bg-violet-100 text-violet-800",
  delivery: "bg-pink-100 text-pink-800",
};

export function Badge({ className, children, variant = "default" }: { className?: string; children: ReactNode; variant?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
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
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl",
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "primary",
  onClick,
}: {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tone?: "primary" | "green" | "amber" | "red" | "sky" | "slate";
  onClick?: () => void;
}) {
  const tones = {
    primary: "bg-primary-50 text-primary-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    sky: "bg-sky-50 text-sky-600",
    slate: "bg-slate-100 text-slate-600",
  };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm",
        onClick && "transition hover:border-primary-300 hover:shadow"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-1 break-words text-xl font-bold text-slate-900 sm:text-2xl">{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {icon && <div className={cn("shrink-0 rounded-xl p-2.5", tones[tone])}>{icon}</div>}
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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-slate-500">{description}</p>}
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
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      {icon && <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500">{icon}</div>}
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
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
  return (
    <div className={cn("-mx-1 flex gap-1 overflow-x-auto px-1 pb-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
            value === t.value ? "bg-primary-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs",
                value === t.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Small friendly tip box used to explain screens to new users. */
export function Tip({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "danger" | "success" }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function Row({ label: l, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-1.5 text-[15px]", strong && "font-bold text-slate-900")}>
      <span className={strong ? "" : "text-slate-600"}>{l}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
