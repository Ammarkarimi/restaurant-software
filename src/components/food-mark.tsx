import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  veg: "border-green-600 text-green-600",
  non_veg: "border-red-700 text-red-700",
  egg: "border-amber-500 text-amber-500",
};

/** The square veg / non-veg mark used on Indian menus. */
export function FoodMark({ type, className }: { type: string; className?: string }) {
  const title = type === "non_veg" ? "Non-veg" : type === "egg" ? "Egg" : "Veg";
  return (
    <span
      title={title}
      aria-label={title}
      className={cn("inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border-[1.5px] bg-white", COLORS[type] ?? COLORS.veg, className)}
    >
      {type === "non_veg" ? (
        <span className="h-0 w-0 border-x-[3.5px] border-b-[6px] border-x-transparent border-b-current" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
    </span>
  );
}
