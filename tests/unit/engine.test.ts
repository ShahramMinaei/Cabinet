import { describe, it, expect } from "vitest";
import {
  applyAction,
  baseQuantity,
  convert,
  emptyWorkspace,
  initialRecipes,
  shoppingNeeds,
  recipeRequirements,
  normalizeName,
  resolveIngredient,
  blockedReasons,
  forecast,
} from "@/domain/engine";
import { workspaceSchema } from "@/domain/validation";
import type { Recipe, Workspace } from "@/domain/types";
const now = new Date("2026-10-09T14:00:00Z");
function stock(
  state: Workspace,
  id = "potato",
  quantity = 300,
  expiresAt = "2026-10-20",
) {
  state.pantry.push({
    id: crypto.randomUUID(),
    ingredientId: id,
    quantity,
    unit: id === "egg" ? "count" : "g",
    location: "cabinet",
    status: "usable",
    expiresAt,
  });
}
const recipe: Recipe = {
  ...initialRecipes[0],
  id: "test",
  servings: 2,
  ingredients: [{ ingredientId: "potato", quantity: 1000, unit: "g" }],
};
function meal(s: Workspace, date = "2026-10-09", r = recipe) {
  s.meals.push({
    id: crypto.randomUUID(),
    date,
    slot: "dinner",
    recipe: r,
    servings: 2,
    status: "planned",
    transactionIds: [],
  });
}
describe("units and identity", () => {
  it("normalizes Persian aliases", () => {
    expect(normalizeName("سیب‌زمینی")).toBe(normalizeName("سیب زمینی"));
    expect(resolveIngredient("سیب زمینی")?.id).toBe("potato");
  });
  it("only converts compatible dimensions", () => {
    expect(convert(1, "kg", "g")).toBe(1000);
    expect(convert(1, "l", "ml")).toBe(1000);
    expect(() => convert(2, "count", "g")).toThrow();
    expect(() => baseQuantity("potato", 1, "pack")).toThrow();
  });
  it("aggregates duplicate recipe ingredients after scaling", () => {
    const q = recipeRequirements(
      {
        ...recipe,
        ingredients: [
          { ingredientId: "potato", quantity: 1, unit: "kg" },
          { ingredientId: "potato", quantity: 200, unit: "g" },
        ],
      },
      1,
    );
    expect(q.get("potato")).toBe(600);
  });
});
describe("shopping requirements", () => {
  it("subtracts stock: 1000 minus 300 equals 700", () => {
    const s = emptyWorkspace(now);
    stock(s);
    meal(s);
    expect(shoppingNeeds(s, now)[0].quantity).toBe(700);
  });
  it("allocates stock once across multiple meals", () => {
    const s = emptyWorkspace(now);
    stock(s);
    meal(s);
    meal(s, "2026-10-10");
    expect(shoppingNeeds(s, now)[0].quantity).toBe(1700);
  });
  it("excludes stock expired on the meal date", () => {
    const s = emptyWorkspace(now);
    stock(s, "potato", 1000, "2026-10-09");
    meal(s, "2026-10-10");
    expect(shoppingNeeds(s, now)[0].quantity).toBe(1000);
  });
  it("never returns negative shortages", () => {
    const s = emptyWorkspace(now);
    stock(s, "potato", 1500);
    meal(s);
    expect(shoppingNeeds(s, now)).toEqual([]);
  });
  it("adds desired reserve without double-counting forecast", () => {
    const s = emptyWorkspace(now);
    stock(s);
    meal(s);
    s.household.defaultRates.potato = 100;
    s.household.reserves.potato = 200;
    expect(shoppingNeeds(s, now)[0].quantity).toBe(900);
  });
  it("merges manual duplicates and preserves user overrides on regeneration", () => {
    let s = emptyWorkspace(now);
    s = applyAction(
      s,
      {
        type: "shopping.save",
        ingredientId: "potato",
        quantity: 1,
        unit: "kg",
      },
      [],
      now,
    );
    s = applyAction(
      s,
      {
        type: "shopping.save",
        ingredientId: "potato",
        quantity: 700,
        unit: "g",
      },
      [],
      now,
    );
    meal(s);
    s = applyAction(s, { type: "shopping.generate" }, [], now);
    expect(s.shopping).toHaveLength(1);
    expect(s.shopping[0].quantity).toBe(700);
  });
  it("records a purchased item exactly once", () => {
    let s = emptyWorkspace(now);
    s = applyAction(
      s,
      {
        type: "shopping.save",
        ingredientId: "potato",
        quantity: 700,
        unit: "g",
      },
      [],
      now,
    );
    const action = {
      type: "shopping.purchase" as const,
      id: s.shopping[0].id,
      quantity: 800,
      location: "cabinet" as const,
    };
    s = applyAction(s, action, [], now);
    s = applyAction(s, action, [], now);
    expect(s.pantry[0].quantity).toBe(800);
    expect(s.transactions).toHaveLength(1);
  });
});
describe("consumption and safety", () => {
  it("uses earliest-expiry lots first and supports idempotent reversal", () => {
    let s = emptyWorkspace(now);
    stock(s, "potato", 500, "2026-10-15");
    stock(s, "potato", 600, "2026-10-10");
    meal(s);
    const id = s.meals[0].id;
    s = applyAction(s, { type: "meal.cook", id }, [], now);
    expect(s.pantry.map((p) => p.quantity)).toEqual([100, 0]);
    s = applyAction(s, { type: "meal.undo", id }, [], now);
    s = applyAction(s, { type: "meal.undo", id }, [], now);
    expect(s.pantry.map((p) => p.quantity)).toEqual([500, 600]);
  });
  it("accepts corrected actual consumption", () => {
    let s = emptyWorkspace(now);
    stock(s);
    meal(s);
    s = applyAction(
      s,
      { type: "meal.cook", id: s.meals[0].id, amounts: { potato: 200 } },
      [],
      now,
    );
    expect(s.pantry[0].quantity).toBe(100);
  });
  it("rejects insufficient stock without mutating input", () => {
    const s = emptyWorkspace(now);
    stock(s);
    meal(s);
    expect(() =>
      applyAction(s, { type: "meal.cook", id: s.meals[0].id }, [], now),
    ).toThrow();
    expect(s.pantry[0].quantity).toBe(300);
  });
  it("rejects negative stock and incompatible pantry units", () => {
    const s = emptyWorkspace(now);
    stock(s);
    expect(() =>
      applyAction(
        s,
        { type: "pantry.adjust", id: s.pantry[0].id, quantity: -1 },
        [],
        now,
      ),
    ).toThrow();
    expect(() =>
      applyAction(
        s,
        { type: "pantry.save", item: { ...s.pantry[0], unit: "count" } },
        [],
        now,
      ),
    ).toThrow();
  });
  it("blocks allergies even in optional ingredients", () => {
    const s = emptyWorkspace(now);
    s.household.members[0].allergens = ["tree-nut"];
    expect(
      blockedReasons(
        initialRecipes.find((r) => r.id === "herb-kuku")!,
        s,
      ),
    ).toContain("مغزهای درختی");
  });
  it("rechecks allergies before cooking old plans", () => {
    const s = emptyWorkspace(now);
    meal(s, "2026-10-09", initialRecipes[0]);
    s.household.members[0].allergens = ["milk"];
    expect(() =>
      applyAction(
        s,
        { type: "meal.cook", id: s.meals[0].id },
        initialRecipes,
        now,
      ),
    ).toThrow("محدودیت");
  });
  it("excludes reversed consumption from forecasts", () => {
    let s = emptyWorkspace(now);
    stock(s, "potato", 1500);
    meal(s);
    const id = s.meals[0].id;
    s = applyAction(s, { type: "meal.cook", id }, [], now);
    s = applyAction(s, { type: "meal.undo", id }, [], now);
    expect(forecast(s, "potato", now).samples).toBe(0);
  });
  it("generates a reminder once per local date and time", () => {
    let s = emptyWorkspace(now);
    meal(s);
    s.reminders = [
      { id: "r1", time: "17:00", days: [5], enabled: true, slot: "dinner" },
    ];
    s = applyAction(s, { type: "reminders.check" }, [], now);
    s = applyAction(s, { type: "reminders.check" }, [], now);
    expect(s.notices).toHaveLength(1);
  });
  it("does not treat three lots used by one meal as three independent observations", () => {
    let s = emptyWorkspace(now);
    stock(s, "potato", 350);
    stock(s, "potato", 350);
    stock(s, "potato", 350);
    meal(s);
    s = applyAction(s, { type: "meal.cook", id: s.meals[0].id }, [], now);
    const result = forecast(s, "potato", now);
    expect(result.samples).toBe(1);
    expect(result.confidence).toBe("low");
  });
  it("creates no reminders without a shortage", () => {
    let s = emptyWorkspace(now);
    s.reminders = [
      { id: "r1", time: "17:00", days: [5], enabled: true, slot: "all" },
    ];
    s = applyAction(s, { type: "reminders.check" }, [], now);
    expect(s.notices).toHaveLength(0);
  });
  it("keeps real households empty", () => {
    const s = emptyWorkspace(now);
    expect(s.pantry).toHaveLength(0);
    expect(s.meals).toHaveLength(0);
    expect(workspaceSchema.safeParse(s).success).toBe(true);
  });
});
