// The product's own brand: the RestoOwl owl, name and slogan. A restaurant's own name and logo
// (from Settings) are separate and shown to its staff and guests.

export const BRAND = {
  name: "RestoOwl",
  slogan: "Always watching over your restaurant.",
};

/** The owl on an orange tile. Size it with className (h-/w-). */
export function OwlMark({ className = "h-10 w-10", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="64" height="64" rx="16" fill="#EA580C" />
      <path d="M14 23 L17 9 L26 17 Q32 15 38 17 L47 9 L50 23 Q55 31 52.5 41 Q48.5 55 32 56.5 Q15.5 55 11.5 41 Q9 31 14 23 Z" fill="#fff" />
      <circle cx="24" cy="33" r="7.5" fill="#0F172A" />
      <circle cx="40" cy="33" r="7.5" fill="#0F172A" />
      <circle cx="26.2" cy="30.8" r="2.4" fill="#fff" />
      <circle cx="42.2" cy="30.8" r="2.4" fill="#fff" />
      <path d="M28.5 40.5 H35.5 L32 46 Z" fill="#F59E0B" />
    </svg>
  );
}

/** "RestoOwl" with "Owl" in orange. On dark backgrounds pass dark. */
export function BrandName({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${dark ? "text-white" : "text-slate-900"} ${className}`}>
      Resto<span className={dark ? "text-primary-400" : "text-primary-600"}>Owl</span>
    </span>
  );
}
