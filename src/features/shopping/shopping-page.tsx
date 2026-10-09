"use client";
import { useState, type FormEvent } from "react";
import {
  ShoppingBasket,
  Plus,
  RefreshCw,
  Check,
  Pencil,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { PageHeading, Button, Modal, Field, Empty } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/provider";
import { ingredients, ingredientMap } from "@/domain/engine";
import { faDate, number, unitLabel, localDate } from "@/lib/dates";
import type { ShoppingItem } from "@/domain/types";
export function ShoppingPage() {
  const { state, act, busy, setMessage } = useWorkspace();
  const [open, setOpen] = useState(false),
    [edit, setEdit] = useState<ShoppingItem | null>(null),
    [buy, setBuy] = useState<ShoppingItem | null>(null),
    [selected, setSelected] = useState("potato"),
    [showPurchased, setShowPurchased] = useState(false);
  if (!state) return null;
  const active = state.shopping.filter((s) => !s.purchased),
    purchased = state.shopping.filter((s) => s.purchased),
    groups = [
      ...new Set(
        active.map((i) => ingredientMap.get(i.ingredientId)!.category),
      ),
    ];
  const start = (item: ShoppingItem | null) => {
    setEdit(item);
    setSelected(item?.ingredientId || "potato");
    setOpen(true);
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (
      await act({
        type: "shopping.save",
        id: edit?.id,
        ingredientId: edit?.ingredientId || String(form.get("ingredientId")),
        quantity: Number(form.get("quantity")),
        unit: ingredientMap.get(selected)!.unit,
      })
    ) {
      setOpen(false);
      setMessage("قلم خرید ذخیره شد");
    }
  }
  async function purchase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!buy) return;
    const form = new FormData(e.currentTarget);
    if (
      await act({
        type: "shopping.purchase",
        id: buy.id,
        quantity: Number(form.get("quantity")),
        location: String(form.get("location")) as "fridge",
        expiresAt: String(form.get("expiresAt")) || undefined,
      })
    ) {
      setBuy(null);
      setMessage("خرید ثبت و به موجودی اضافه شد");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="فقط آنچه لازم دارید"
        title="فهرست خرید"
        description="نیاز وعده‌ها و ذخیره دلخواه، با کسر مواد موجود در خانه."
        action={
          <div className="heading-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                if (await act({ type: "shopping.generate" }))
                  setMessage("فهرست خرید به‌روز شد");
              }}
            >
              <RefreshCw size={17} />
              محاسبه از برنامه
            </Button>
            <Button onClick={() => start(null)}>
              <Plus size={17} />
              افزودن قلم
            </Button>
          </div>
        }
      />
      <div className="panel shopping-summary">
        <span className="stat-icon sand">
          <ShoppingBasket size={24} />
        </span>
        <div>
          <b>{number(active.length)} قلم برای خرید</b>
          <p>خرید بعدی: {faDate(state.household.nextShoppingDate)}</p>
        </div>
        <span className="shopping-progress-label">
          {number(purchased.length)} قلم خریداری شده
        </span>
        <div className="shopping-progress">
          <i
            style={{
              width: `${state.shopping.length ? (purchased.length / state.shopping.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
      {active.length ? (
        groups.map((category) => (
          <section className="shopping-group panel" key={category}>
            <div className="shopping-group-heading">
              <h2>{category}</h2>
              <small>
                {number(
                  active.filter(
                    (i) =>
                      ingredientMap.get(i.ingredientId)!.category === category,
                  ).length,
                )}{" "}
                قلم
              </small>
            </div>
            {active
              .filter(
                (i) => ingredientMap.get(i.ingredientId)!.category === category,
              )
              .sort((a, b) =>
                a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1,
              )
              .map((item) => {
                const i = ingredientMap.get(item.ingredientId)!;
                return (
                  <div className="shopping-row" key={item.id}>
                    <button
                      className="purchase-check"
                      aria-label={`ثبت خرید ${i.name}`}
                      onClick={() => setBuy(item)}
                      disabled={busy}
                    >
                      <Check size={15} />
                    </button>
                    <span className="tiny-emoji">{i.emoji}</span>
                    <div className="shopping-row-name">
                      <b>{i.name}</b>
                      <small>
                        {item.reasons.join(" · ")}
                        {item.overridden ? " · مقدار انتخابی شما" : ""}
                      </small>
                    </div>
                    {item.priority === "high" && (
                      <span className="badge amber">برای وعده نزدیک</span>
                    )}
                    <b className="shopping-quantity">
                      {number(item.quantity)}{" "}
                      <small>{unitLabel[item.unit]}</small>
                    </b>
                    <button
                      className="icon-button"
                      aria-label={`ویرایش خرید ${i.name}`}
                      onClick={() => start(item)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`حذف خرید ${i.name}`}
                      disabled={busy}
                      onClick={() =>
                        void act({ type: "shopping.delete", id: item.id })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
          </section>
        ))
      ) : (
        <Empty
          title="فهرست خریدتان خالی است"
          description="از برنامه غذایی و ذخیره دلخواه محاسبه کنید یا یک قلم دستی اضافه کنید."
          onClick={() => void act({ type: "shopping.generate" })}
          button="محاسبه فهرست خرید"
          icon={<ShoppingBasket size={32} />}
        />
      )}
      <button
        className="purchased-toggle"
        onClick={() => setShowPurchased(!showPurchased)}
      >
        <Check size={16} />
        نمایش خریدهای ثبت‌شده ({number(purchased.length)})
        <ArrowLeft size={15} />
      </button>
      {showPurchased && (
        <div className="panel purchased-list">
          {purchased.length ? (
            purchased.map((i) => (
              <div key={i.id}>
                <Check size={16} />
                <span>{ingredientMap.get(i.ingredientId)!.name}</span>
                <span>
                  {number(i.quantity)} {unitLabel[i.unit]}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">هنوز خریدی ثبت نشده است.</p>
          )}
        </div>
      )}
      <p className="page-note">
        مقدارهای اصلاح‌شده و اقلام دستی هنگام محاسبه دوباره حفظ می‌شوند. حذف قلم
        خودکار موقت است؛ اگر نیاز باقی بماند در محاسبه بعدی بازمی‌گردد.
      </p>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={edit ? "ویرایش قلم خرید" : "افزودن به خرید"}
      >
        <form onSubmit={save} key={edit?.id || "new"}>
          <Field label="ماده غذایی">
            <select
              name="ingredientId"
              value={selected}
              disabled={Boolean(edit)}
              onChange={(e) => setSelected(e.target.value)}
            >
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={`مقدار (${unitLabel[ingredientMap.get(selected)!.unit]})`}
          >
            <input
              name="quantity"
              type="number"
              min="0.01"
              max="100000000"
              step="any"
              defaultValue={edit?.quantity || ""}
              required
            />
          </Field>
          <div className="modal-actions">
            <Button type="submit" disabled={busy}>
              ذخیره قلم
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
        open={Boolean(buy)}
        onOpenChange={(v) => {
          if (!v) setBuy(null);
        }}
        title={
          buy
            ? `ثبت خرید ${ingredientMap.get(buy.ingredientId)!.name}`
            : "ثبت خرید"
        }
        description="مقدار واقعی خرید را وارد کنید؛ همین مقدار به موجودی خانه اضافه می‌شود."
      >
        <form onSubmit={purchase} key={buy?.id}>
          <div className="form-grid">
            <Field label={`مقدار خرید (${buy ? unitLabel[buy.unit] : ""})`}>
              <input
                name="quantity"
                type="number"
                min="0.01"
                max="100000000"
                step="any"
                defaultValue={buy?.quantity}
                required
              />
            </Field>
            <Field label="محل نگهداری">
              <select name="location" defaultValue="fridge">
                <option value="fridge">یخچال</option>
                <option value="freezer">فریزر</option>
                <option value="cabinet">کابینت</option>
              </select>
            </Field>
            <Field label="تاریخ انقضا · اختیاری">
              <input
                name="expiresAt"
                type="date"
                min={localDate(state.household.timezone)}
              />
            </Field>
          </div>
          <div className="modal-actions">
            <Button type="submit" disabled={busy}>
              <Check size={16} />
              ثبت خرید و افزودن به موجودی
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setBuy(null)}
            >
              انصراف
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
