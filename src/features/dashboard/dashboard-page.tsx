"use client";
import { useState } from "react";
import Link from "@/components/app-link";
import {
  ArrowLeft,
  Plus,
  Package,
  ShoppingBasket,
  CalendarDays,
  Leaf,
  Clock,
  Users,
  Check,
  ChevronLeft,
  AlertCircle,
  Bell,
  Sparkles,
} from "lucide-react";
import { PageHeading, Button, SectionHeading, Empty } from "@/components/ui";
import { FoodArt } from "@/components/food-art";
import { useWorkspace } from "@/features/workspace/provider";
import {
  ingredientMap,
  recommend,
  shoppingNeeds,
  usableStock,
} from "@/domain/engine";
import {
  RecipeCard,
  RecipeDetail,
  MealPicker,
} from "@/features/recipes/recipe-components";
import type { Recipe } from "@/domain/types";
import { localDate, addDays, number, unitLabel, faDate } from "@/lib/dates";
export function DashboardPage() {
  const { state, recipes, act, busy, setMessage } = useWorkspace();
  const [detail, setDetail] = useState<Recipe | null>(null),
    [planning, setPlanning] = useState(false);
  if (!state) return null;
  const today = localDate(state.household.timezone),
    ranked = recommend(recipes, state, today),
    meal = state.meals.find((m) => m.date === today && m.slot === "dinner"),
    featured = meal?.recipe || ranked[0]?.recipe,
    needs = shoppingNeeds(state),
    near = state.pantry.filter(
      (p) =>
        p.quantity > 0 &&
        p.status === "usable" &&
        p.expiresAt &&
        p.expiresAt >= today &&
        p.expiresAt <= addDays(today, 3),
    ),
    low = Object.entries(state.household.reserves).filter(
      ([id, q]) => usableStock(state, id, today) < q,
    ),
    pantryCount = new Set(
      state.pantry
        .filter(
          (p) =>
            p.quantity > 0 &&
            p.status === "usable" &&
            (!p.expiresAt || p.expiresAt >= today),
        )
        .map((p) => p.ingredientId),
    ).size,
    planned = state.meals.filter(
      (m) => m.date >= today && m.date <= addDays(today, 6),
    ),
    reminder = state.reminders
      .filter((r) => r.enabled)
      .sort((a, b) => a.time.localeCompare(b.time))[0];
  return (
    <>
      <PageHeading
        eyebrow={faDate(today, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: undefined,
        })}
        title={`سلام ${state.household.members[0].name}، خوش آمدی 🌿`}
        description="یک نگاه به آشپزخانه، یک قدم تا خیال راحت."
        action={
          <Link href="/pantry" className="button secondary">
            <Plus size={17} />
            افزودن موجودی
          </Link>
        }
      />
      <div className="stats-grid">
        <div className="panel stat">
          <span className="stat-icon mint">
            <Package size={21} />
          </span>
          <div>
            <span>مواد موجود در خانه</span>
            <b>
              {number(pantryCount)}
              <small> قلم</small>
            </b>
          </div>
          <Link href="/pantry" aria-label="دیدن موجودی">
            <ChevronLeft size={17} />
          </Link>
        </div>
        <div className="panel stat">
          <span className="stat-icon sand">
            <ShoppingBasket size={21} />
          </span>
          <div>
            <span>نیاز به خرید</span>
            <b>
              {number(needs.length)}
              <small> قلم</small>
            </b>
          </div>
          <Link href="/shopping" aria-label="دیدن خرید">
            <ChevronLeft size={17} />
          </Link>
        </div>
        <div className="panel stat">
          <span className="stat-icon lilac">
            <CalendarDays size={21} />
          </span>
          <div>
            <span>وعده‌های این هفته</span>
            <b>
              {number(planned.length)}
              <small> وعده</small>
            </b>
          </div>
          <Link href="/plan" aria-label="دیدن برنامه">
            <ChevronLeft size={17} />
          </Link>
        </div>
        <div className="panel stat">
          <span className="stat-icon peach">
            <Leaf size={21} />
          </span>
          <div>
            <span>بهتر است زودتر مصرف شود</span>
            <b>
              {number(near.length)}
              <small> قلم</small>
            </b>
          </div>
          <Link href="/pantry" aria-label="مواد نزدیک انقضا">
            <ChevronLeft size={17} />
          </Link>
        </div>
      </div>
      <div className="dashboard-main-grid">
        <section className="hero-meal">
          <div className="hero-copy">
            <span className="badge hero-badge">
              <Sparkles size={14} />
              {meal ? "شام در برنامه امروز" : "پیشنهاد برای شام امشب"}
            </span>
            <h2>{featured?.name || "شام امشب را انتخاب کن"}</h2>
            <p>
              {featured?.description ||
                "از میان غذاهای سازگار با سلیقه خانوار انتخاب کنید."}
            </p>
            {featured && (
              <>
                <div className="hero-meta">
                  <span>
                    <Clock size={16} />
                    {number(featured.minutes)} دقیقه، تقریبی
                  </span>
                  <span>
                    <Users size={16} />
                    {number(
                      meal?.servings || state.household.members.length,
                    )}{" "}
                    نفر
                  </span>
                </div>
                <div className="hero-buttons">
                  <Button onClick={() => setDetail(featured)}>
                    دیدن دستور و مواد
                    <ArrowLeft size={17} />
                  </Button>
                  {!meal && (
                    <Button variant="ghost" onClick={() => setPlanning(true)}>
                      <Plus size={16} />
                      انتخاب برای شام
                    </Button>
                  )}
                  {meal && (
                    <Link href="/plan" className="text-link">
                      دیدن برنامه
                      <ArrowLeft size={15} />
                    </Link>
                  )}
                </div>
              </>
            )}
            <div className="hero-footnote">
              <Leaf size={15} />
              پیشنهاد بر اساس مواد و ترجیحات آشپزخانه شما
            </div>
          </div>
          <div className="hero-art">
            {featured?.imageUrl ? (
              <img src={featured.imageUrl} alt={featured.name} />
            ) : (
              <FoodArt kind={featured?.art || "برنج"} />
            )}
            <span className="art-label">
              {featured?.imageUrl ? "تصویر غذا" : "تصویرسازی غذا"}
            </span>
          </div>
        </section>
        <section className="panel shopping-preview">
          <SectionHeading
            title="برای خرید بعدی"
            action={
              <Link className="text-link" href="/shopping">
                همه موارد
                <ArrowLeft size={14} />
              </Link>
            }
          />
          {needs.length ? (
            <div className="shopping-preview-list">
              {needs.slice(0, 4).map((n) => {
                const i = ingredientMap.get(n.ingredientId)!;
                return (
                  <div key={n.ingredientId}>
                    <span className="tiny-emoji">{i.emoji}</span>
                    <div>
                      <b>{i.name}</b>
                      <small>{n.reasons.slice(0, 1).join("، ")}</small>
                    </div>
                    <span>
                      {number(n.quantity)}
                      <small>{unitLabel[n.unit]}</small>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="small-empty">
              <Check size={25} />
              <b>فعلاً چیزی کم نیست</b>
              <p>با ثبت وعده‌ها، نیاز خرید محاسبه می‌شود.</p>
            </div>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (await act({ type: "shopping.generate" }))
                setMessage("فهرست خرید به‌روز شد");
            }}
          >
            <ShoppingBasket size={16} />
            به‌روزرسانی فهرست خرید
          </Button>
        </section>
      </div>
      <div className="dashboard-secondary-grid">
        <section>
          <SectionHeading
            title="با مواد خانه، این‌ها را هم بپز"
            action={
              <Link className="text-link" href="/recipes">
                همه پیشنهادها
                <ArrowLeft size={15} />
              </Link>
            }
          />
          {ranked.length ? (
            <div className="dashboard-recipes">
              {ranked.slice(0, 3).map((r) => (
                <RecipeCard
                  key={r.recipe.id}
                  recipe={r.recipe}
                  onOpen={setDetail}
                />
              ))}
            </div>
          ) : (
            <Empty
              title="پیشنهاد سازگاری نداریم"
              description="ترجیحات و محدودیت‌های خانوار را در تنظیمات بررسی کنید."
            />
          )}
        </section>
        <section className="kitchen-notes">
          <SectionHeading title="حواسمان به آشپزخانه هست" />
          <div className="panel expiry-panel">
            <div className="note-title">
              <span className="stat-icon sand">
                <Clock size={19} />
              </span>
              <div>
                <h3>این‌ها را زودتر مصرف کن</h3>
                <p>مواد نزدیک به تاریخ انقضا</p>
              </div>
            </div>
            {near.length ? (
              <div className="expiry-list">
                {near.slice(0, 3).map((p) => (
                  <div key={p.id}>
                    <span>
                      {ingredientMap.get(p.ingredientId)!.emoji}{" "}
                      {ingredientMap.get(p.ingredientId)!.name}
                    </span>
                    <span className="badge amber">
                      {p.expiresAt === today
                        ? "امروز"
                        : `${number(Math.round((new Date(p.expiresAt!).getTime() - new Date(today).getTime()) / 86400000))} روز دیگر`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">ماده‌ای نزدیک انقضا ثبت نشده است.</p>
            )}
            <Link href="/pantry" className="text-link">
              بررسی موجودی
              <ArrowLeft size={14} />
            </Link>
          </div>
          <div className="reminder-panel">
            <span className="reminder-icon">
              <Bell size={22} />
            </span>
            <div>
              <span>یادآوری‌های خرید</span>
              <h3>
                {reminder
                  ? `ساعت ${reminder.time.replace(/\d/g, (d) => number(Number(d)))}`
                  : "یادآوری را فعال کن"}
              </h3>
              <p>
                {reminder
                  ? "در روزهای انتخابی، نیازهای خرید بررسی می‌شود."
                  : "پیش از برگشت به خانه، خریدت را به خاطر بیاور."}
              </p>
              <Link href="/settings" className="text-link">
                تنظیم یادآوری
                <ArrowLeft size={14} />
              </Link>
            </div>
          </div>
          {low.length > 0 && (
            <div className="low-stock-note">
              <AlertCircle size={18} />
              <span>{number(low.length)} ماده کمتر از ذخیره دلخواه است.</span>
            </div>
          )}
        </section>
      </div>
      <RecipeDetail
        key={detail?.id}
        recipe={detail}
        onClose={() => setDetail(null)}
      />
      <MealPicker
        open={planning}
        onOpenChange={setPlanning}
        recipe={featured || null}
      />
    </>
  );
}
