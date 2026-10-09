"use client";
import { useState, type FormEvent } from "react";
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  UtensilsCrossed,
  Check,
  Trash2,
  RotateCcw,
  ShoppingBasket,
} from "lucide-react";
import Link from "@/components/app-link";
import { PageHeading, Button, Modal, Field } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/provider";
import { recommend, recipeRequirements, ingredientMap } from "@/domain/engine";
import { localDate, addDays, faDate, number, unitLabel } from "@/lib/dates";
import type { Meal, Recipe } from "@/domain/types";
import { MealPicker, RecipeDetail } from "@/features/recipes/recipe-components";
const slots = { breakfast: "صبحانه", lunch: "ناهار", dinner: "شام" };
export function PlanPage() {
  const { state, recipes, act, busy, setMessage } = useWorkspace();
  const [offset, setOffset] = useState(0),
    [pick, setPick] = useState<{
      date: string;
      slot: "breakfast" | "lunch" | "dinner";
    } | null>(null),
    [recipe, setRecipe] = useState<Recipe | null>(null),
    [detail, setDetail] = useState<Recipe | null>(null),
    [cook, setCook] = useState<Meal | null>(null);
  if (!state) return null;
  const today = localDate(state.household.timezone),
    start = addDays(today, offset),
    dates = Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    choices = recommend(recipes, state);
  async function consume(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cook) return;
    const form = new FormData(e.currentTarget),
      amounts: Record<string, number> = {};
    for (const [id] of recipeRequirements(cook.recipe, cook.servings))
      amounts[id] = Number(form.get(id));
    if (await act({ type: "meal.cook", id: cook.id, amounts })) {
      setCook(null);
      setMessage("پخت و مصرف مواد ثبت شد");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="کمی برنامه، کلی آسودگی"
        title="برنامه غذایی"
        description="وعده‌ها را انتخاب کنید؛ محاسبه مواد لازم با کابینت."
        action={
          <Link href="/shopping" className="button secondary">
            <ShoppingBasket size={17} />
            خرید برای برنامه
          </Link>
        }
      />
      <div className="panel week-toolbar">
        <Button
          variant="ghost"
          onClick={() => setOffset(offset - 7)}
          aria-label="هفته قبل"
        >
          <ChevronRight size={18} />
        </Button>
        <b>
          {faDate(start, { day: "numeric", month: "long", year: undefined })} تا{" "}
          {faDate(dates[6], { day: "numeric", month: "long", year: undefined })}
        </b>
        <Button
          variant="ghost"
          onClick={() => setOffset(offset + 7)}
          aria-label="هفته بعد"
        >
          <ChevronLeft size={18} />
        </Button>
        <Button variant="secondary" onClick={() => setOffset(0)}>
          این هفته
        </Button>
      </div>
      <div className="week-grid">
        {dates.map((date) => (
          <section
            className={`day-column ${date === today ? "today" : ""}`}
            key={date}
          >
            <div className="day-heading">
              <span>
                {faDate(date, {
                  weekday: "long",
                  day: undefined,
                  month: undefined,
                  year: undefined,
                })}
              </span>
              <b>
                {faDate(date, {
                  day: "numeric",
                  month: "short",
                  year: undefined,
                })}
              </b>
              {date === today && <small>امروز</small>}
            </div>
            {Object.entries(slots).map(([slot, label]) => {
              const meal = state.meals.find(
                (m) => m.date === date && m.slot === slot,
              );
              return (
                <div className="meal-slot" key={slot}>
                  <span className="slot-label">{label}</span>
                  {meal ? (
                    <article
                      className={`meal-tile ${meal.status === "cooked" ? "cooked" : ""}`}
                    >
                      <button
                        className="meal-name"
                        onClick={() => setDetail(meal.recipe)}
                      >
                        {meal.recipe.name}
                      </button>
                      <small>
                        {number(meal.servings)} نفر ·{" "}
                        {number(meal.recipe.minutes)} دقیقه
                      </small>
                      {meal.status === "cooked" ? (
                        <>
                          <span className="green-text">
                            <Check size={13} />
                            پخته شد
                          </span>
                          <button
                            disabled={busy}
                            className="meal-tool"
                            onClick={async () => {
                              if (await act({ type: "meal.undo", id: meal.id }))
                                setMessage(
                                  "مصرف برگشت داده شد؛ می‌توانید مقدار را اصلاح و دوباره ثبت کنید",
                                );
                            }}
                          >
                            <RotateCcw size={13} />
                            برگشت مصرف
                          </button>
                        </>
                      ) : (
                        <div className="meal-tile-actions">
                          <button
                            disabled={busy || date > today}
                            className="meal-tool"
                            onClick={() => setCook(meal)}
                          >
                            <Check size={13} />
                            ثبت پخت
                          </button>
                          <button
                            aria-label={`حذف ${meal.recipe.name} از برنامه`}
                            disabled={busy}
                            className="icon-button"
                            onClick={() =>
                              void act({ type: "meal.delete", id: meal.id })
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </article>
                  ) : (
                    <button
                      className="add-meal"
                      disabled={date < today}
                      onClick={() => {
                        setRecipe(null);
                        setPick({ date, slot: slot as "dinner" });
                      }}
                    >
                      <Plus size={18} />
                      <span>انتخاب غذا</span>
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <div className="plan-help">
        <UtensilsCrossed size={21} />
        <p>
          ثبت پخت، موجودی را با مقدار مصرف واقعی کاهش می‌دهد. برای اصلاح، «برگشت
          مصرف» را بزنید و دوباره مقدار درست را ثبت کنید.
        </p>
      </div>
      <Modal
        open={Boolean(pick) && !recipe}
        onOpenChange={(v) => {
          if (!v) setPick(null);
        }}
        title="انتخاب غذا برای برنامه"
        description="غذاهای سازگار با محدودیت‌های خانوار شما"
      >
        <div className="recipe-picker-list">
          {choices.map((c) => (
            <button key={c.recipe.id} onClick={() => setRecipe(c.recipe)}>
              <span>
                {c.recipe.name}
                <small>
                  {number(c.recipe.minutes)} دقیقه · {number(c.percent)}٪ مواد
                  موجود
                </small>
              </span>
              <Plus size={18} />
            </button>
          ))}
          {!choices.length && (
            <p>غذای سازگاری پیدا نشد. تنظیمات غذایی را بررسی کنید.</p>
          )}
        </div>
      </Modal>
      <MealPicker
        key={pick?.date + ":" + pick?.slot + ":" + recipe?.id}
        open={Boolean(pick && recipe)}
        onOpenChange={(v) => {
          if (!v) {
            setPick(null);
            setRecipe(null);
          }
        }}
        recipe={recipe}
        initialDate={pick?.date}
        initialSlot={pick?.slot}
      />
      <RecipeDetail
        key={detail?.id}
        recipe={detail}
        onClose={() => setDetail(null)}
      />
      <Modal
        open={Boolean(cook)}
        onOpenChange={(v) => {
          if (!v) setCook(null);
        }}
        title="ثبت مقدار مصرف واقعی"
        description={
          cook
            ? `${cook.recipe.name} · مقدار هر ماده را پیش از ثبت بررسی کنید.`
            : undefined
        }
      >
        <form onSubmit={consume}>
          <div className="consumption-fields">
            {cook &&
              [...recipeRequirements(cook.recipe, cook.servings)].map(
                ([id, q]) => (
                  <Field
                    key={id}
                    label={`${ingredientMap.get(id)!.name} (${unitLabel[ingredientMap.get(id)!.unit]})`}
                  >
                    <input
                      name={id}
                      aria-label={`مصرف ${ingredientMap.get(id)!.name}`}
                      type="number"
                      min="0"
                      step="any"
                      max="100000000"
                      defaultValue={Number(q.toFixed(2))}
                      required
                    />
                  </Field>
                ),
              )}
          </div>
          <div className="modal-actions">
            <Button disabled={busy} type="submit">
              ثبت پخت و کاهش موجودی
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCook(null)}
            >
              انصراف
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
