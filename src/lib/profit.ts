// Profit & loss for a period, and menu engineering: which dishes earn their place on the menu.
// The maths is kept apart from the database so it can be tested.

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const FOOD_EXPENSE_CATEGORIES = ["Vegetables & fruit", "Groceries", "Meat & fish", "Dairy"];
export const STAFF_EXPENSE_CATEGORY = "Staff salary / advance";
// Paying a supplier for goods already counted when they were received: not a second cost.
export const NOT_A_COST = ["Supplier payment"];

export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog" | "no_recipe";

export const MENU_CLASS: Record<MenuClass, { label: string; advice: string }> = {
  star: { label: "Star", advice: "Sells a lot and earns well. Keep it visible and the recipe steady." },
  plowhorse: { label: "Workhorse", advice: "Sells a lot but earns little. Raise the price a little or make it cheaper to cook." },
  puzzle: { label: "Hidden gem", advice: "Earns well but few order it. Put it higher on the menu or ask staff to suggest it." },
  dog: { label: "Rethink", advice: "Sells little and earns little. Change it or take it off the menu." },
  no_recipe: { label: "No recipe", advice: "Add a recipe in Stock → Recipes to see what it earns." },
};

export interface DishSales {
  key: string;
  name: string;
  category: string;
  quantity: number;
  /** Money from the dish before tax. */
  revenue: number;
  /** Ingredient cost of one plate from its recipe; null without a recipe. */
  unitCost: number | null;
}

export interface DishRow extends DishSales {
  share: number;
  unitMargin: number | null;
  margin: number | null;
  foodCostPercent: number | null;
  klass: MenuClass;
}

/**
 * The classic menu-engineering grid. A dish is popular when it sells at least 70% of an equal share
 * of all plates; it earns well when its margin per plate is at least the average margin per plate.
 */
export function menuEngineering(dishes: DishSales[]): { rows: DishRow[]; popularAt: number; averageMargin: number } {
  const sold = dishes.filter((d) => d.quantity > 0);
  const plates = sold.reduce((s, d) => s + d.quantity, 0);
  const popularAt = sold.length ? (0.7 * plates) / sold.length : 0;
  const costed = sold.filter((d) => d.unitCost !== null);
  const costedPlates = costed.reduce((s, d) => s + d.quantity, 0);
  const totalMargin = costed.reduce((s, d) => s + (d.revenue - d.unitCost! * d.quantity), 0);
  const averageMargin = costedPlates ? totalMargin / costedPlates : 0;
  const rows = sold
    .map((d) => {
      const unitMargin = d.unitCost === null ? null : r2(d.revenue / d.quantity - d.unitCost);
      const popular = d.quantity >= popularAt;
      const klass: MenuClass = unitMargin === null ? "no_recipe" : popular ? (unitMargin >= averageMargin ? "star" : "plowhorse") : unitMargin >= averageMargin ? "puzzle" : "dog";
      return {
        ...d,
        revenue: r2(d.revenue),
        share: plates ? r2((d.quantity / plates) * 100) : 0,
        unitMargin,
        margin: unitMargin === null ? null : r2(unitMargin * d.quantity),
        foodCostPercent: d.unitCost === null || d.revenue <= 0 ? null : r2(((d.unitCost * d.quantity) / d.revenue) * 100),
        klass,
      };
    })
    .sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity) || b.quantity - a.quantity);
  return { rows, popularAt: r2(popularAt), averageMargin: r2(averageMargin) };
}

export interface PnlInput {
  /** Restaurant bills, before tax (food after discounts, service charge, packing / delivery). */
  netSales: number;
  /** Banquet invoices in the period, before tax. */
  banquetSales: number;
  /** Stock bought (purchases received, stock added with a cost). */
  stockPurchases: number;
  /** Expenses by category. Expenses saved for stock already counted above must be left out. */
  expenses: Array<{ category: string; amount: number }>;
  /** What the dishes sold should have used, from their recipes (null when no recipes). */
  recipeCost: number | null;
}

export function profitAndLoss(p: PnlInput) {
  const revenue = r2(p.netSales + p.banquetSales);
  const foodExpenses = r2(p.expenses.filter((e) => FOOD_EXPENSE_CATEGORIES.includes(e.category)).reduce((s, e) => s + e.amount, 0));
  const food = r2(p.stockPurchases + foodExpenses);
  const staff = r2(p.expenses.filter((e) => e.category === STAFF_EXPENSE_CATEGORY).reduce((s, e) => s + e.amount, 0));
  const other = p.expenses
    .filter((e) => !FOOD_EXPENSE_CATEGORIES.includes(e.category) && e.category !== STAFF_EXPENSE_CATEGORY && !NOT_A_COST.includes(e.category))
    .map((e) => ({ category: e.category, amount: r2(e.amount) }))
    .sort((a, b) => b.amount - a.amount);
  const otherTotal = r2(other.reduce((s, e) => s + e.amount, 0));
  const gross = r2(revenue - food);
  const net = r2(gross - staff - otherTotal);
  const pct = (n: number) => (revenue > 0 ? r2((n / revenue) * 100) : 0);
  return {
    revenue,
    netSales: r2(p.netSales),
    banquetSales: r2(p.banquetSales),
    food,
    stockPurchases: r2(p.stockPurchases),
    foodExpenses,
    foodPercent: pct(food),
    recipeCost: p.recipeCost === null ? null : r2(p.recipeCost),
    recipePercent: p.recipeCost === null ? null : pct(p.recipeCost),
    gross,
    staff,
    staffPercent: pct(staff),
    other,
    otherTotal,
    net,
    netPercent: pct(net),
  };
}
