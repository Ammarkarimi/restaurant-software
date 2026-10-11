import { z } from "zod";
import { variantSchema } from "./menu";
import { FOOD_TYPES } from "./utils";

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
  };
}
