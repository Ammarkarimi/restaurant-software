// The product's own brand: Billspoon's name, slogan and mark. A restaurant's own name and logo
// (from Settings) are separate and shown to its staff and guests.

export const BRAND = {
  name: "Billspoon",
  slogan: "Every bill, every table, every rupee.",
  /** Deep green of the mark and the dark sections; lime is the highlight on it. */
  ink: "#0E3B2A",
  lime: "#C5F06B",
};

/**
 * The mark: a lowercase “b” drawn as a spoon (the handle is the stem, the bowl is the round)
 * on a deep green tile. Size it with className (h-/w-).
 */
export function BrandMark({ className = "h-10 w-10", title, flat = false }: { className?: string; title?: string; flat?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {!flat && <rect width="64" height="64" rx="15" fill={BRAND.ink} />}
      <rect x="18" y="10" width="8.5" height="38" rx="4.25" fill={BRAND.lime} />
      <ellipse cx="35.5" cy="40" rx="12.25" ry="11.25" fill="none" stroke={BRAND.lime} strokeWidth="7.5" />
    </svg>
  );
}

/** The product name as a wordmark. On dark backgrounds pass dark. */
export function BrandName({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return <span className={`font-semibold tracking-tight ${dark ? "text-white" : "text-slate-900"} ${className}`}>{BRAND.name}</span>;
}

/** Mark and name together, as used in headers. */
export function BrandLockup({ dark = false, className = "", markClassName = "h-8 w-8" }: { dark?: boolean; className?: string; markClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark className={`${markClassName} shrink-0`} />
      <BrandName dark={dark} className="text-lg" />
    </span>
  );
}
