"use client";
import { useState, type FormEvent } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Save,
  ExternalLink,
} from "lucide-react";
import { PageHeading, Button, Modal, Field, Empty } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/provider";
import { ingredients, ingredientMap, uid } from "@/domain/engine";
import { recipeSchema } from "@/domain/validation";
import type { Recipe } from "@/domain/types";
import { number, unitLabel } from "@/lib/dates";
export function AdminPage() {
  const { recipes, isAdmin, demo, saveRecipe, busy, setError } = useWorkspace();
  const [draft, setDraft] = useState<Recipe | null>(null),
    [expected, setExpected] = useState(0);
  if (!isAdmin)
    return (
      <Empty
        icon={<BookOpen size={30} />}
        title="دسترسی مدیریت ندارید"
        description="مدیریت کاتالوگ فقط برای مدیر سامانه فعال است."
      />
    );
  const edit = (recipe: Recipe) => {
    setExpected(recipe.version);
    setDraft(structuredClone(recipe));
  };
  const add = () => {
    setExpected(0);
    setDraft({
      id: uid(),
      version: 1,
      name: "",
      description: "",
      servings: 2,
      minutes: 30,
      difficulty: "آسان",
      category: "ایرانی",
      ingredients: [
        { ingredientId: "potato", quantity: 300, unit: "g", estimated: true },
      ],
      steps: [""],
      sourceUrl: "https://kalleh.com/book/",
      sourceStatus: "unavailable",
      note: "",
      published: false,
      art: "برنج",
    });
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    try {
      const recipe = recipeSchema.parse({ ...draft, version: expected + 1 });
      if (recipe.published && recipe.sourceStatus === "unavailable")
        throw new Error("پیش از انتشار، بررسی منبع را تأیید کنید");
      if (await saveRecipe(recipe, expected)) setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "اطلاعات غذا معتبر نیست");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="کاتالوگ مرکزی غذاها"
        title="مدیریت غذاها"
        description="مواد، مقدارها و تصاویر را بررسی کنید و نسخه تازه منتشر کنید."
        action={
          <Button onClick={add}>
            <Plus size={17} />
            غذای جدید
          </Button>
        }
      />
      {demo && (
        <div className="source-note">
          شما در مدیریت آزمایشی هستید؛ تغییرها فقط در این مرورگر ذخیره می‌شوند.
          انتشار واقعی به نقش مدیر سرور نیاز دارد.
        </div>
      )}
      <div className="panel admin-list">
        {recipes.map((r) => (
          <div className="admin-row" key={r.id}>
            <div>
              <b>{r.name}</b>
              <small>
                نسخه {number(r.version)} · {number(r.ingredients.length)} ماده ·{" "}
                {number(r.servings)} نفر
              </small>
            </div>
            <span className={`badge ${r.published ? "green" : "amber"}`}>
              {r.published ? "منتشرشده" : "پیش‌نویس"}
            </span>
            <span className="muted">
              {r.sourceStatus === "reviewed"
                ? "منبع بررسی شده"
                : "نیازمند بررسی منبع"}
            </span>
            <Button variant="ghost" onClick={() => edit(r)}>
              <Pencil size={16} />
              ویرایش
            </Button>
            <a
              href={r.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-button"
              aria-label={`منبع ${r.name}`}
            >
              <ExternalLink size={16} />
            </a>
          </div>
        ))}
      </div>
      <Modal
        open={Boolean(draft)}
        onOpenChange={(v) => {
          if (!v) setDraft(null);
        }}
        title={expected ? "انتشار نسخه جدید غذا" : "ساخت پروفایل غذا"}
        description="نسخه‌های استفاده‌شده در برنامه خانوارها حفظ می‌شوند."
      >
        {draft && (
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="نام غذا">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  required
                  minLength={2}
                  maxLength={120}
                />
              </Field>
              <Field label="تعداد نفرات پایه">
                <input
                  type="number"
                  value={draft.servings}
                  min={1}
                  max={100}
                  onChange={(e) =>
                    setDraft({ ...draft, servings: Number(e.target.value) })
                  }
                  required
                />
              </Field>
              <Field label="زمان کل · دقیقه">
                <input
                  type="number"
                  value={draft.minutes}
                  min={1}
                  max={1440}
                  onChange={(e) =>
                    setDraft({ ...draft, minutes: Number(e.target.value) })
                  }
                  required
                />
              </Field>
              <Field label="دشواری">
                <select
                  value={draft.difficulty}
                  onChange={(e) =>
                    setDraft({ ...draft, difficulty: e.target.value })
                  }
                >
                  <option>آسان</option>
                  <option>متوسط</option>
                  <option>سخت</option>
                </select>
              </Field>
              <Field label="دسته">
                <input
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                  required
                />
              </Field>
              <Field label="تصویرسازی جایگزین">
                <select
                  value={draft.art}
                  onChange={(e) => setDraft({ ...draft, art: e.target.value })}
                >
                  {["برنج", "پاستا", "کتلت", "کوکو", "سبزی", "عدس"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="توضیح کوتاه">
              <input
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                maxLength={500}
              />
            </Field>
            <Field
              label="نشانی تصویر مجاز · HTTPS، اختیاری"
              hint="از تصویر متعلق به خودتان یا دارای اجازه انتشار استفاده کنید."
            >
              <input
                type="url"
                dir="ltr"
                value={draft.imageUrl || ""}
                onChange={(e) =>
                  setDraft({ ...draft, imageUrl: e.target.value })
                }
              />
            </Field>
            <Field label="نشانی منبع">
              <input
                type="url"
                dir="ltr"
                value={draft.sourceUrl}
                onChange={(e) =>
                  setDraft({ ...draft, sourceUrl: e.target.value })
                }
                required
              />
            </Field>
            <h3 className="detail-section-title">مواد اولیه</h3>
            <div className="admin-ingredients">
              {draft.ingredients.map((item, index) => (
                <div key={index}>
                  <select
                    aria-label={`ماده ${index + 1}`}
                    value={item.ingredientId}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        ingredients: draft.ingredients.map((i, j) =>
                          j === index
                            ? {
                                ...i,
                                ingredientId: e.target.value,
                                unit: ingredientMap.get(e.target.value)!.unit,
                              }
                            : i,
                        ),
                      })
                    }
                  >
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    aria-label={`مقدار ماده ${index + 1}`}
                    min="0.01"
                    step="any"
                    value={item.quantity}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        ingredients: draft.ingredients.map((i, j) =>
                          j === index
                            ? { ...i, quantity: Number(e.target.value) }
                            : i,
                        ),
                      })
                    }
                    required
                  />
                  <small>{unitLabel[item.unit]}</small>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(item.estimated)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          ingredients: draft.ingredients.map((i, j) =>
                            j === index
                              ? { ...i, estimated: e.target.checked }
                              : i,
                          ),
                        })
                      }
                    />
                    تخمینی
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(item.optional)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          ingredients: draft.ingredients.map((i, j) =>
                            j === index
                              ? { ...i, optional: e.target.checked }
                              : i,
                          ),
                        })
                      }
                    />
                    اختیاری
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="حذف ماده دستور"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        ingredients: draft.ingredients.filter(
                          (_, j) => j !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setDraft({
                  ...draft,
                  ingredients: [
                    ...draft.ingredients,
                    {
                      ingredientId: "potato",
                      quantity: 100,
                      unit: "g",
                      estimated: true,
                    },
                  ],
                })
              }
            >
              <Plus size={16} />
              ماده جدید
            </Button>
            <Field label="مراحل تهیه · هر مرحله در یک خط">
              <textarea
                rows={5}
                value={draft.steps.join("\n")}
                onChange={(e) =>
                  setDraft({ ...draft, steps: e.target.value.split("\n") })
                }
                required
              />
            </Field>
            <Field label="یادداشت کیفیت داده و تصویر">
              <textarea
                value={draft.note}
                rows={3}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </Field>
            <div className="choice-chips">
              <label
                className={draft.sourceStatus === "reviewed" ? "selected" : ""}
              >
                <input
                  type="checkbox"
                  checked={draft.sourceStatus === "reviewed"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sourceStatus: e.target.checked
                        ? "reviewed"
                        : "unavailable",
                    })
                  }
                />
                منبع و ترکیبات را بررسی کرده‌ام
              </label>
              <label className={draft.published ? "selected" : ""}>
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(e) =>
                    setDraft({ ...draft, published: e.target.checked })
                  }
                />
                انتشار برای کاربران
              </label>
            </div>
            <div className="modal-actions">
              <Button type="submit" disabled={busy}>
                <Save size={16} />
                ذخیره نسخه {number(expected + 1)}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDraft(null)}
              >
                انصراف
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
