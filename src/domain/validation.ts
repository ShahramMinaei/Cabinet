import { z } from "zod";
const id = z.string().min(1).max(100);
const finite = z.number().finite().min(0).max(1e8);
export const unitSchema = z.enum(["g", "kg", "ml", "l", "count", "pack"]);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "تاریخ معتبر وارد کنید");
export const recipeSchema = z.object({
  id,
  version: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(500),
  servings: z.number().int().min(1).max(100),
  minutes: z.number().int().min(1).max(1440),
  difficulty: z.string().max(30),
  category: z.string().max(50),
  ingredients: z
    .array(
      z.object({
        ingredientId: id,
        quantity: finite.refine((v) => v > 0),
        unit: unitSchema,
        optional: z.boolean().optional(),
        estimated: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(100),
  steps: z.array(z.string().min(1).max(1000)).min(1).max(30),
  sourceUrl: z.url().refine((v) => v.startsWith("https://")),
  sourceStatus: z.enum(["reviewed", "unavailable"]),
  note: z.string().max(1000),
  published: z.boolean(),
  imageUrl: z
    .union([z.literal(""), z.url().refine((v) => v.startsWith("https://"))])
    .optional(),
  art: z.string().max(30),
});
export const pantrySchema = z
  .object({
    id,
    ingredientId: id,
    quantity: finite,
    unit: unitSchema,
    purchasedAt: dateSchema.optional(),
    expiresAt: dateSchema.optional(),
    location: z.enum(["fridge", "freezer", "cabinet"]),
    status: z.enum(["usable", "spoiled"]),
  })
  .refine(
    (v) => !v.expiresAt || !v.purchasedAt || v.expiresAt >= v.purchasedAt,
    "انقضا باید پس از خرید باشد",
  );
export const householdSchema = z.object({
  name: z.string().trim().min(2).max(80),
  members: z
    .array(
      z.object({
        id,
        name: z.string().trim().min(1).max(60),
        allergens: z.array(id).max(30),
        dislikes: z.array(id).max(100),
      }),
    )
    .min(1)
    .max(30),
  budget: finite,
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
  cookingDays: z.number().int().min(0).max(7),
  mealsPerDay: z.number().int().min(1).max(5),
  nextShoppingDate: dateSchema,
  favorites: z.array(id).max(500),
  reserves: z.record(id, finite),
  defaultRates: z.record(id, finite),
});
export const reminderSchema = z.object({
  id,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  enabled: z.boolean(),
  slot: z.enum(["all", "breakfast", "lunch", "dinner"]),
});
export const workspaceSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().min(0),
  household: householdSchema,
  pantry: z.array(pantrySchema).max(2000),
  meals: z
    .array(
      z.object({
        id,
        date: dateSchema,
        slot: z.enum(["breakfast", "lunch", "dinner"]),
        recipe: recipeSchema,
        servings: z.number().int().min(1).max(100),
        status: z.enum(["planned", "cooked"]),
        transactionIds: z.array(id),
      }),
    )
    .max(1000),
  shopping: z
    .array(
      z.object({
        id,
        ingredientId: id,
        quantity: finite,
        unit: unitSchema,
        reasons: z.array(z.string()),
        priority: z.enum(["high", "normal"]),
        manual: z.boolean(),
        overridden: z.boolean(),
        purchased: z.boolean(),
        purchasedAt: z.string().optional(),
      }),
    )
    .max(2000),
  transactions: z
    .array(
      z.object({
        id,
        pantryItemId: id,
        ingredientId: id,
        delta: z.number().finite(),
        unit: unitSchema,
        kind: z.enum(["purchase", "consume", "adjust", "reverse", "discard"]),
        at: z.iso.datetime(),
        mealId: id.optional(),
        reversesId: id.optional(),
      }),
    )
    .max(50000),
  reminders: z.array(reminderSchema).max(30),
  notices: z
    .array(
      z.object({
        id,
        key: z.string(),
        title: z.string(),
        body: z.string(),
        at: z.iso.datetime(),
        read: z.boolean(),
      }),
    )
    .max(2000),
  operationIds: z.array(id).max(200),
});
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pantry.save"), item: pantrySchema }),
  z.object({ type: z.literal("pantry.delete"), id }),
  z.object({ type: z.literal("pantry.adjust"), id, quantity: finite }),
  z.object({ type: z.literal("household.save"), household: householdSchema }),
  z.object({ type: z.literal("favorite.toggle"), id }),
  z.object({
    type: z.literal("meal.add"),
    recipeId: id,
    date: dateSchema,
    slot: z.enum(["breakfast", "lunch", "dinner"]),
    servings: z.number().int().min(1).max(100),
  }),
  z.object({ type: z.literal("meal.delete"), id }),
  z.object({
    type: z.literal("meal.cook"),
    id,
    amounts: z.record(id, finite).optional(),
  }),
  z.object({ type: z.literal("meal.undo"), id }),
  z.object({ type: z.literal("shopping.generate") }),
  z.object({
    type: z.literal("shopping.save"),
    id: id.optional(),
    ingredientId: id,
    quantity: finite.refine((v) => v > 0),
    unit: unitSchema,
  }),
  z.object({ type: z.literal("shopping.delete"), id }),
  z.object({
    type: z.literal("shopping.purchase"),
    id,
    quantity: finite.refine((v) => v > 0),
    expiresAt: dateSchema.optional(),
    location: z.enum(["fridge", "freezer", "cabinet"]),
  }),
  z.object({ type: z.literal("reminder.save"), reminder: reminderSchema }),
  z.object({ type: z.literal("reminder.delete"), id }),
  z.object({ type: z.literal("notice.read"), id }),
  z.object({ type: z.literal("reminders.check") }),
]);
export type Action = z.infer<typeof actionSchema>;
