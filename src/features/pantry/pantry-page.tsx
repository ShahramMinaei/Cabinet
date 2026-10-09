"use client";
import { useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  Package,
  SlidersHorizontal,
  Minus,
  Pencil,
  Trash2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button, Modal, Field, PageHeading, Empty } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/provider";
import { ingredients, ingredientMap, uid, usableStock } from "@/domain/engine";
import type { PantryItem } from "@/domain/types";
import { localDate, addDays, faDate, number, unitLabel } from "@/lib/dates";
const locations = { fridge: "یخچال", freezer: "فریزر", cabinet: "کابینت" };
export function PantryPage() {
  const { state, act, busy, setMessage } = useWorkspace();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [category, setCategory] = useState("همه دسته‌ها"),
    [edit, setEdit] = useState<PantryItem | null>(null),
    [open, setOpen] = useState(false),
    [selectedIngredient, setSelectedIngredient] = useState("potato"),
    [deleting, setDeleting] = useState<PantryItem | null>(null);
  if (!state) return null;
  const today = localDate(state.household.timezone),
    visible = state.pantry
      .filter((p) => p.status !== "spoiled" && p.quantity > 0)
      .filter((p) => {
        const i = ingredientMap.get(p.ingredientId)!;
        return (
          i.name.includes(search) &&
          (category === "همه دسته‌ها" || i.category === category) &&
          (filter === "all" ||
            filter === p.location ||
            (filter === "expiring" &&
              p.expiresAt &&
              p.expiresAt <= addDays(today, 3)) ||
            (filter === "low" &&
              usableStock(state, p.ingredientId, today) <
                (state.household.reserves[p.ingredientId] || 0)))
        );
      });
  const start = (item: PantryItem | null) => {
    setEdit(item);
    setSelectedIngredient(item?.ingredientId || "potato");
    setOpen(true);
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const ingredientId = String(form.get("ingredientId")),
      item: PantryItem = {
        id: edit?.id || uid(),
        ingredientId,
        quantity: Number(form.get("quantity")),
        unit: ingredientMap.get(ingredientId)!.unit,
        location: String(form.get("location")) as "fridge",
        status: "usable",
        purchasedAt: String(form.get("purchasedAt")) || undefined,
        expiresAt: String(form.get("expiresAt")) || undefined,
      };
    if (await act({ type: "pantry.save", item })) {
      setOpen(false);
      setMessage(edit ? "موجودی اصلاح شد" : "ماده غذایی به آشپزخانه اضافه شد");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="همه‌چیز سر جای خودش"
        title="موجودی آشپزخانه"
        description="ببینید چه دارید، چه چیزی کم است و چه چیزی را زودتر مصرف کنید."
        action={
          <Button onClick={() => start(null)}>
            <Plus size={18} />
            افزودن ماده غذایی
          </Button>
        }
      />
      <div className="panel pantry-toolbar">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label="جستجوی موجودی"
            placeholder="نام ماده غذایی را بنویسید…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="دسته‌بندی"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["همه دسته‌ها", ...new Set(ingredients.map((i) => i.category))].map(
            (c) => (
              <option key={c}>{c}</option>
            ),
          )}
        </select>
        <SlidersHorizontal size={19} />
      </div>
      <div className="filter-tabs">
        {[
          ["all", "همه مواد"],
          ["fridge", "یخچال"],
          ["freezer", "فریزر"],
          ["cabinet", "کابینت"],
          ["expiring", "نزدیک انقضا"],
          ["low", "کم‌موجود"],
        ].map(([id, title]) => (
          <button
            key={id}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {title}
            {id === "all" && (
              <small>
                {number(
                  state.pantry.filter(
                    (p) => p.status === "usable" && p.quantity > 0,
                  ).length,
                )}
              </small>
            )}
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="pantry-grid">
          {visible.map((p) => {
            const i = ingredientMap.get(p.ingredientId)!,
              expired = Boolean(p.expiresAt && p.expiresAt < today),
              soon = Boolean(p.expiresAt && p.expiresAt <= addDays(today, 3)),
              low =
                usableStock(state, p.ingredientId, today) <
                (state.household.reserves[p.ingredientId] || 0),
              step = i.unit === "count" || i.unit === "pack" ? 1 : 100;
            return (
              <article className="panel pantry-card" key={p.id}>
                <div className="pantry-card-top">
                  <span className="ingredient-emoji">{i.emoji}</span>
                  <div className="card-tools">
                    <button
                      aria-label={`ویرایش ${i.name}`}
                      onClick={() => start(p)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={`حذف ${i.name}`}
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <span className="category-label">
                  {i.category} · {locations[p.location]}
                </span>
                <h3>{i.name}</h3>
                <div className="quantity-control">
                  <button
                    aria-label={`کاهش ${i.name}`}
                    disabled={busy}
                    onClick={() =>
                      void act({
                        type: "pantry.adjust",
                        id: p.id,
                        quantity: Math.max(0, p.quantity - step),
                      })
                    }
                  >
                    <Minus size={15} />
                  </button>
                  <b>
                    {number(p.quantity)} <small>{unitLabel[p.unit]}</small>
                  </b>
                  <button
                    aria-label={`افزایش ${i.name}`}
                    disabled={busy}
                    onClick={() =>
                      void act({
                        type: "pantry.adjust",
                        id: p.id,
                        quantity: p.quantity + step,
                      })
                    }
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <div className="pantry-card-bottom">
                  {expired ? (
                    <span className="badge red">
                      <AlertCircle size={13} />
                      منقضی‌شده
                    </span>
                  ) : soon ? (
                    <span className="badge amber">
                      <Clock size={13} />
                      زودتر مصرف شود
                    </span>
                  ) : low ? (
                    <span className="badge amber">کمتر از ذخیره دلخواه</span>
                  ) : (
                    <span className="badge green">موجودی قابل استفاده</span>
                  )}
                  <small>
                    {p.expiresAt
                      ? `انقضا: ${faDate(p.expiresAt, { month: "short", day: "numeric", year: undefined })}`
                      : "بدون تاریخ انقضا"}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={<Package size={32} />}
          title={
            search || filter !== "all"
              ? "ماده‌ای با این فیلتر پیدا نشد"
              : "آشپزخانه‌تان را ثبت کنید"
          }
          description="مواد موجود در خانه را اضافه کنید تا پیشنهاد غذا و خرید دقیق‌تر شود."
          onClick={() => start(null)}
          button="افزودن اولین ماده"
        />
      )}
      <p className="page-note">
        هر خرید یک سری مستقل است؛ تاریخ انقضای خرید تازه، خرید قبلی را تغییر
        نمی‌دهد.
      </p>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={edit ? "ویرایش ماده غذایی" : "افزودن به موجودی"}
        description="مقدار فعلی و محل نگهداری را مشخص کنید."
      >
        <form onSubmit={save} key={edit?.id || "new"}>
          <div className="form-grid">
            <Field label="ماده غذایی">
              <select
                name="ingredientId"
                value={selectedIngredient}
                onChange={(e) => setSelectedIngredient(e.target.value)}
                disabled={Boolean(edit)}
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              {edit && (
                <input
                  name="ingredientId"
                  type="hidden"
                  value={edit.ingredientId}
                />
              )}
            </Field>
            <Field
              label={`مقدار (${unitLabel[ingredientMap.get(selectedIngredient)!.unit]})`}
            >
              <input
                name="quantity"
                type="number"
                min="0"
                max="100000000"
                step="any"
                defaultValue={edit?.quantity || ""}
                required
              />
            </Field>
            <Field label="محل نگهداری">
              <select name="location" defaultValue={edit?.location || "fridge"}>
                {Object.entries(locations).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="تاریخ خرید · اختیاری">
              <input
                name="purchasedAt"
                type="date"
                defaultValue={edit?.purchasedAt || today}
              />
            </Field>
            <Field label="تاریخ انقضا · اختیاری">
              <input
                name="expiresAt"
                type="date"
                defaultValue={edit?.expiresAt || ""}
              />
            </Field>
          </div>
          <div className="modal-actions">
            <Button type="submit" disabled={busy}>
              ذخیره موجودی
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(deleting)}
        onOpenChange={(v) => {
          if (!v) setDeleting(null);
        }}
        title="حذف از موجودی"
        description="مقدار باقی‌مانده به‌عنوان خروج از موجودی ثبت می‌شود؛ سابقه تراکنش‌ها حفظ خواهد شد."
      >
        <p>
          {deleting && ingredientMap.get(deleting.ingredientId)!.name} از موجودی
          فعال حذف شود؟
        </p>
        <div className="modal-actions">
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (
                deleting &&
                (await act({ type: "pantry.delete", id: deleting.id }))
              )
                setDeleting(null);
            }}
          >
            حذف ماده غذایی
          </Button>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            انصراف
          </Button>
        </div>
      </Modal>
    </>
  );
}
