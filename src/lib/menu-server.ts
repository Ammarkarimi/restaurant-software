import { z } from "zod";
import type { Db } from "./db";
import { addonOptionSchema, parseList, variantSchema } from "./menu";
import { FOOD_TYPES, ORDER_SOURCES, ORDER_TYPES } from "./utils";

export const menuItemFields = {
  categoryId: z.string().min(1, "Choose a category"),
  name: z.string().trim().min(1, "Item name is required").max(120),
  shortCode: z
    .string()
    .trim()
    .max(12)
    .transform((s) => s.toUpperCase())
    .optional()
    .nullable(),
  description: z.string().trim().max(300).optional().nullable(),
  price: z.coerce.number().min(0, "Price cannot be negative").max(10_000_000),
  variants: z.array(variantSchema).max(10).default([]),
  foodType: z.enum(FOOD_TYPES).default("veg"),
  taxRate: z.coerce.number().min(0).max(100).optional().nullable(),
  available: z.boolean().default(true),
  addonGroupIds: z.array(z.string().min(1).max(40)).max(20).default([]),
  showOnline: z.boolean().default(true),
};

export const menuItemSchema = z.object(menuItemFields).superRefine((item, ctx) => {
  const names = item.variants.map((v) => v.name.toLowerCase());
  if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", path: ["variants"], message: "Two portions have the same name" });
});

/** Shapes validated form data for the database. Items with portions keep their lowest price as `price`. */
export function menuItemData(item: z.infer<typeof menuItemSchema>) {
  return {
    categoryId: item.categoryId,
    name: item.name,
    shortCode: item.shortCode || null,
    description: item.description || null,
    price: item.variants.length ? Math.min(...item.variants.map((v) => v.price)) : item.price,
    variants: JSON.stringify(item.variants),
    foodType: item.foodType,
    taxRate: item.taxRate ?? null,
    available: item.available,
    addonGroupIds: JSON.stringify([...new Set(item.addonGroupIds)]),
    showOnline: item.showOnline,
  };
}

/** An add-on group typed by the owner, and the dishes that offer it. */
export const addonGroupSchema = z
  .object({
    name: z.string().trim().min(1, "Group name is required").max(60),
    minSelect: z.coerce.number().int().min(0).max(20).default(0),
    maxSelect: z.coerce.number().int().min(0).max(50).default(0),
    options: z.array(addonOptionSchema).min(1, "Add at least one option").max(40),
    itemIds: z.array(z.string().min(1).max(40)).max(2000).optional(),
  })
  .superRefine((g, ctx) => {
    const names = g.options.map((o) => o.name.toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Two options have the same name" });
    if (g.maxSelect > 0 && g.minSelect > g.maxSelect) ctx.addIssue({ code: "custom", path: ["minSelect"], message: "The minimum cannot be more than the maximum" });
    if (g.minSelect > g.options.length) ctx.addIssue({ code: "custom", path: ["minSelect"], message: "The minimum is more than the number of options" });
  });

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 17:30");

/** A special price list typed by the owner. */
export const priceListSchema = z
  .object({
    name: z.string().trim().min(1, "Give the price list a name").max(60),
    active: z.boolean().default(true),
    adjustPercent: z.coerce.number().min(-90, "At most 90% off").max(500),
    roundTo: z.coerce.number().min(0.01).max(100).default(1),
    areas: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
    orderTypes: z.array(z.enum(ORDER_TYPES)).max(3).default([]),
    sources: z.array(z.enum(ORDER_SOURCES)).max(10).default([]),
    days: z.array(z.coerce.number().int().min(0).max(6)).max(7).default([]),
    startTime: time.nullable().default(null),
    endTime: time.nullable().default(null),
    categoryIds: z.array(z.string().min(1).max(40)).max(200).default([]),
    overrides: z
      .record(z.string().min(1).max(40), z.object({ price: z.number().min(0).max(10_000_000).optional(), variants: z.record(z.string().max(40), z.number().min(0).max(10_000_000)).optional() }))
      .default({}),
  })
  .superRefine((l, ctx) => {
    if (!!l.startTime !== !!l.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Give both a start and an end time, or neither" });
    if (l.startTime && l.startTime === l.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "The start and end times are the same" });
    if (!l.areas.length && !l.orderTypes.length && !l.sources.length && !l.days.length && !l.startTime)
      ctx.addIssue({ code: "custom", path: ["areas"], message: "Choose when it applies: an area, order type, app, days or a time" });
  });

export function priceListData(l: z.infer<typeof priceListSchema>) {
  return {
    name: l.name,
    active: l.active,
    adjustPercent: l.adjustPercent,
    roundTo: l.roundTo,
    areas: JSON.stringify(l.areas),
    orderTypes: JSON.stringify(l.orderTypes),
    sources: JSON.stringify(l.sources),
    days: JSON.stringify([...new Set(l.days)].sort()),
    startTime: l.startTime,
    endTime: l.endTime,
    categoryIds: JSON.stringify(l.categoryIds),
    overrides: JSON.stringify(l.overrides),
  };
}

/** Offers an add-on group with exactly these dishes: added where picked, taken off the others. */
export async function setGroupItems(db: Db, groupId: string, itemIds: string[]) {
  const wanted = new Set(itemIds);
  const items = await db.menuItem.findMany({ select: { id: true, addonGroupIds: true } });
  for (const item of items) {
    const ids = parseList(item.addonGroupIds);
    const has = ids.includes(groupId);
    if (has === wanted.has(item.id)) continue;
    const next = has ? ids.filter((x) => x !== groupId) : [...ids, groupId];
    await db.menuItem.update({ where: { id: item.id }, data: { addonGroupIds: JSON.stringify(next) } });
  }
}
