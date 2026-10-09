export type Unit = "g" | "kg" | "ml" | "l" | "count" | "pack";
export type Ingredient = {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  unit: Unit;
  allergens: string[];
  emoji: string;
  pricePerUnit?: number;
};
export type RecipeIngredient = {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  optional?: boolean;
  estimated?: boolean;
};
export type Recipe = {
  id: string;
  version: number;
  name: string;
  description: string;
  servings: number;
  minutes: number;
  difficulty: string;
  category: string;
  ingredients: RecipeIngredient[];
  steps: string[];
  sourceUrl: string;
  sourceStatus: "reviewed" | "unavailable";
  note: string;
  published: boolean;
  imageUrl?: string;
  art: string;
};
export type PantryItem = {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
  purchasedAt?: string;
  expiresAt?: string;
  location: "fridge" | "freezer" | "cabinet";
  status: "usable" | "spoiled";
};
export type Meal = {
  id: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner";
  recipe: Recipe;
  servings: number;
  status: "planned" | "cooked";
  transactionIds: string[];
};
export type ShoppingItem = {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
  reasons: string[];
  priority: "high" | "normal";
  manual: boolean;
  overridden: boolean;
  purchased: boolean;
  purchasedAt?: string;
};
export type Transaction = {
  id: string;
  pantryItemId: string;
  ingredientId: string;
  delta: number;
  unit: Unit;
  kind: "purchase" | "consume" | "adjust" | "reverse" | "discard";
  at: string;
  mealId?: string;
  reversesId?: string;
};
export type Reminder = {
  id: string;
  time: string;
  days: number[];
  enabled: boolean;
  slot: "all" | "breakfast" | "lunch" | "dinner";
};
export type Notice = {
  id: string;
  key: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
};
export type Household = {
  name: string;
  members: {
    id: string;
    name: string;
    allergens: string[];
    dislikes: string[];
  }[];
  budget: number;
  timezone: string;
  cookingDays: number;
  mealsPerDay: number;
  nextShoppingDate: string;
  favorites: string[];
  reserves: Record<string, number>;
  defaultRates: Record<string, number>;
};
export type Workspace = {
  schemaVersion: 1;
  revision: number;
  household: Household;
  pantry: PantryItem[];
  meals: Meal[];
  shopping: ShoppingItem[];
  transactions: Transaction[];
  reminders: Reminder[];
  notices: Notice[];
  operationIds: string[];
};
export type Need = {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  reasons: string[];
  priority: "high" | "normal";
};
