"use client";
import { useState, type FormEvent } from "react";
import {
  Bell,
  Plus,
  Trash2,
  Download,
  ShieldCheck,
  Users,
  Save,
  Smartphone,
  Leaf,
} from "lucide-react";
import {
  PageHeading,
  Button,
  Field,
  Modal,
  SectionHeading,
} from "@/components/ui";
import { useWorkspace } from "@/features/workspace/provider";
import {
  allergens,
  ingredients,
  uid,
  ingredientMap,
  forecast,
} from "@/domain/engine";
import type { Household, Reminder } from "@/domain/types";
import { number, unitLabel } from "@/lib/dates";
const weekDays = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];
function urlBase64ToBytes(value: string) {
  const raw = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export function SettingsPage() {
  const { state, demo, act, busy, setMessage, setError, startDemo, logout } =
    useWorkspace();
  const [household, setHousehold] = useState<Household | null>(
      state?.household ? structuredClone(state.household) : null,
    ),
    [reminder, setReminder] = useState<Reminder | null>(null),
    [deleteOpen, setDeleteOpen] = useState(false),
    [pushBusy, setPushBusy] = useState(false),
    [reserveIngredient, setReserveIngredient] = useState("milk"),
    [rateIngredient, setRateIngredient] = useState("rice");
  if (!state || !household) return null;
  const update = (part: Partial<Household>) =>
    setHousehold({ ...household, ...part });
  async function save(e: FormEvent) {
    e.preventDefault();
    if (await act({ type: "household.save", household: household! }))
      setMessage("تنظیمات خانوار ذخیره شد");
  }
  async function saveReminder(e: FormEvent) {
    e.preventDefault();
    if (reminder && (await act({ type: "reminder.save", reminder }))) {
      setReminder(null);
      setMessage("یادآوری ذخیره شد");
    }
  }
  async function push() {
    setPushBusy(true);
    setError("");
    try {
      if (demo)
        throw new Error(
          "اعلان پس‌زمینه برای حساب واقعی پس از اتصال سرور فعال می‌شود. در حالت آزمایشی از بررسی یادآوری استفاده کنید.",
        );
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error("این مرورگر اعلان پس‌زمینه را پشتیبانی نمی‌کند");
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("سرویس اعلان هنوز توسط مدیر تنظیم نشده است");
      if ((await Notification.requestPermission()) !== "granted")
        throw new Error("اجازه اعلان داده نشد");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(key),
        }));
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setMessage("اعلان روی این دستگاه فعال شد");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فعال‌سازی ممکن نشد");
    } finally {
      setPushBusy(false);
    }
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "cabinet-household.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const editMember = (
    id: string,
    part: Partial<Household["members"][number]>,
  ) =>
    update({
      members: household.members.map((m) =>
        m.id === id ? { ...m, ...part } : m,
      ),
    });
  return (
    <>
      <PageHeading
        eyebrow="آشپزخانه، به سبک شما"
        title="تنظیمات خانوار"
        description="اعضا، سلیقه غذایی و یادآوری‌ها را مطابق روزمره‌تان تنظیم کنید."
      />
      <div className="settings-grid">
        <form className="settings-main" onSubmit={save}>
          <section className="panel settings-panel">
            <SectionHeading title="پروفایل آشپزخانه" />
            <div className="form-grid">
              <Field label="نام آشپزخانه">
                <input
                  value={household.name}
                  onChange={(e) => update({ name: e.target.value })}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </Field>
              <Field label="منطقه زمانی">
                <select
                  value={household.timezone}
                  onChange={(e) => update({ timezone: e.target.value })}
                >
                  <option value="Asia/Tehran">تهران</option>
                  <option value="Europe/Berlin">برلین</option>
                  <option value="America/New_York">نیویورک</option>
                  <option value="UTC">UTC</option>
                </select>
              </Field>
              <Field label="خرید بعدی">
                <input
                  type="date"
                  value={household.nextShoppingDate}
                  onChange={(e) => update({ nextShoppingDate: e.target.value })}
                  required
                />
              </Field>
              <Field label="بودجه خرید · تومان، اختیاری">
                <input
                  type="number"
                  min="0"
                  max="100000000"
                  value={household.budget}
                  onChange={(e) => update({ budget: Number(e.target.value) })}
                />
              </Field>
              <Field label="روزهای آشپزی در هفته">
                <input
                  type="number"
                  min="0"
                  max="7"
                  value={household.cookingDays}
                  onChange={(e) =>
                    update({ cookingDays: Number(e.target.value) })
                  }
                  required
                />
              </Field>
              <Field label="وعده‌های خانگی در روز">
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={household.mealsPerDay}
                  onChange={(e) =>
                    update({ mealsPerDay: Number(e.target.value) })
                  }
                  required
                />
              </Field>
            </div>
            <small className="muted">
              بودجه برای ثبت ترجیح است؛ تا تعیین قیمت معتبر مواد، رتبه‌بندی بر
              اساس قیمت انجام نمی‌شود.
            </small>
          </section>
          <section className="panel settings-panel">
            <SectionHeading
              title="اعضا و ترجیحات غذایی"
              action={
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    update({
                      members: [
                        ...household.members,
                        {
                          id: uid(),
                          name: "عضو جدید",
                          allergens: [],
                          dislikes: [],
                        },
                      ],
                    })
                  }
                >
                  <Plus size={16} />
                  عضو جدید
                </Button>
              }
            />
            {household.members.map((member) => (
              <div className="member-settings" key={member.id}>
                <div className="member-heading">
                  <Users size={18} />
                  <input
                    aria-label="نام عضو"
                    value={member.name}
                    onChange={(e) =>
                      editMember(member.id, { name: e.target.value })
                    }
                    required
                    maxLength={60}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    disabled={household.members.length === 1}
                    aria-label={`حذف عضو ${member.name}`}
                    onClick={() =>
                      update({
                        members: household.members.filter(
                          (m) => m.id !== member.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="field-label">حساسیت‌ها و محدودیت‌ها</p>
                <div className="choice-chips">
                  {Object.entries(allergens).map(([id, label]) => (
                    <label
                      className={
                        member.allergens.includes(id) ? "selected" : ""
                      }
                      key={id}
                    >
                      <input
                        type="checkbox"
                        checked={member.allergens.includes(id)}
                        onChange={(e) =>
                          editMember(member.id, {
                            allergens: e.target.checked
                              ? [...member.allergens, id]
                              : member.allergens.filter((x) => x !== id),
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <Field label="مواد نامطلوب · انتخاب چند مورد با Ctrl یا لمس">
                  <select
                    multiple
                    value={member.dislikes}
                    onChange={(e) =>
                      editMember(member.id, {
                        dislikes: Array.from(e.target.selectedOptions).map(
                          (o) => o.value,
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
                </Field>
              </div>
            ))}
            <div className="privacy-note">
              <ShieldCheck size={18} />
              <p>
                پیشنهادها محدودیت تمام اعضا را رعایت می‌کنند. ترکیب درج‌شده، جای
                بررسی برچسب محصول خریداری‌شده را نمی‌گیرد.
              </p>
            </div>
          </section>
          <section className="panel settings-panel">
            <SectionHeading title="ذخیره دلخواه و اقلام همیشگی" />
            <p className="muted">
              مقداری که می‌خواهید بعد از وعده‌های برنامه‌ریزی‌شده باقی بماند.
            </p>
            {Object.entries(household.reserves).map(([id, q]) => (
              <div className="reserve-row" key={id}>
                <span>{ingredientMap.get(id)?.name}</span>
                <input
                  aria-label={`ذخیره ${ingredientMap.get(id)?.name}`}
                  type="number"
                  step="any"
                  min="0"
                  value={q}
                  onChange={(e) =>
                    update({
                      reserves: {
                        ...household.reserves,
                        [id]: Number(e.target.value),
                      },
                    })
                  }
                />
                <small>{unitLabel[ingredientMap.get(id)?.unit || "g"]}</small>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="حذف ذخیره"
                  onClick={() => {
                    const next = { ...household.reserves };
                    delete next[id];
                    update({ reserves: next });
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <div className="inline-add">
              <select
                aria-label="انتخاب ماده همیشگی"
                value={reserveIngredient}
                onChange={(e) => setReserveIngredient(e.target.value)}
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  update({
                    reserves: {
                      ...household.reserves,
                      [reserveIngredient]:
                        household.reserves[reserveIngredient] || 0,
                    },
                  })
                }
              >
                <Plus size={16} />
                افزودن
              </Button>
            </div>
          </section>
          <section className="panel settings-panel">
            <SectionHeading title="برآورد مصرف روزانه" />
            <p className="muted">
              در نبود سابقه کافی، مقدار پیش‌فرض شما استفاده می‌شود. تخمین بر
              اساس مصرف ثبت‌شده بهبود می‌یابد.
            </p>
            {Object.entries(household.defaultRates).map(([id, q]) => {
              const estimate = forecast(state, id);
              return (
                <div className="reserve-row" key={id}>
                  <span>
                    {ingredientMap.get(id)?.name}
                    <small className="muted">
                      اطمینان{" "}
                      {estimate.confidence === "low" ? "پایین" : "متوسط"} ·{" "}
                      {number(estimate.samples)} ثبت مصرف
                    </small>
                    {estimate.daysLeft !== null && (
                      <small className="muted">
                        با نرخ مصرف فعلی، حدود {number(estimate.daysLeft)} روز
                        تا اتمام
                      </small>
                    )}
                  </span>
                  <input
                    aria-label={`مصرف روزانه ${ingredientMap.get(id)?.name}`}
                    type="number"
                    step="any"
                    min="0"
                    value={q}
                    onChange={(e) =>
                      update({
                        defaultRates: {
                          ...household.defaultRates,
                          [id]: Number(e.target.value),
                        },
                      })
                    }
                  />
                  <small>
                    {unitLabel[ingredientMap.get(id)?.unit || "g"]} / روز
                  </small>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="حذف برآورد"
                    onClick={() => {
                      const next = { ...household.defaultRates };
                      delete next[id];
                      update({ defaultRates: next });
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
            <div className="inline-add">
              <select
                aria-label="انتخاب ماده برای برآورد"
                value={rateIngredient}
                onChange={(e) => setRateIngredient(e.target.value)}
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  update({
                    defaultRates: {
                      ...household.defaultRates,
                      [rateIngredient]:
                        household.defaultRates[rateIngredient] || 0,
                    },
                  })
                }
              >
                <Plus size={16} />
                افزودن
              </Button>
            </div>
          </section>
          <Button type="submit" disabled={busy}>
            <Save size={17} />
            ذخیره تنظیمات خانوار
          </Button>
        </form>
        <aside className="settings-aside">
          <section className="panel settings-panel">
            <SectionHeading title="یادآوری خرید" action={<Bell size={19} />} />
            <p className="muted">
              در ساعت و روزهای انتخابی، نیازهای خرید بررسی می‌شود.
            </p>
            {state.reminders.map((r) => (
              <div className="reminder-row" key={r.id}>
                <button
                  className="reminder-time"
                  onClick={() => setReminder(structuredClone(r))}
                >
                  {r.time}
                  <small>{r.days.map((d) => weekDays[d]).join("، ")}</small>
                </button>
                <button
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`یادآوری ${r.time}`}
                  className={`toggle ${r.enabled ? "on" : ""}`}
                  disabled={busy}
                  onClick={() =>
                    void act({
                      type: "reminder.save",
                      reminder: { ...r, enabled: !r.enabled },
                    })
                  }
                >
                  <i />
                </button>
                <button
                  className="icon-button"
                  aria-label="حذف یادآوری"
                  disabled={busy}
                  onClick={() =>
                    void act({ type: "reminder.delete", id: r.id })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() =>
                setReminder({
                  id: uid(),
                  time: "17:00",
                  days: [0, 1, 2, 3, 4, 5, 6],
                  enabled: true,
                  slot: "all",
                })
              }
            >
              <Plus size={16} />
              یادآوری جدید
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                if (await act({ type: "reminders.check" }))
                  setMessage(
                    "یادآوری‌های موعدرسیده بررسی شدند؛ اگر کمبودی باشد در اعلان‌ها می‌بینید.",
                  );
              }}
            >
              بررسی یادآوری‌ها اکنون
            </Button>
          </section>
          <section className="panel settings-panel">
            <Smartphone size={23} />
            <h3>اعلان روی این دستگاه</h3>
            <p className="muted">
              با اجازه شما، یادآوری حتی وقتی برنامه باز نیست ارسال می‌شود.
            </p>
            <Button
              variant="secondary"
              disabled={pushBusy}
              onClick={() => void push()}
            >
              {pushBusy ? "در حال فعال‌سازی…" : "فعال‌سازی اعلان دستگاه"}
            </Button>
            {demo && (
              <small className="muted">
                در حالت آزمایشی، بررسی یادآوری با باز بودن برنامه یا دکمه بررسی
                انجام می‌شود.
              </small>
            )}
          </section>
          <section className="panel settings-panel">
            <SectionHeading title="اطلاعات شما" />
            <Button variant="secondary" onClick={exportData}>
              <Download size={16} />
              دریافت خروجی اطلاعات
            </Button>
            {demo ? (
              <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
                شروع دوباره با آشپزخانه خالی
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="danger-text"
                onClick={() => setDeleteOpen(true)}
              >
                حذف حساب و اطلاعات خانوار
              </Button>
            )}
            <small className="muted">
              فایل خروجی شامل ترجیحات و محدودیت‌های غذایی است.
            </small>
          </section>
          <div className="settings-tip">
            <Leaf size={22} />
            <p>ثبت مقدار واقعی مصرف، پیشنهادهای روزهای بعد را بهتر می‌کند.</p>
          </div>
        </aside>
      </div>
      <Modal
        open={Boolean(reminder)}
        onOpenChange={(v) => {
          if (!v) setReminder(null);
        }}
        title="تنظیم یادآوری"
        description="وقت مناسب خرید را انتخاب کنید."
      >
        {reminder && (
          <form onSubmit={saveReminder}>
            <div className="form-grid">
              <Field label="ساعت محلی">
                <input
                  type="time"
                  value={reminder.time}
                  onChange={(e) =>
                    setReminder({ ...reminder, time: e.target.value })
                  }
                  required
                />
              </Field>
              <Field label="وعده مرتبط">
                <select
                  value={reminder.slot}
                  onChange={(e) =>
                    setReminder({ ...reminder, slot: e.target.value as "all" })
                  }
                >
                  <option value="all">همه نیازهای خرید</option>
                  <option value="breakfast">صبحانه</option>
                  <option value="lunch">ناهار</option>
                  <option value="dinner">شام</option>
                </select>
              </Field>
            </div>
            <div className="choice-chips">
              {weekDays.map((day, index) => (
                <label
                  key={day}
                  className={reminder.days.includes(index) ? "selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={reminder.days.includes(index)}
                    onChange={(e) =>
                      setReminder({
                        ...reminder,
                        days: e.target.checked
                          ? [...reminder.days, index]
                          : reminder.days.filter((d) => d !== index),
                      })
                    }
                  />
                  {day}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <Button disabled={busy || !reminder.days.length} type="submit">
                ذخیره یادآوری
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReminder(null)}
              >
                انصراف
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={demo ? "شروع دوباره" : "حذف حساب"}
        description={
          demo
            ? "موجودی و برنامه آزمایشی پاک می‌شوند."
            : "این کار حساب و تمام اطلاعات خانوار تحت مالکیت شما را حذف می‌کند."
        }
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (demo) {
              startDemo(true);
              setHousehold(structuredClone(state.household));
              setDeleteOpen(false);
              window.location.assign("/");
              return;
            }
            try {
              const response = await fetch("/api/account", {
                method: "DELETE",
              });
              if (!response.ok) throw new Error((await response.json()).error);
              await logout();
            } catch (e) {
              setError(e instanceof Error ? e.message : "حذف ممکن نشد");
            }
          }}
        >
          <Field label="برای تأیید، «حذف» را وارد کنید">
            <input required pattern="حذف" autoComplete="off" />
          </Field>
          <div className="modal-actions">
            <Button type="submit" variant="danger">
              {demo ? "پاک کردن داده آزمایشی" : "حذف حساب و خانوار"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
            >
              انصراف
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
