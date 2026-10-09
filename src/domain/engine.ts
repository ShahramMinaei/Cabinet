import data from "@/data/catalog.json";
import { addDays, localDate } from "@/lib/dates";
import type { Action } from "./validation";
import { actionSchema, householdSchema, workspaceSchema } from "./validation";
import type {
  Ingredient,
  Recipe,
  Workspace,
  Unit,
  Need,
  Transaction,
} from "./types";
export const ingredients = data.ingredients as Ingredient[];
export const initialRecipes = data.recipes as Recipe[];
export const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
export const allergens: Record<string, string> = {
  milk: "شیر و لبنیات",
  egg: "تخم‌مرغ",
  gluten: "گندم و گلوتن",
  soy: "سویا",
  "tree-nut": "مغزهای درختی",
};
export const uid = () => crypto.randomUUID();
export function normalizeName(name: string) {
  return name
    .normalize("NFKC")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\s\u200c\u200dـ]+/g, "")
    .trim()
    .toLowerCase();
}
export function resolveIngredient(name: string) {
  const n = normalizeName(name);
  return ingredients.find((i) =>
    [i.name, ...i.aliases].some((a) => normalizeName(a) === n),
  );
}
const dimensions: Record<Unit, { dimension: string; factor: number }> = {
  g: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 },
  ml: { dimension: "volume", factor: 1 },
  l: { dimension: "volume", factor: 1000 },
  count: { dimension: "count", factor: 1 },
  pack: { dimension: "pack", factor: 1 },
};
export function convert(quantity: number, from: Unit, to: Unit) {
  if (!Number.isFinite(quantity) || quantity < 0)
    throw new Error("مقدار معتبر نیست");
  if (dimensions[from].dimension !== dimensions[to].dimension)
    throw new Error("تبدیل این واحدها بدون ضریب معتبر ممکن نیست");
  return (quantity * dimensions[from].factor) / dimensions[to].factor;
}
export function baseQuantity(
  ingredientId: string,
  quantity: number,
  unit: Unit,
) {
  const i = ingredientMap.get(ingredientId);
  if (!i) throw new Error("ماده غذایی شناخته نشد");
  return convert(quantity, unit, i.unit);
}
export function emptyWorkspace(now = new Date()): Workspace {
  const date = localDate("Asia/Tehran", now);
  return {
    schemaVersion: 1,
    revision: 0,
    household: {
      name: "آشپزخانه من",
      members: [{ id: uid(), name: "من", allergens: [], dislikes: [] }],
      budget: 0,
      timezone: "Asia/Tehran",
      cookingDays: 5,
      mealsPerDay: 2,
      nextShoppingDate: addDays(date, 7),
      favorites: [],
      reserves: {},
      defaultRates: {},
    },
    pantry: [],
    meals: [],
    shopping: [],
    transactions: [],
    reminders: [],
    notices: [],
    operationIds: [],
  };
}
export function demoWorkspace(now = new Date()): Workspace {
  const s = emptyWorkspace(now),
    today = localDate(s.household.timezone, now);
  s.household.name = "آشپزخانه آوا";
  s.household.members = [
    { id: uid(), name: "آوا", allergens: [], dislikes: [] },
    { id: uid(), name: "سامان", allergens: [], dislikes: [] },
  ];
  s.household.budget = 1500000;
  s.household.reserves = { milk: 500, egg: 4 };
  const stocks: [string, number, "fridge" | "cabinet" | "freezer", number?][] =
    [
      ["potato", 300, "cabinet", 9],
      ["egg", 6, "fridge", 12],
      ["onion", 600, "cabinet", 20],
      ["rice", 1800, "cabinet", 90],
      ["milk", 250, "fridge", 2],
      ["tomato", 450, "fridge", 3],
      ["chicken", 250, "freezer", 30],
      ["mushroom", 180, "fridge", 2],
      ["penne", 400, "cabinet", 60],
      ["lentil", 500, "cabinet", 80],
      ["oil", 500, "cabinet", 90],
      ["salt", 250, "cabinet", 365],
      ["pepper", 50, "cabinet", 365],
      ["turmeric", 60, "cabinet", 365],
      ["chickpea-flour", 200, "cabinet", 90],
      ["cream", 150, "fridge", 4],
      ["garlic", 60, "cabinet", 20],
      ["butter", 100, "fridge", 20],
      ["parmesan", 60, "fridge", 15],
      ["thyme", 30, "cabinet", 90],
    ];
  s.pantry = stocks.map(([ingredientId, quantity, location, days]) => ({
    id: uid(),
    ingredientId,
    quantity,
    unit: ingredientMap.get(ingredientId)!.unit,
    location,
    purchasedAt: today,
    expiresAt: days ? addDays(today, days) : undefined,
    status: "usable",
  }));
  s.reminders = [
    {
      id: uid(),
      time: "17:00",
      days: [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
      slot: "dinner",
    },
  ];
  return s;
}
export function usableStock(
  state: Workspace,
  ingredientId: string,
  date: string,
) {
  return state.pantry
    .filter(
      (p) =>
        p.ingredientId === ingredientId &&
        p.status === "usable" &&
        (!p.expiresAt || p.expiresAt >= date),
    )
    .reduce(
      (sum, p) => sum + baseQuantity(p.ingredientId, p.quantity, p.unit),
      0,
    );
}
export function recipeRequirements(recipe: Recipe, servings: number) {
  const map = new Map<string, number>();
  for (const r of recipe.ingredients) {
    map.set(
      r.ingredientId,
      (map.get(r.ingredientId) || 0) +
        (baseQuantity(r.ingredientId, r.quantity, r.unit) * servings) /
          recipe.servings,
    );
  }
  return map;
}
export function blockedReasons(recipe: Recipe, state: Workspace) {
  const restricted = new Set(
      state.household.members.flatMap((m) => m.allergens),
    ),
    dislikes = new Set(state.household.members.flatMap((m) => m.dislikes));
  const found = new Set<string>();
  for (const r of recipe.ingredients) {
    const i = ingredientMap.get(r.ingredientId);
    if (!i) {
      found.add("ترکیب بررسی‌نشده");
      continue;
    }
    if (dislikes.has(i.id)) found.add(i.name);
    for (const a of i.allergens)
      if (restricted.has(a)) found.add(allergens[a] || a);
  }
  return [...found];
}
export function recipeCoverage(
  recipe: Recipe,
  state: Workspace,
  servings = state.household.members.length,
  date = localDate(state.household.timezone),
) {
  const required = recipeRequirements(recipe, servings);
  let present = 0;
  const missing: Need[] = [];
  for (const [ingredientId, q] of required) {
    const stock = usableStock(state, ingredientId, date);
    present += Math.min(1, stock / q);
    if (stock + 1e-6 < q)
      missing.push({
        ingredientId,
        quantity: q - stock,
        unit: ingredientMap.get(ingredientId)!.unit,
        reasons: ["برای " + recipe.name],
        priority: "high",
      });
  }
  return { percent: Math.round((present / required.size) * 100), missing };
}
export function recommend(
  recipes: Recipe[],
  state: Workspace,
  date = localDate(state.household.timezone),
) {
  return recipes
    .filter((r) => r.published && !blockedReasons(r, state).length)
    .map((recipe) => {
      const coverage = recipeCoverage(
        recipe,
        state,
        state.household.members.length,
        date,
      );
      const usesExpiring = recipe.ingredients.some((i) =>
        state.pantry.some(
          (p) =>
            p.ingredientId === i.ingredientId &&
            p.quantity > 0 &&
            p.status === "usable" &&
            p.expiresAt &&
            p.expiresAt >= date &&
            p.expiresAt <= addDays(date, 3),
        ),
      );
      const favorite = state.household.favorites.includes(recipe.id);
      const repeated = state.meals.filter(
        (m) =>
          m.recipe.id === recipe.id &&
          m.date >= addDays(date, -7) &&
          m.date <= date,
      ).length;
      return {
        recipe,
        ...coverage,
        usesExpiring,
        score:
          coverage.percent +
          (usesExpiring ? 15 : 0) +
          (favorite ? 10 : 0) -
          recipe.minutes / 10 -
          repeated * 8,
      };
    })
    .sort((a, b) => b.score - a.score);
}
export function forecast(
  state: Workspace,
  ingredientId: string,
  now = new Date(),
) {
  const today = localDate(state.household.timezone, now),
    cutoff = addDays(today, -28);
  const events = state.transactions.filter(
    (t) =>
      t.ingredientId === ingredientId &&
      t.kind === "consume" &&
      localDate(state.household.timezone, new Date(t.at)) >= cutoff &&
      !state.transactions.some((r) => r.reversesId === t.id),
  );
  let rate = state.household.defaultRates[ingredientId] || 0;
  let confidence: "low" | "medium" = "low";
  const sampleCount = new Set(events.map((t) => t.mealId || t.id)).size;
  if (sampleCount >= 3) {
    const earliest = events
      .map((t) => localDate(state.household.timezone, new Date(t.at)))
      .sort()[0];
    const days = Math.max(
      7,
      (new Date(today).getTime() - new Date(earliest).getTime()) / 86400000 + 1,
    );
    rate =
      events.reduce(
        (sum, t) => sum + baseQuantity(ingredientId, -t.delta, t.unit),
        0,
      ) / days;
    confidence = "medium";
  }
  const stock = usableStock(state, ingredientId, today);
  return {
    rate,
    confidence,
    samples: sampleCount,
    daysLeft: rate > 0 ? Math.floor(stock / rate) : null,
  };
}
export function shoppingNeeds(
  state: Workspace,
  now = new Date(),
  slot?: string,
): Need[] {
  const today = localDate(state.household.timezone, now),
    horizon =
      state.household.nextShoppingDate < today
        ? today
        : state.household.nextShoppingDate;
  const lots = state.pantry
    .filter((p) => p.status === "usable")
    .map((p) => ({
      ...p,
      remaining: baseQuantity(p.ingredientId, p.quantity, p.unit),
    }))
    .sort((a, b) =>
      (a.expiresAt || "9999").localeCompare(b.expiresAt || "9999"),
    );
  const missing = new Map<string, Need>(),
    plannedTotals = new Map<string, number>();
  const add = (
    ingredientId: string,
    q: number,
    reason: string,
    priority: "high" | "normal",
  ) => {
    if (q <= 1e-6) return;
    const old = missing.get(ingredientId);
    missing.set(ingredientId, {
      ingredientId,
      quantity: (old?.quantity || 0) + q,
      unit: ingredientMap.get(ingredientId)!.unit,
      reasons: [...new Set([...(old?.reasons || []), reason])],
      priority: old?.priority === "high" ? "high" : priority,
    });
  };
  const consume = (ingredientId: string, q: number, date: string) => {
    for (const lot of lots) {
      if (
        lot.ingredientId !== ingredientId ||
        (lot.expiresAt && lot.expiresAt < date)
      )
        continue;
      const take = Math.min(q, lot.remaining);
      q -= take;
      lot.remaining -= take;
      if (q <= 1e-6) break;
    }
    return q;
  };
  for (const meal of state.meals
    .filter(
      (m) =>
        m.status === "planned" &&
        m.date >= today &&
        m.date <= horizon &&
        (!slot || slot === "all" || m.slot === slot),
    )
    .sort((a, b) => a.date.localeCompare(b.date))) {
    for (const [id, q] of recipeRequirements(meal.recipe, meal.servings)) {
      plannedTotals.set(id, (plannedTotals.get(id) || 0) + q);
      add(
        id,
        consume(id, q, meal.date),
        meal.recipe.name,
        meal.date <= addDays(today, 1) ? "high" : "normal",
      );
    }
  }
  if (!slot || slot === "all") {
    const days = Math.max(
      1,
      (new Date(horizon).getTime() - new Date(today).getTime()) / 86400000,
    );
    for (const i of ingredients) {
      const estimate = forecast(state, i.id, now);
      const extra = Math.max(
        0,
        estimate.rate * days - (plannedTotals.get(i.id) || 0),
      );
      if (extra)
        add(
          i.id,
          consume(i.id, extra, horizon),
          "برآورد مصرف تا خرید بعدی",
          "normal",
        );
      const reserve = state.household.reserves[i.id] || 0;
      if (reserve)
        add(i.id, consume(i.id, reserve, horizon), "ذخیره دلخواه", "normal");
    }
  }
  return [...missing.values()].map((n) => ({
    ...n,
    quantity: Math.ceil(n.quantity * 100) / 100,
  }));
}
export function refreshShopping(state: Workspace, now = new Date()) {
  const generated = shoppingNeeds(state, now);
  const oldActive = state.shopping.filter((x) => !x.purchased);
  const retained = oldActive.filter((x) => x.manual || x.overridden);
  const retainedIds = new Set(retained.map((x) => x.ingredientId));
  state.shopping = [
    ...state.shopping.filter((x) => x.purchased),
    ...retained,
    ...generated
      .filter((n) => !retainedIds.has(n.ingredientId))
      .map((n) => ({
        ...n,
        id:
          oldActive.find((x) => x.ingredientId === n.ingredientId)?.id || uid(),
        manual: false,
        overridden: false,
        purchased: false,
      })),
  ];
}
function transaction(
  state: Workspace,
  t: Omit<Transaction, "id" | "at">,
  now: Date,
) {
  const entry = { ...t, id: uid(), at: now.toISOString() };
  state.transactions.push(entry);
  return entry.id;
}
export function applyAction(
  input: Workspace,
  raw: Action,
  recipes = initialRecipes,
  now = new Date(),
): Workspace {
  const action = actionSchema.parse(raw);
  const state = structuredClone(input),
    today = localDate(state.household.timezone, now);
  switch (action.type) {
    case "pantry.save": {
      baseQuantity(
        action.item.ingredientId,
        action.item.quantity,
        action.item.unit,
      );
      const index = state.pantry.findIndex((x) => x.id === action.item.id),
        old = state.pantry[index];
      if (
        old &&
        (old.ingredientId !== action.item.ingredientId ||
          old.unit !== action.item.unit)
      )
        throw new Error("برای تغییر ماده یا واحد، یک قلم تازه ثبت کنید");
      if (index < 0) state.pantry.push(action.item);
      else state.pantry[index] = action.item;
      const delta = action.item.quantity - (old?.quantity || 0);
      if (delta)
        transaction(
          state,
          {
            pantryItemId: action.item.id,
            ingredientId: action.item.ingredientId,
            delta,
            unit: action.item.unit,
            kind: old ? "adjust" : "purchase",
          },
          now,
        );
      break;
    }
    case "pantry.adjust": {
      const item = state.pantry.find((x) => x.id === action.id);
      if (!item) throw new Error("قلم موجودی پیدا نشد");
      const delta = action.quantity - item.quantity;
      item.quantity = action.quantity;
      if (delta)
        transaction(
          state,
          {
            pantryItemId: item.id,
            ingredientId: item.ingredientId,
            delta,
            unit: item.unit,
            kind: "adjust",
          },
          now,
        );
      break;
    }
    case "pantry.delete": {
      const item = state.pantry.find((x) => x.id === action.id);
      if (!item) throw new Error("قلم موجودی پیدا نشد");
      if (item.quantity)
        transaction(
          state,
          {
            pantryItemId: item.id,
            ingredientId: item.ingredientId,
            delta: -item.quantity,
            unit: item.unit,
            kind: "discard",
          },
          now,
        );
      item.quantity = 0;
      item.status = "spoiled";
      break;
    }
    case "household.save":
      state.household = householdSchema.parse(action.household);
      for (const id of [
        ...Object.keys(state.household.reserves),
        ...Object.keys(state.household.defaultRates),
        ...state.household.members.flatMap((m) => m.dislikes),
      ])
        if (!ingredientMap.has(id))
          throw new Error("ماده غذایی تنظیمات معتبر نیست");
      break;
    case "favorite.toggle":
      if (!recipes.some((r) => r.id === action.id))
        throw new Error("غذا پیدا نشد");
      state.household.favorites = state.household.favorites.includes(action.id)
        ? state.household.favorites.filter((x) => x !== action.id)
        : [...state.household.favorites, action.id];
      break;
    case "meal.add": {
      const recipe = recipes.find(
        (r) => r.id === action.recipeId && r.published,
      );
      if (!recipe) throw new Error("این غذا هنوز منتشر نشده است");
      if (blockedReasons(recipe, state).length)
        throw new Error("این غذا با محدودیت غذایی خانوار سازگار نیست");
      if (action.date < today)
        throw new Error("وعده جدید باید برای امروز یا آینده باشد");
      if (
        state.meals.some(
          (m) =>
            m.date === action.date &&
            m.slot === action.slot &&
            m.status === "cooked",
        )
      )
        throw new Error("وعده پخته‌شده را ابتدا برگردانید");
      state.meals = state.meals.filter(
        (m) => !(m.date === action.date && m.slot === action.slot),
      );
      state.meals.push({
        id: uid(),
        date: action.date,
        slot: action.slot,
        recipe: structuredClone(recipe),
        servings: action.servings,
        status: "planned",
        transactionIds: [],
      });
      break;
    }
    case "meal.delete": {
      const meal = state.meals.find((m) => m.id === action.id);
      if (meal?.status === "cooked")
        throw new Error("ابتدا ثبت پخت را برگردانید");
      state.meals = state.meals.filter((m) => m.id !== action.id);
      break;
    }
    case "meal.cook": {
      const meal = state.meals.find((m) => m.id === action.id);
      if (!meal) throw new Error("وعده پیدا نشد");
      if (meal.status === "cooked") break;
      if (blockedReasons(meal.recipe, state).length)
        throw new Error("محدودیت غذایی جدید با این وعده سازگار نیست");
      if (meal.date > today)
        throw new Error("پخت وعده آینده را در روز آن ثبت کنید");
      const quantities = recipeRequirements(meal.recipe, meal.servings);
      if (action.amounts)
        for (const [id, q] of Object.entries(action.amounts)) {
          if (!quantities.has(id))
            throw new Error("ماده مصرف خارج از دستور است");
          quantities.set(id, q);
        }
      for (const [id, q] of quantities) {
        if (usableStock(state, id, today) + 1e-6 < q)
          throw new Error(
            "موجودی " +
              ingredientMap.get(id)!.name +
              " کافی نیست؛ خرید یا مصرف واقعی را اصلاح کنید",
          );
      }
      for (const [id, quantity] of quantities) {
        let remaining = quantity;
        for (const p of state.pantry
          .filter(
            (p) =>
              p.ingredientId === id &&
              p.status === "usable" &&
              (!p.expiresAt || p.expiresAt >= today),
          )
          .sort((a, b) =>
            (a.expiresAt || "9999").localeCompare(b.expiresAt || "9999"),
          )) {
          const take = Math.min(
            remaining,
            baseQuantity(id, p.quantity, p.unit),
          );
          if (take <= 0) continue;
          const delta = -convert(take, ingredientMap.get(id)!.unit, p.unit);
          p.quantity = Math.max(0, p.quantity + delta);
          remaining -= take;
          meal.transactionIds.push(
            transaction(
              state,
              {
                pantryItemId: p.id,
                ingredientId: id,
                delta,
                unit: p.unit,
                kind: "consume",
                mealId: meal.id,
              },
              now,
            ),
          );
          if (remaining <= 1e-6) break;
        }
      }
      meal.status = "cooked";
      break;
    }
    case "meal.undo": {
      const meal = state.meals.find((m) => m.id === action.id);
      if (!meal) throw new Error("وعده پیدا نشد");
      if (meal.status !== "cooked") break;
      for (const id of meal.transactionIds) {
        const t = state.transactions.find((t) => t.id === id);
        if (!t || state.transactions.some((r) => r.reversesId === id)) continue;
        const lot = state.pantry.find((p) => p.id === t.pantryItemId);
        if (!lot) throw new Error("سری موجودی مصرف پیدا نشد");
        lot.quantity -= t.delta;
        transaction(
          state,
          {
            pantryItemId: lot.id,
            ingredientId: lot.ingredientId,
            delta: -t.delta,
            unit: lot.unit,
            kind: "reverse",
            mealId: meal.id,
            reversesId: id,
          },
          now,
        );
      }
      meal.status = "planned";
      meal.transactionIds = [];
      break;
    }
    case "shopping.generate":
      refreshShopping(state, now);
      break;
    case "shopping.save": {
      const q = baseQuantity(action.ingredientId, action.quantity, action.unit),
        item = state.shopping.find(
          (x) =>
            !x.purchased &&
            (action.id
              ? x.id === action.id
              : x.ingredientId === action.ingredientId),
        );
      if (action.id && !item) throw new Error("قلم خرید پیدا نشد");
      if (item) {
        if (item.ingredientId !== action.ingredientId)
          throw new Error("ماده قلم قابل تغییر نیست");
        item.quantity = q;
        item.unit = ingredientMap.get(action.ingredientId)!.unit;
        item.overridden = true;
      } else
        state.shopping.push({
          id: uid(),
          ingredientId: action.ingredientId,
          quantity: q,
          unit: ingredientMap.get(action.ingredientId)!.unit,
          reasons: ["افزوده‌شده توسط شما"],
          priority: "normal",
          manual: true,
          overridden: true,
          purchased: false,
        });
      break;
    }
    case "shopping.delete":
      state.shopping = state.shopping.filter((x) => x.id !== action.id);
      break;
    case "shopping.purchase": {
      const item = state.shopping.find((x) => x.id === action.id);
      if (!item) throw new Error("قلم خرید پیدا نشد");
      if (item.purchased) break;
      if (action.expiresAt && action.expiresAt < today)
        throw new Error("تاریخ انقضای خرید گذشته است");
      const lot = {
        id: uid(),
        ingredientId: item.ingredientId,
        quantity: action.quantity,
        unit: item.unit,
        purchasedAt: today,
        expiresAt: action.expiresAt,
        location: action.location,
        status: "usable" as const,
      };
      state.pantry.push(lot);
      transaction(
        state,
        {
          pantryItemId: lot.id,
          ingredientId: lot.ingredientId,
          delta: lot.quantity,
          unit: lot.unit,
          kind: "purchase",
        },
        now,
      );
      item.purchased = true;
      item.purchasedAt = now.toISOString();
      break;
    }
    case "reminder.save": {
      const index = state.reminders.findIndex(
        (r) => r.id === action.reminder.id,
      );
      if (index < 0) state.reminders.push(action.reminder);
      else state.reminders[index] = action.reminder;
      break;
    }
    case "reminder.delete":
      state.reminders = state.reminders.filter((r) => r.id !== action.id);
      break;
    case "notice.read":
      state.notices = state.notices.map((n) =>
        n.id === action.id ? { ...n, read: true } : n,
      );
      break;
    case "reminders.check": {
      const time = new Intl.DateTimeFormat("en-GB", {
          timeZone: state.household.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(now),
        day = new Date(today + "T12:00:00Z").getUTCDay();
      for (const r of state.reminders.filter(
        (r) => r.enabled && r.days.includes(day) && r.time <= time,
      )) {
        const key = r.id + ":" + today + ":" + r.time;
        if (state.notices.some((n) => n.key === key)) continue;
        const needs = shoppingNeeds(state, now, r.slot);
        if (!needs.length) continue;
        state.notices.push({
          id: uid(),
          key,
          title: "یادآوری خرید آشپزخانه",
          body:
            needs
              .slice(0, 3)
              .map((n) => ingredientMap.get(n.ingredientId)!.name)
              .join("، ") +
            " در فهرست نیازهای شماست. پیش از برگشت به خانه خرید را بررسی کنید.",
          at: now.toISOString(),
          read: false,
        });
      }
      break;
    }
  }
  return workspaceSchema.parse(state) as Workspace;
}
