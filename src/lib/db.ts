import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

/**
 * Sees every restaurant's data. Only for sign-in and the software provider's /platform panel — never for a restaurant's own screens.
 */
export const rawPrisma = base;

const restaurantContext = new AsyncLocalStorage<{ restaurantId: string }>();

/** Runs `fn` with every `prisma` query limited to one restaurant's data. */
export function runForRestaurant<T>(restaurantId: string, fn: () => T): T {
  return restaurantContext.run({ restaurantId }, () => {
    const result = fn();
    // Prisma queries are lazy and only run when awaited. Start them now, while
    // the restaurant is still selected, so `runForRestaurant(id, () => prisma.x.find())` works.
    if (result && typeof (result as { then?: unknown }).then === "function") {
      return Promise.resolve(result) as T;
    }
    return result;
  });
}

export function currentRestaurantId(): string {
  const context = restaurantContext.getStore();
  if (!context) throw new Error("No restaurant selected: restaurant data can only be read inside runForRestaurant()");
  return context.restaurantId;
}

/** Tables whose rows belong to a single restaurant. */
const RESTAURANT_MODELS = new Set([
  "Staff",
  "RestaurantSettings",
  "DiningTable",
  "MenuCategory",
  "MenuItem",
  "Order",
  "OrderItem",
  "Payment",
  "ActivityLog",
  "Customer",
  "Expense",
  "DayClose",
]);

type Args = Record<string, unknown> & { where?: object; data?: unknown; create?: object };

export function scopeArgs(operation: string, args: Args | undefined, restaurantId: string): Args {
  const a: Args = { ...(args ?? {}) };
  switch (operation) {
    case "create":
      a.data = { ...(a.data as object), restaurantId };
      break;
    case "createMany":
    case "createManyAndReturn":
      a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d: object) => ({ ...d, restaurantId }));
      break;
    case "upsert":
      a.where = { ...a.where, restaurantId };
      a.create = { ...a.create, restaurantId };
      break;
    default:
      // Reads, counts, updates and deletes: only ever touch this restaurant's rows.
      a.where = { ...a.where, restaurantId };
  }
  return a;
}

/**
 * The database client for a restaurant's own screens. Every query on a restaurant table is
 * filtered to the restaurant of the current request, and new rows are stamped with it.
 * Using it outside runForRestaurant() throws, so a missed check fails loudly instead
 * of showing one restaurant another restaurant's data.
 */
export const prisma = base.$extends({
  name: "restaurant-scope",
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (!RESTAURANT_MODELS.has(model)) return query(args);
        return query(scopeArgs(operation, args as Args, currentRestaurantId()) as typeof args);
      },
    },
  },
});

/** Either the restaurant client or a transaction opened on it. */
export type Db = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
