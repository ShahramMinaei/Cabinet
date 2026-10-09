"use client";
import { useState, type FormEvent } from "react";
import {
  Clock,
  Heart,
  Users,
  Check,
  Plus,
  ShoppingBasket,
  ExternalLink,
  Leaf,
} from "lucide-react";
import { Modal, Button, Field } from "@/components/ui";
import { FoodArt } from "@/components/food-art";
import { useWorkspace } from "@/features/workspace/provider";
import {
  ingredientMap,
  recipeCoverage,
  recipeRequirements,
  usableStock,
  blockedReasons,
} from "@/domain/engine";
import type { Recipe } from "@/domain/types";
import { localDate, number, unitLabel, addDays, faDate } from "@/lib/dates";
export function RecipeCard({
  recipe,
  onOpen,
}: {
  recipe: Recipe;
  onOpen: (r: Recipe) => void;
}) {
  const { state, act, busy } = useWorkspace();
  if (!state) return null;
  const coverage = recipeCoverage(recipe, state);
  const favorite = state.household.favorites.includes(recipe.id);
  return (
    <article className="recipe-card">
      <div className="recipe-image">
        <button
          className="recipe-image-button"
          onClick={() => onOpen(recipe)}
          aria-label={`جزئیات ${recipe.name}`}
        >
          {recipe.imageUrl ? (
            <img src={recipe.imageUrl} alt={recipe.name} loading="lazy" />
          ) : (
            <FoodArt kind={recipe.art} />
          )}
        </button>
        <button
          className={`favorite-button ${favorite ? "selected" : ""}`}
          aria-label={`${favorite ? "حذف از" : "افزودن به"} علاقه‌مندی‌ها: ${recipe.name}`}
          onClick={() => void act({ type: "favorite.toggle", id: recipe.id })}
          disabled={busy}
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
        <span className="image-badge">
          {coverage.percent === 100 ? (
            <>
              <Check size={13} />
              همه مواد موجود است
            </>
          ) : (
            `${number(coverage.percent)}٪ مواد موجود`
          )}
        </span>
      </div>
      <div className="recipe-card-body">
        <button className="recipe-title" onClick={() => onOpen(recipe)}>
          {recipe.name}
        </button>
        <p>{recipe.description}</p>
        <div className="recipe-meta">
          <span>
            <Clock size={14} />
            {number(recipe.minutes)} دقیقه
          </span>
          <span>
            <Users size={14} />
            {number(recipe.servings)} نفر
          </span>
          <span>{recipe.difficulty}</span>
        </div>
        <div className="recipe-card-footer">
          <span className={coverage.missing.length ? "muted" : "green-text"}>
            {coverage.missing.length
              ? `${number(coverage.missing.length)} ماده نیاز به خرید دارد`
              : "آماده برای پخت"}
          </span>
          <button
            className="round-add"
            onClick={() => onOpen(recipe)}
            aria-label={`انتخاب ${recipe.name}`}
          >
            <Plus size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
export function MealPicker({
  recipe,
  open,
  onOpenChange,
  initialDate,
  initialSlot = "dinner",
}: {
  recipe: Recipe | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialDate?: string;
  initialSlot?: "breakfast" | "lunch" | "dinner";
}) {
  const { state, act, busy, setMessage } = useWorkspace();
  const [repeat, setRepeat] = useState<string[]>([]);
  if (!state || !recipe) return null;
  const today = localDate(state.household.timezone),
    blocked = blockedReasons(recipe, state);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const date = String(form.get("date")),
      slot = String(form.get("slot")) as "dinner",
      servings = Number(form.get("servings"));
    const dates = [...new Set([date, ...repeat])];
    for (const date of dates) {
      if (
        !(await act({
          type: "meal.add",
          recipeId: recipe!.id,
          date,
          slot,
          servings,
        }))
      )
        return;
    }
    setMessage("غذا به برنامه اضافه شد");
    setRepeat([]);
    onOpenChange(false);
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`برنامه‌ریزی ${recipe.name}`}
      description="تعداد نفرات و روز پخت را انتخاب کنید."
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="روز پخت">
            <input
              name="date"
              type="date"
              defaultValue={initialDate || today}
              min={today}
              required
            />
          </Field>
          <Field label="وعده">
            <select name="slot" defaultValue={initialSlot}>
              <option value="breakfast">صبحانه</option>
              <option value="lunch">ناهار</option>
              <option value="dinner">شام</option>
            </select>
          </Field>
          <Field label="تعداد نفرات">
            <input
              name="servings"
              type="number"
              defaultValue={state.household.members.length}
              min={1}
              max={100}
              required
            />
          </Field>
        </div>
        <p className="field-label">تکرار در روزهای دیگر این هفته</p>
        <div className="repeat-days">
          {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map(
            (date) => (
              <label key={date}>
                <input
                  type="checkbox"
                  checked={repeat.includes(date)}
                  onChange={(e) =>
                    setRepeat(
                      e.target.checked
                        ? [...repeat, date]
                        : repeat.filter((x) => x !== date),
                    )
                  }
                />
                {faDate(date, {
                  weekday: "short",
                  day: "numeric",
                  month: undefined,
                  year: undefined,
                })}
              </label>
            ),
          )}
        </div>
        {blocked.length > 0 && (
          <p className="inline-warning">
            ناسازگار با محدودیت خانوار: {blocked.join("، ")}
          </p>
        )}
        <div className="modal-actions">
          <Button
            type="submit"
            disabled={busy || blocked.length > 0 || !recipe.published}
          >
            <Plus size={16} />
            افزودن به برنامه
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function RecipeDetail({
  recipe,
  onClose,
}: {
  recipe: Recipe | null;
  onClose: () => void;
}) {
  const { state, act, busy, setMessage } = useWorkspace();
  const [servings, setServings] = useState(0),
    [planning, setPlanning] = useState(false);
  if (!state || !recipe) return null;
  const count = servings || state.household.members.length,
    date = localDate(state.household.timezone),
    required = recipeRequirements(recipe, count),
    blocked = blockedReasons(recipe, state);
  const coverage = recipeCoverage(recipe, state, count, date);
  return (
    <>
      <Modal
        open={Boolean(recipe) && !planning}
        onOpenChange={(v) => {
          if (!v) onClose();
        }}
        title={recipe.name}
        description={recipe.description}
      >
        <div className="detail-cover">
          {recipe.imageUrl ? (
            <img src={recipe.imageUrl} alt={recipe.name} />
          ) : (
            <FoodArt kind={recipe.art} />
          )}
        </div>
        <div className="detail-summary">
          <span>
            <Clock size={16} />
            {number(recipe.minutes)} دقیقه، تقریبی
          </span>
          <span>{recipe.difficulty}</span>
          <Field label="تعداد نفرات">
            <input
              aria-label="نفرات دستور"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) =>
                setServings(Math.max(1, Math.min(100, Number(e.target.value))))
              }
            />
          </Field>
        </div>
        <div className="source-note">{recipe.note}</div>
        {blocked.length > 0 && (
          <div className="inline-warning">
            این غذا با محدودیت خانوار سازگار نیست: {blocked.join("، ")}
          </div>
        )}
        <h3 className="detail-section-title">
          مواد اولیه <span className="muted">برای {number(count)} نفر</span>
        </h3>
        <div className="ingredient-lines">
          {[...required].map(([id, q]) => {
            const item = ingredientMap.get(id)!,
              stock = usableStock(state, id, date),
              estimated = recipe.ingredients.some(
                (i) => i.ingredientId === id && i.estimated,
              );
            return (
              <div key={id}>
                <span className="ingredient-name">
                  <span>{item.emoji}</span>
                  {item.name}
                  {estimated && <small>تخمینی</small>}
                </span>
                <span>
                  {number(q)} {unitLabel[item.unit]}
                </span>
                <span className={stock >= q ? "stock-ok" : "stock-missing"}>
                  {stock >= q ? (
                    <>
                      <Check size={13} />
                      موجود
                    </>
                  ) : (
                    `${number(q - stock)} ${unitLabel[item.unit]} کمبود`
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <h3 className="detail-section-title">مراحل تهیه</h3>
        <ol className="steps">
          {recipe.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <a
          className="source-link"
          href={recipe.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          مشاهده دستور منبع در کتاب کاله
          <ExternalLink size={14} />
        </a>
        <div className="modal-actions">
          <Button
            onClick={() => setPlanning(true)}
            disabled={busy || blocked.length > 0 || !recipe.published}
          >
            <Plus size={16} />
            افزودن به برنامه
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (await act({ type: "shopping.generate" }))
                setMessage("فهرست خرید از وعده‌های ثبت‌شده ساخته شد");
            }}
          >
            <ShoppingBasket size={16} />
            به‌روزرسانی خرید
          </Button>
        </div>
        <small className="muted">
          برای اضافه شدن مواد این غذا به خرید، ابتدا آن را در برنامه ثبت کنید.
        </small>
        {coverage.percent === 100 && (
          <p className="green-text">
            <Leaf size={14} /> مواد موردنیاز این غذا را در خانه دارید.
          </p>
        )}
      </Modal>
      <MealPicker
        recipe={recipe}
        open={planning}
        onOpenChange={(v) => {
          setPlanning(v);
          if (!v) onClose();
        }}
      />
    </>
  );
}
