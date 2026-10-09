"use client";
import { useState, useEffect } from "react";
import { Search, UtensilsCrossed, Leaf } from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import { PageHeading, Empty } from "@/components/ui";
import { recommend } from "@/domain/engine";
import type { Recipe } from "@/domain/types";
import { RecipeCard, RecipeDetail } from "./recipe-components";
import { number } from "@/lib/dates";
export function RecipesPage() {
  const { state, recipes } = useWorkspace();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [detail, setDetail] = useState<Recipe | null>(null),
    [maxMinutes, setMaxMinutes] = useState(180);
  useEffect(() => {
    setSearch(new URLSearchParams(window.location.search).get("q") || "");
  }, []);
  if (!state) return null;
  const ranked = recommend(recipes, state);
  const visible = ranked.filter(
    (r) =>
      r.recipe.name.includes(search) &&
      r.recipe.minutes <= maxMinutes &&
      (filter === "all" ||
        (filter === "ready" && r.percent === 100) ||
        (filter === "favorites" &&
          state.household.favorites.includes(r.recipe.id)) ||
        (filter === "expiring" && r.usesExpiring)),
  );
  return (
    <>
      <PageHeading
        eyebrow="از مواد همین آشپزخانه"
        title="امروز چی بپزیم؟"
        description="پیشنهادهایی متناسب با موجودی، سلیقه و وقت شما."
      />
      <div className="panel recipe-search">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label="جستجوی غذا"
            placeholder="مثلاً کوکو، پاستا یا عدسی…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="زمان آماده‌سازی"
          value={maxMinutes}
          onChange={(e) => setMaxMinutes(Number(e.target.value))}
        >
          <option value={180}>همه زمان‌ها</option>
          <option value={30}>تا ۳۰ دقیقه</option>
          <option value={60}>تا ۶۰ دقیقه</option>
          <option value={90}>تا ۹۰ دقیقه</option>
        </select>
      </div>
      <div className="filter-tabs">
        {[
          ["all", "پیشنهادهای شما"],
          ["ready", "بدون نیاز به خرید"],
          ["expiring", "استفاده از مواد نزدیک انقضا"],
          ["favorites", "علاقه‌مندی‌ها"],
        ].map(([id, title]) => (
          <button
            key={id}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {title}
          </button>
        ))}
      </div>
      <div className="results-label">
        <span>{number(visible.length)} پیشنهاد برای آشپزخانه شما</span>
        <span>
          <Leaf size={14} />
          محدودیت‌های غذایی اعمال شده‌اند
        </span>
      </div>
      {visible.length ? (
        <div className="recipes-grid">
          {visible.map((r) => (
            <RecipeCard
              key={r.recipe.id}
              recipe={r.recipe}
              onOpen={setDetail}
            />
          ))}
        </div>
      ) : (
        <Empty
          icon={<UtensilsCrossed size={30} />}
          title="پیشنهاد سازگاری پیدا نشد"
          description="فیلتر زمان یا نام غذا را تغییر دهید. محدودیت‌های غذایی در تنظیمات قابل بررسی هستند."
        />
      )}
      <p className="page-note">
        پیشنهادها با امتیازدهی موجودی، زمان، علاقه‌مندی، تنوع و تاریخ انقضا مرتب
        می‌شوند. زمان‌ها و مقدارهای تخمینی در جزئیات مشخص هستند.
      </p>
      <RecipeDetail
        key={detail?.id}
        recipe={detail}
        onClose={() => setDetail(null)}
      />
    </>
  );
}
