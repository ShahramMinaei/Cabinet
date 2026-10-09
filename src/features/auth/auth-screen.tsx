"use client";
import { useState, type FormEvent } from "react";
import { Leaf, ArrowLeft, ShieldCheck } from "lucide-react";
import { browserClient, configured } from "@/lib/supabase/browser";
import { useWorkspace } from "@/features/workspace/provider";
import { Button, Field } from "@/components/ui";
import { FoodArt } from "@/components/food-art";
export function AuthScreen() {
  const { startDemo, reload, setError, setMessage } = useWorkspace();
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const client = browserClient();
      const input = {
        email: String(form.get("email")),
        password: String(form.get("password")),
      };
      if (signup) {
        const { data, error } = await client.auth.signUp({
          ...input,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("برای فعال‌سازی حساب، ایمیل تأیید را باز کنید");
          return;
        }
      } else {
        const { error } = await client.auth.signInWithPassword(input);
        if (error) throw error;
      }
      localStorage.removeItem("cabinet:mode");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ورود ممکن نشد");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <div className="auth-art">
        <div className="brand">
          <img src="/icon.svg" alt="" />
          <strong>
            کابینت<span>آشپزخانه، با خیال راحت</span>
          </strong>
        </div>
        <h1>
          از «چی بپزم؟»
          <br />
          تا یک شام آماده.
        </h1>
        <p>
          موجودی خانه، برنامه غذا و خرید بعدی؛
          <br />
          همه در یک جای ساده.
        </p>
        <FoodArt kind="برنج" />
        <span className="auth-caption">
          <Leaf size={18} /> کمتر دور بریزیم، بهتر برنامه‌ریزی کنیم.
        </span>
      </div>
      <div className="auth-form">
        <div className="eyebrow">به آشپزخانه‌تان خوش آمدید</div>
        <h2>{signup ? "ساخت حساب جدید" : "ورود به کابینت"}</h2>
        <p className="muted">
          {configured
            ? "اطلاعات آشپزخانه شما پس از ورود در دسترس است."
            : "برای شروع، آشپزخانه آزمایشی را باز کنید."}
        </p>
        {configured && (
          <form onSubmit={submit}>
            <Field label="ایمیل">
              <input
                name="email"
                type="email"
                dir="ltr"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="رمز عبور">
              <input
                name="password"
                type="password"
                dir="ltr"
                minLength={8}
                required
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </Field>
            <Button disabled={busy} type="submit">
              {busy ? "در حال بررسی…" : signup ? "ساخت حساب" : "ورود به حساب"}
              <ArrowLeft size={17} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSignup(!signup)}
            >
              {signup ? "حساب دارید؟ وارد شوید" : "حساب ندارید؟ ثبت‌نام کنید"}
            </Button>
          </form>
        )}
        <div className="demo-entry">
          <Button variant="secondary" onClick={() => startDemo()}>
            دیدن آشپزخانه آزمایشی
            <ArrowLeft size={17} />
          </Button>
          <Button variant="ghost" onClick={() => startDemo(true)}>
            شروع با آشپزخانه خالی
          </Button>
          <small>
            <ShieldCheck size={14} /> داده‌های آزمایشی از حساب واقعی جدا هستند.
          </small>
        </div>
      </div>
    </main>
  );
}
